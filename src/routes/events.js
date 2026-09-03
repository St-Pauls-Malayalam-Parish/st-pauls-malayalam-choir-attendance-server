import { Router } from 'express';
import { Event } from '../models/Event.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, requireAdmin, requireApproved } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { isValidLiturgicalColor } from '../utils/liturgical-colors.js';
import {
  buildEventFilter,
  buildPaginationMeta,
  parsePagination,
} from '../utils/event-query.js';

const router = Router();
const EVENT_TYPES = ['practice', 'service', 'concert', 'other'];

function serializeEvent(event) {
  return {
    id: event._id.toString(),
    title: event.title,
    date: event.date,
    type: event.type,
    notes: event.notes,
    liturgicalColor: event.liturgicalColor || '',
  };
}

function validateEventBody({ title, date, type, liturgicalColor }) {
  if (!title || !title.trim()) {
    return 'Event title is required';
  }
  if (!date || Number.isNaN(Date.parse(date))) {
    return 'Event date is required';
  }
  if (!EVENT_TYPES.includes(type)) {
    return 'Invalid event type';
  }
  if (!isValidLiturgicalColor(liturgicalColor)) {
    return 'Invalid liturgical colour';
  }
  return null;
}

router.use(requireAuth, requireApproved);

router.get('/years', asyncHandler(async (_req, res) => {
  const years = await Event.aggregate([
    { $group: { _id: { $year: '$date' } } },
    { $sort: { _id: -1 } },
  ]);
  res.json({ years: years.map((entry) => entry._id) });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { filter, error } = buildEventFilter(req.query);
  if (error) {
    return res.status(400).json({ error });
  }

  const { page, pageSize, skip } = parsePagination(req.query);
  const [total, totalUnfiltered, events] = await Promise.all([
    Event.countDocuments(filter),
    Event.countDocuments({}),
    Event.find(filter).sort({ date: -1 }).skip(skip).limit(pageSize).lean(),
  ]);

  res.json({
    events: events.map(serializeEvent),
    pagination: buildPaginationMeta({ page, pageSize, total }),
    meta: { totalUnfiltered },
  });
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { title, date, type = 'practice', notes = '', liturgicalColor = '' } = req.body;
  const validationError = validateEventBody({ title, date, type, liturgicalColor });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const event = await Event.create({
    title: title.trim(),
    date: new Date(date),
    type,
    notes: notes.trim(),
    liturgicalColor: liturgicalColor || '',
    createdBy: req.user._id,
  });

  res.status(201).json({
    event: serializeEvent(event),
  });
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { title, date, type = 'practice', notes = '', liturgicalColor = '' } = req.body;
  const validationError = validateEventBody({ title, date, type, liturgicalColor });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const event = await Event.findByIdAndUpdate(
    req.params.id,
    {
      title: title.trim(),
      date: new Date(date),
      type,
      notes: notes.trim(),
      liturgicalColor: liturgicalColor || '',
    },
    { new: true }
  );

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  res.json({ event: serializeEvent(event) });
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  await Attendance.deleteMany({ event: event._id });
  res.json({ ok: true });
}));

export default router;
