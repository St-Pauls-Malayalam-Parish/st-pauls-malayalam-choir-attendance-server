import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass', 'other'];

router.use(requireAuth, requireAdmin);

function validateMemberBody({ name, email, password, voicePart }, { passwordRequired }) {
  if (!name || name.trim().length < 2) {
    return 'Name is required';
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'A valid email is required';
  }
  if (passwordRequired && (!password || password.length < 8)) {
    return 'Password must be at least 8 characters';
  }
  if (password && password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!VOICE_PARTS.includes(voicePart)) {
    return 'Invalid voice part';
  }
  return null;
}

function serializeMember(member, stats = {}) {
  const present = stats.present || 0;
  const absent = stats.absent || 0;
  const late = stats.late || 0;
  const excused = stats.excused || 0;
  const total = stats.total || 0;
  const counted = present + absent + late;
  const rate = counted === 0 ? 0 : Math.round(((present + late) / counted) * 100);
  return {
    id: member._id.toString(),
    name: member.name,
    email: member.email,
    voicePart: member.voicePart,
    active: member.active,
    approvalStatus: member.approvalStatus || 'pending',
    createdAt: member.createdAt,
    summary: { present, absent, late, excused, total, rate },
  };
}

router.get('/', async (_req, res) => {
  const members = await User.find({ role: 'member' })
    .select('name email voicePart active approvalStatus createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const ids = members.map((member) => member._id);
  const records = await Attendance.aggregate([
    { $match: { user: { $in: ids } } },
    {
      $group: {
        _id: '$user',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  const byUser = new Map(records.map((row) => [row._id.toString(), row]));

  const payload = members.map((member) => serializeMember(member, byUser.get(member._id.toString())));

  res.json({
    pending: payload.filter((member) => member.approvalStatus === 'pending'),
    members: payload.filter((member) => member.approvalStatus === 'approved'),
    declined: payload.filter((member) => member.approvalStatus === 'rejected'),
  });
});

router.post('/', async (req, res) => {
  const { name, email, password, voicePart = 'other' } = req.body;
  const error = validateMemberBody({ name, email, password, voicePart }, { passwordRequired: true });
  if (error) {
    return res.status(400).json({ error });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    voicePart,
    role: 'member',
    approvalStatus: 'approved',
  });

  res.status(201).json({ member: user.toSafeJSON() });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, voicePart = 'other', password } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid member' });
  }

  const error = validateMemberBody({ name, email, password, voicePart }, { passwordRequired: false });
  if (error) {
    return res.status(400).json({ error });
  }

  const member = await User.findOne({ _id: id, role: 'member' });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const nextEmail = email.toLowerCase();
  const clash = await User.findOne({ email: nextEmail, _id: { $ne: member._id } });
  if (clash) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  member.name = name.trim();
  member.email = nextEmail;
  member.voicePart = voicePart;
  if (password) {
    member.passwordHash = await bcrypt.hash(password, 12);
  }
  await member.save();

  res.json({ member: member.toSafeJSON() });
});

router.patch('/:id/approval', async (req, res) => {
  const { id } = req.params;
  const { approvalStatus } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid member' });
  }
  if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
    return res.status(400).json({ error: 'Approval must be approved or declined' });
  }

  const member = await User.findOne({ _id: id, role: 'member' });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  member.approvalStatus = approvalStatus;
  await member.save();
  res.json({ member: member.toSafeJSON() });
});

export default router;
