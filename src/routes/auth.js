import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import {
  clearAuthCookies,
  issueAuthSession,
  readRefreshToken,
  requireAuth,
  revokeRefreshToken,
  sessionScopeForUser,
} from '../middleware/auth.js';
import { hashRefreshToken } from '../utils/tokens.js';
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

function wantsBearerTokens(req) {
  return req.headers['x-auth-client'] === 'bearer';
}

function sendAuthResponse(res, statusCode, session, req) {
  const body = { user: session.user };
  if (wantsBearerTokens(req)) {
    body.token = session.accessToken;
    body.refreshToken = session.refreshToken;
  }
  return res.status(statusCode).json(body);
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

  const session = await issueAuthSession(res, user);
  return sendAuthResponse(res, 201, session, req);
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

  const session = await issueAuthSession(res, user);
  return sendAuthResponse(res, 200, session, req);
}));

router.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const hash = hashRefreshToken(refreshToken);
  const user = await User.findOne({ refreshTokenHash: hash }).select(
    '+refreshTokenHash +refreshTokenExpiresAt'
  );

  if (
    !user ||
    !user.active ||
    user.approvalStatus === 'rejected' ||
    !user.refreshTokenExpiresAt ||
    user.refreshTokenExpiresAt < new Date()
  ) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const session = await issueAuthSession(res, user);
  return sendAuthResponse(res, 200, session, req);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  await revokeRefreshToken(readRefreshToken(req));
  clearAuthCookies(res);
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const scope = sessionScopeForUser(req.user);
  if (req.authScope === 'pending' && scope === 'full') {
    const session = await issueAuthSession(res, req.user);
    const body = { user: session.user };
    if (wantsBearerTokens(req)) {
      body.token = session.accessToken;
      body.refreshToken = session.refreshToken;
    }
    return res.json(body);
  }

  res.json({ user: req.user.toSafeJSON() });
}));

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

  const session = await issueAuthSession(res, req.user);
  const body = { ok: true };
  if (wantsBearerTokens(req)) {
    body.token = session.accessToken;
    body.refreshToken = session.refreshToken;
  }
  return res.json(body);
}));

export default router;
