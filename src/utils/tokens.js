import crypto from 'node:crypto';

export const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_TTL_MS = Number(process.env.JWT_REFRESH_EXPIRES_MS || 7 * 24 * 60 * 60 * 1000);

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
