import '../helpers/mongoose-mock.js';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { audit, getRequestLog, logger } from '../../src/logger.js';
import { connectDb, disconnectDb } from '../../src/db.js';
import { attachGracefulShutdown, shuttingDownMiddleware } from '../../src/graceful-shutdown.js';
import { mongooseMock } from '../helpers/mongoose-mock.js';

vi.mock('../../src/db.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    disconnectDb: vi.fn(async (...args) => actual.disconnectDb(...args)),
  };
});

import { disconnectDb as disconnectDbSpy } from '../../src/db.js';

describe('logger', () => {
  it('audit writes structured log', () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const req = { log: { info: vi.fn() }, user: { _id: '1', username: 'a' }, ip: '127.0.0.1' };
    audit('test.event', req, { extra: true });
    expect(req.log.info).toHaveBeenCalled();
    audit('test.event', { ip: '1.2.3.4' });
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });

  it('getRequestLog falls back to root logger', () => {
    expect(getRequestLog({})).toBe(logger);
    expect(getRequestLog({ log: { info: vi.fn() } }).info).toBeTypeOf('function');
  });
});

describe('db (in-memory mongoose mock)', () => {
  it('connectDb requires MONGODB_URI', async () => {
    const uri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    await expect(connectDb()).rejects.toThrow(/MONGODB_URI/);
    process.env.MONGODB_URI = uri;
  });

  it('connectDb uses mocked mongoose.connect without a real database', async () => {
    await connectDb();
    expect(mongooseMock.connect).toHaveBeenCalledWith(process.env.MONGODB_URI);
    expect(mongooseMock.set).toHaveBeenCalledWith('strictQuery', true);
  });

  it('disconnectDb skips when already disconnected', async () => {
    mongooseMock.connection.readyState = 0;
    await disconnectDb();
    expect(mongooseMock.disconnect).not.toHaveBeenCalled();
  });

  it('disconnectDb calls mocked mongoose.disconnect', async () => {
    mongooseMock.connection.readyState = 1;
    await disconnectDb();
    expect(mongooseMock.disconnect).toHaveBeenCalled();
  });
});

describe('graceful shutdown', () => {
  let exitSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    exitSpy.mockRestore();
  });

  it('returns 503 when shutting down', () => {
    const mw = shuttingDownMiddleware(() => true);
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();
    mw({}, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when not shutting down', () => {
    const mw = shuttingDownMiddleware(() => false);
    const next = vi.fn();
    mw({}, { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }, next);
    expect(next).toHaveBeenCalled();
  });

  it('handles shutdown lifecycle', async () => {
    const server = {
      on: vi.fn((event, cb) => {
        if (event === 'connection') {
          const socket = { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
          cb(socket);
        }
      }),
      close: vi.fn((cb) => cb()),
    };

    const { shutdown, isShuttingDown } = attachGracefulShutdown(server);
    expect(isShuttingDown()).toBe(false);
    shutdown('SIGTERM');
    expect(isShuttingDown()).toBe(true);
    shutdown('SIGTERM');

    await vi.waitFor(() => expect(disconnectDbSpy).toHaveBeenCalled());
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
  });

  it('force shutdown on timeout', async () => {
    vi.useFakeTimers();
    const socket = { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
    const server = {
      on: vi.fn((event, cb) => {
        if (event === 'connection') cb(socket);
      }),
      close: vi.fn(),
    };

    const { shutdown } = attachGracefulShutdown(server);
    shutdown('SIGINT');
    await vi.advanceTimersByTimeAsync(10_001);
    expect(socket.destroy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error when server.close fails', async () => {
    const server = {
      on: vi.fn(),
      close: vi.fn((cb) => cb(new Error('close failed'))),
    };
    const { shutdown } = attachGracefulShutdown(server);
    shutdown('SIGTERM');
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));
  });
});
