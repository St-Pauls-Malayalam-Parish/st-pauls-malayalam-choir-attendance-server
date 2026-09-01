import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const cookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // GitHub Pages (frontend) and Render (API) are different origins.
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

export function setAuthCookie(res, token) {
  res.cookie('token', token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie('token', cookieOptions());
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.active || user.approvalStatus === 'rejected') {
      return res.status(401).json({ error: 'Sign in required' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only choir admins can do this' });
  }
  next();
}

export function requireApproved(req, res, next) {
  if (req.user.role !== 'admin' && req.user.approvalStatus !== 'approved') {
    return res.status(403).json({ error: 'Your account is waiting for admin approval' });
  }
  next();
}

export const approvedMemberFilter = {
  role: 'member',
  active: true,
  approvalStatus: 'approved',
};
