import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp, appErrorHandler } from '../../src/app.js';

describe('app error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(createApp()).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('maps duplicate key errors to 409 via appErrorHandler', async () => {
    const app = express();
    app.get('/boom-username', (_req, _res, next) => {
      next({ code: 11000, keyPattern: { username: 1 } });
    });
    app.get('/boom-email', (_req, _res, next) => {
      next({ code: 11000, keyPattern: { email: 1 } });
    });
    app.get('/boom-generic', (_req, _res, next) => {
      next(new Error('fail'));
    });
    app.use(appErrorHandler);

    expect((await request(app).get('/boom-username')).status).toBe(409);
    expect((await request(app).get('/boom-email')).body.error).toMatch(/email/);
    expect((await request(app).get('/boom-generic')).status).toBe(500);
  });

  it('returns 503 when shutting down', async () => {
    const app = createApp({ getIsShuttingDown: () => true });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/shutting down/i);
  });
});
