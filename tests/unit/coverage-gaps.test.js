import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp, appErrorHandler } from '../../src/app.js';
import { buildAdmin, buildUser, authHeader } from '../helpers/fixtures.js';
import { User, Event, Attendance, setFindOneResult, findOneQuery } from '../helpers/model-mocks.js';
import { requireAuth } from '../../src/middleware/auth.js';
import { validateEnv } from '../../src/config/env.js';

describe('coverage gaps', () => {
  const admin = buildAdmin();

  it('enables trust proxy in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const app = createApp();
    expect(app.get('trust proxy')).toBe(1);
    process.env.NODE_ENV = prev;
  });

  it('handles app-level errors through appErrorHandler', async () => {
    const app = express();
    app.get('/fail', (_req, _res, next) => next(new Error('boom')));
    app.use(appErrorHandler);

    const res = await request(app).get('/fail');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Something went wrong');
  });

  it('rejects refresh-type JWT in requireAuth', async () => {
    const app = express();
    app.use(express.json());
    app.get('/secure', requireAuth, (_req, res) => res.json({ ok: true }));

    const token = jwt.sign(
      { id: buildUser()._id.toString(), role: 'member', type: 'refresh' },
      process.env.JWT_SECRET
    );
    const res = await request(app).get('/secure').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });

  it('validates auth register voice part and login password', async () => {
    setFindOneResult(User, null);
    const badVoice = await request(createApp()).post('/api/auth/register').send({
      name: 'Evan Thomas',
      username: 'evan.thomas',
      email: 'evan@stpauls.parish',
      password: 'password123',
      voicePart: 'invalid',
    });
    expect(badVoice.status).toBe(400);

    const noPassword = await request(createApp()).post('/api/auth/login').send({ username: 'evan.thomas' });
    expect(noPassword.status).toBe(400);
  });

  it('covers event validation branches', async () => {
    User.findById.mockResolvedValue(admin);

    const badDate = await request(createApp())
      .post('/api/events')
      .set(authHeader(admin))
      .send({ title: 'X', date: 'not-a-date', type: 'practice' });
    expect(badDate.status).toBe(400);

    const badType = await request(createApp())
      .post('/api/events')
      .set(authHeader(admin))
      .send({ title: 'X', date: '2026-01-10T18:30:00.000Z', type: 'invalid' });
    expect(badType.status).toBe(400);

    const badColor = await request(createApp())
      .post('/api/events')
      .set(authHeader(admin))
      .send({
        title: 'X',
        date: '2026-01-10T18:30:00.000Z',
        type: 'practice',
        liturgicalColor: 'gold',
      });
    expect(badColor.status).toBe(400);
  });

  it('covers attendance admin edge cases', async () => {
    User.findById.mockResolvedValue(admin);

    const badEvent = await request(createApp()).get('/api/attendance/event/bad-id').set(authHeader(admin));
    expect(badEvent.status).toBe(400);

    Event.findById.mockReturnValue({ lean: async () => null });
    const missing = await request(createApp())
      .get('/api/attendance/event/507f1f77bcf86cd799439011')
      .set(authHeader(admin));
    expect(missing.status).toBe(404);

    const badUserFilter = await request(createApp())
      .get('/api/attendance?userId=bad')
      .set(authHeader(admin));
    expect(badUserFilter.status).toBe(400);

    const badRow = await request(createApp())
      .put('/api/attendance/event/507f1f77bcf86cd799439011')
      .set(authHeader(admin))
      .send({ records: [{ userId: 'bad', status: 'present' }] });
    expect(badRow.status).toBe(400);
  });

  it('covers member approval and active validation', async () => {
    User.findById.mockResolvedValue(admin);
    const member = buildUser();
    const id = member._id.toString();

    setFindOneResult(User, member);
    const badApproval = await request(createApp())
      .patch(`/api/members/${id}/approval`)
      .set(authHeader(admin))
      .send({ approvalStatus: 'maybe' });
    expect(badApproval.status).toBe(400);

    const badActive = await request(createApp())
      .patch(`/api/members/${id}/active`)
      .set(authHeader(admin))
      .send({ active: 'yes' });
    expect(badActive.status).toBe(400);
  });

  it('covers validateEnv optional URL and JWT required branches', () => {
    const env = { ...process.env };
    process.env.NODE_ENV = 'development';
    process.env.MONGODB_URI = 'mongodb://in-memory/choir';
    delete process.env.JWT_SECRET;
    expect(() => validateEnv()).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789abcd';
    delete process.env.CLIENT_ORIGIN;
    expect(() => validateEnv()).not.toThrow();

    process.env.CLIENT_ORIGIN = 'not-a-url';
    process.env.NODE_ENV = 'production';
    expect(() => validateEnv()).toThrow(/CLIENT_ORIGIN/);

    process.env = { ...env };
  });

  it('covers request logger error paths', async () => {
    const { requestLogger } = await import('../../src/middleware/request-logger.js');
    const middleware = requestLogger();
    const next = vi.fn();
    const listeners = new Map();
    const res = {
      statusCode: 500,
      setHeader: vi.fn(),
      on: vi.fn((event, cb) => listeners.set(event, cb)),
      removeListener: vi.fn((event) => listeners.delete(event)),
    };

    middleware({ method: 'GET', url: '/api/events', headers: {}, log: { error: vi.fn() } }, res, next);
    listeners.get('finish')?.();
    expect(next).toHaveBeenCalled();
  });
});
