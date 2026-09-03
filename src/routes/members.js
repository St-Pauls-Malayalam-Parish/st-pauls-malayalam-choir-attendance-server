import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { normalizeUsername, validateEmail, validateUsername } from '../utils/user-fields.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass', 'other'];

router.use(requireAuth, requireAdmin);

async function findMember(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid member' });
    return null;
  }
  const member = await User.findOne({ _id: id, role: 'member' });
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return null;
  }
  return member;
}

function validateMemberBody({ name, username, email, password, voicePart }, { passwordRequired, usernameRequired }) {
  if (!name || name.trim().length < 2) {
    return 'Name is required';
  }
  if (usernameRequired || username) {
    const usernameError = validateUsername(username);
    if (usernameError) return usernameError;
  }
  const emailError = validateEmail(email);
  if (emailError) return emailError;
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
    username: member.username,
    email: member.email,
    voicePart: member.voicePart,
    active: member.active,
    approvalStatus: member.approvalStatus || 'pending',
    createdAt: member.createdAt,
    summary: { present, absent, late, excused, total, rate },
  };
}

router.get('/', asyncHandler(async (_req, res) => {
  const members = await User.find({ role: 'member' })
    .select('name username email voicePart active approvalStatus createdAt')
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
    pending: payload.filter((member) => member.approvalStatus === 'pending' && member.active),
    members: payload.filter((member) => member.approvalStatus === 'approved' && member.active),
    inactive: payload.filter((member) => !member.active),
    declined: payload.filter((member) => member.approvalStatus === 'rejected' && member.active),
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, username, email, password, voicePart = 'other' } = req.body;
  const error = validateMemberBody(
    { name, username, email, password, voicePart },
    { passwordRequired: true, usernameRequired: true }
  );
  if (error) {
    return res.status(400).json({ error });
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = email.toLowerCase();

  const existingUsername = await User.findOne({ username: normalizedUsername });
  if (existingUsername) {
    return res.status(409).json({ error: 'This username is already taken' });
  }

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await User.create({
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    voicePart,
    role: 'member',
    approvalStatus: 'approved',
  });

  res.status(201).json({ member: user.toSafeJSON() });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, username, email, voicePart = 'other', password } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid member' });
  }

  const error = validateMemberBody(
    { name, username, email, password, voicePart },
    { passwordRequired: false, usernameRequired: true }
  );
  if (error) {
    return res.status(400).json({ error });
  }

  const member = await User.findOne({ _id: id, role: 'member' });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const nextUsername = normalizeUsername(username);
  const nextEmail = email.toLowerCase();

  const usernameClash = await User.findOne({ username: nextUsername, _id: { $ne: member._id } });
  if (usernameClash) {
    return res.status(409).json({ error: 'This username is already taken' });
  }

  const emailClash = await User.findOne({ email: nextEmail, _id: { $ne: member._id } });
  if (emailClash) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  member.name = name.trim();
  member.username = nextUsername;
  member.email = nextEmail;
  member.voicePart = voicePart;
  if (password) {
    member.passwordHash = await bcrypt.hash(password, 12);
  }
  await member.save();

  res.json({ member: member.toSafeJSON() });
}));

router.patch('/:id/approval', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvalStatus } = req.body;

  const member = await findMember(id, res);
  if (!member) return;

  if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
    return res.status(400).json({ error: 'Approval must be approved or declined' });
  }

  member.approvalStatus = approvalStatus;
  await member.save();
  res.json({ member: member.toSafeJSON() });
}));

router.patch('/:id/active', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Active must be true or false' });
  }

  const member = await findMember(id, res);
  if (!member) return;

  member.active = active;
  await member.save();
  res.json({ member: member.toSafeJSON() });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const member = await findMember(id, res);
  if (!member) return;

  await Attendance.deleteMany({ user: member._id });
  await member.deleteOne();
  res.json({ ok: true });
}));

export default router;
