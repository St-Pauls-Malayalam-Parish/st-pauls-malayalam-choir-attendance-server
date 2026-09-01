import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { requireAuth, setAuthCookie, clearAuthCookie, signToken } from '../middleware/auth.js';

const router = Router();
const VOICE_PARTS = ['soprano', 'alto', 'tenor', 'bass', 'other'];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait and try again.' },
});

function validateCredentials({ name, email, password, voicePart }) {
  if (name !== undefined && (!name || name.trim().length < 2)) {
    return 'Please enter your full name';
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address';
  }
  if (password !== undefined && (!password || password.length < 8)) {
    return 'Password must be at least 8 characters';
  }
  if (voicePart && !VOICE_PARTS.includes(voicePart)) {
    return 'Please choose a valid voice part';
  }
  return null;
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, voicePart = 'other' } = req.body;
    const error = validateCredentials({ name, email, password, voicePart });
    if (error) return res.status(400).json({ error });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
      voicePart,
      role: 'member',
      approvalStatus: 'pending',
    });

    const token = signToken(user);
    setAuthCookie(res, token);
    return res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Could not create account' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const error = validateCredentials({ email, password });
    if (error) return res.status(400).json({ error });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    if (user.approvalStatus === 'rejected') {
      return res.status(403).json({
        error: 'This registration was not approved. Please contact a choir admin.',
      });
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not sign in' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export default router;
