import { Router } from 'express';
import { Event } from '../models/Event.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, requireAdmin, requireApproved } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const EVENT_TYPES = ['rehearsal', 'service', 'concert', 'other'];

router.use(requireAuth, requireApproved);

router.get('/', asyncHandler(async (_req, res) => {
  const events = await Event.find().sort({ date: -1 }).lean();
  res.json({
    events: events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      type: event.type,
      notes: event.notes,
    })),
  });
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { title, date, type = 'rehearsal', notes = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Event title is required' });
  }
  if (!date || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: 'Event date is required' });
  }
  if (!EVENT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  const event = await Event.create({
    title: title.trim(),
    date: new Date(date),
    type,
    notes: notes.trim(),
    createdBy: req.user._id,
  });

  res.status(201).json({
    event: {
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      type: event.type,
      notes: event.notes,
    },
  });
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
