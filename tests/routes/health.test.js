import '../helpers/mongoose-mock.js';
import '../helpers/model-mocks.js';
import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { setDbConnected, setDbPingFails } from '../helpers/mongoose-mock.js';

describe('GET /api/health', () => {
  beforeEach(() => {
    setDbConnected(true);
  });

  it('returns 200 when database is connected', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.database.connected).toBe(true);
  });

  it('returns 503 when database ping fails', async () => {
    setDbConnected(false);
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  it('returns 503 when connected but ping throws', async () => {
    setDbPingFails();
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.database.connected).toBe(false);
  });
});
