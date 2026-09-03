import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { requireAuth, setAuthCookie, clearAuthCookie, signToken } from '../middleware/auth.js';
import { normalizeUsername, validateEmail, validateUsername } from '../utils/user-fields.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass', 'other'];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait and try again.' },
});

function validateRegister({ name, username, email, password, voicePart }) {
  if (!name || name.trim().length < 2) {
    return 'Please enter your full name';
  }
  const usernameError = validateUsername(username);
  if (usernameError) return usernameError;
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (voicePart && !VOICE_PARTS.includes(voicePart)) {
    return 'Please choose a valid voice part';
  }
  return null;
}

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { name, username, email, password, voicePart = 'other' } = req.body;
  const error = validateRegister({ name, username, email, password, voicePart });
  if (error) return res.status(400).json({ error });

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

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    voicePart,
    role: 'member',
    approvalStatus: 'pending',
  });

  const token = signToken(user);
  setAuthCookie(res, token);
  return res.status(201).json({ user: user.toSafeJSON(), token });
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const user = await User.findOne({ username: normalizeUsername(username) });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Username or password is incorrect' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Username or password is incorrect' });
  }

  if (user.approvalStatus === 'rejected') {
    return res.status(403).json({
      error: 'This registration was not approved. Please contact a choir admin.',
    });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  return res.json({ user: user.toSafeJSON(), token });
}));

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

router.post('/change-password', requireAuth, authLimiter, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  req.user.passwordHash = await bcrypt.hash(newPassword, 12);
  await req.user.save();

  const token = signToken(req.user);
  setAuthCookie(res, token);
  return res.json({ ok: true, token });
}));

export default router;
