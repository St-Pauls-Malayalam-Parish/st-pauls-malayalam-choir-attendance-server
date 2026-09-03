import { Router } from 'express';
import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { Event } from '../models/Event.js';
import { User } from '../models/User.js';
import { requireAuth, requireAdmin, approvedMemberFilter } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const STATUSES = ['present', 'absent', 'late', 'excused'];

router.use(requireAuth);

function serializeRecord(record) {
  const user = record.user;
  const event = record.event;
  return {
    id: record._id.toString(),
    status: record.status,
    notes: record.notes || '',
    user: user && typeof user === 'object'
      ? { id: user._id.toString(), name: user.name, voicePart: user.voicePart }
      : { id: String(user) },
    event: event && typeof event === 'object'
      ? {
          id: event._id.toString(),
          title: event.title,
          date: event.date,
          type: event.type,
        }
      : { id: String(event) },
  };
}

function summaryFromRecords(records) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const record of records) {
    counts[record.status] += 1;
  }
  const counted = counts.present + counts.absent + counts.late;
  const rate = counted === 0 ? 0 : Math.round(((counts.present + counts.late) / counted) * 100);
  return { ...counts, total: records.length, rate };
}

function parseDay(value, endOfDay) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: 'Dates must be in YYYY-MM-DD format' };
  }
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Invalid date' };
  }
  return { date };
}

function eventDateQuery(from, to) {
  const start = parseDay(from, false);
  const end = parseDay(to, true);
  if (start?.error) return { error: start.error };
  if (end?.error) return { error: end.error };
  if (start?.date && end?.date && start.date > end.date) {
    return { error: 'Start date must be on or before the end date' };
  }
  const range = {};
  if (start?.date) range.$gte = start.date;
  if (end?.date) range.$lte = end.date;
  return { range: Object.keys(range).length ? range : null };
}

router.get('/me', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.approvalStatus !== 'approved') {
    return res.json({
      user: req.user.toSafeJSON(),
      pending: true,
      summary: { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 },
      history: [],
    });
  }
  const dateQuery = eventDateQuery(req.query.from, req.query.to);
  if (dateQuery.error) {
    return res.status(400).json({ error: dateQuery.error });
  }

  const eventFilter = dateQuery.range ? { date: dateQuery.range } : {};
  const events = await Event.find(eventFilter).sort({ date: -1 }).lean();
  const eventIds = events.map((event) => event._id);

  const records = await Attendance.find({
    user: req.user._id,
    ...(eventIds.length ? { event: { $in: eventIds } } : { event: { $in: [] } }),
  })
    .populate('event')
    .lean();

  const byEvent = new Map(
    records
      .filter((record) => record.event)
      .map((record) => [record.event._id.toString(), record])
  );

  const history = events.map((event) => {
    const record = byEvent.get(event._id.toString());
    const upcoming = new Date(event.date) > new Date();
    return {
      event: {
        id: event._id.toString(),
        title: event.title,
        date: event.date,
        type: event.type,
        notes: event.notes,
      },
      status: record?.status ?? (upcoming ? 'upcoming' : 'unmarked'),
      notes: record?.notes || '',
    };
  });

  res.json({
    user: req.user.toSafeJSON(),
    summary: summaryFromRecords(records),
    history,
  });
}));

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.eventId) {
    if (!mongoose.isValidObjectId(req.query.eventId)) {
      return res.status(400).json({ error: 'Invalid event' });
    }
    filter.event = req.query.eventId;
  }
  if (req.query.userId) {
    if (!mongoose.isValidObjectId(req.query.userId)) {
      return res.status(400).json({ error: 'Invalid member' });
    }
    filter.user = req.query.userId;
  }

  const records = await Attendance.find(filter)
    .populate('user', 'name email voicePart')
    .populate('event')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ records: records.map(serializeRecord) });
}));

router.get('/event/:eventId', requireAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ error: 'Invalid event' });
  }

  const event = await Event.findById(eventId).lean();
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const members = await User.find(approvedMemberFilter)
    .select('name email voicePart')
    .sort({ name: 1 })
    .lean();
  const records = await Attendance.find({ event: eventId }).lean();
  const byUser = new Map(
    records.map((record) => [record.user.toString(), { status: record.status, notes: record.notes || '' }])
  );

  res.json({
    event: {
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      type: event.type,
      notes: event.notes,
    },
    roster: members.map((member) => {
      const record = byUser.get(member._id.toString());
      return {
        id: member._id.toString(),
        name: member.name,
        email: member.email,
        voicePart: member.voicePart,
        status: record?.status ?? '',
        notes: record?.notes ?? '',
      };
    }),
  });
}));

router.put('/event/:eventId', requireAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { records } = req.body;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ error: 'Invalid event' });
  }
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Attendance records are required' });
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const ops = [];
  for (const row of records) {
    if (!mongoose.isValidObjectId(row.userId) || !STATUSES.includes(row.status)) {
      return res.status(400).json({ error: 'Each row needs a member and a valid status' });
    }
    const notes = typeof row.notes === 'string' ? row.notes.trim().slice(0, 500) : '';
    ops.push({
      updateOne: {
        filter: { user: row.userId, event: eventId },
        update: {
          $set: {
            status: row.status,
            notes,
            markedBy: req.user._id,
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) {
    const allowed = await User.countDocuments({
      ...approvedMemberFilter,
      _id: { $in: records.map((row) => row.userId) },
    });
    if (allowed !== records.length) {
      return res.status(400).json({ error: 'Attendance can only be marked for approved members' });
    }
    await Attendance.bulkWrite(ops);
  }

  res.json({ ok: true, saved: ops.length });
}));

export default router;
