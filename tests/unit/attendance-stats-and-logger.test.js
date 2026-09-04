import { describe, expect, it, vi } from 'vitest';
import { Attendance } from '../helpers/model-mocks.js';
import { aggregateAttendanceByUsers } from '../../src/utils/attendance-stats.js';
import { userId } from '../helpers/fixtures.js';

describe('aggregateAttendanceByUsers (mocked Attendance.aggregate)', () => {
  it('returns empty map when no user ids', async () => {
    const result = await aggregateAttendanceByUsers([]);
    expect(result.size).toBe(0);
    expect(Attendance.aggregate).not.toHaveBeenCalled();
  });

  it('aggregates stats per user without date filter', async () => {
    const id = userId();
    Attendance.aggregate.mockResolvedValue([
      { _id: id, present: 3, absent: 1, late: 1, excused: 0, total: 5 },
    ]);

    const result = await aggregateAttendanceByUsers([id]);
    expect(Attendance.aggregate).toHaveBeenCalled();
    expect(result.get(id.toString())).toMatchObject({ present: 3, total: 5 });
  });

  it('applies date range to aggregation pipeline', async () => {
    const id = userId();
    const range = { $gte: new Date('2026-01-01'), $lte: new Date('2026-01-31') };
    Attendance.aggregate.mockResolvedValue([]);

    await aggregateAttendanceByUsers([id], range);
    const pipeline = Attendance.aggregate.mock.calls[0][0];
    expect(pipeline.some((stage) => stage.$match?.['eventDoc.date'])).toBe(true);
  });
});

describe('request logger', () => {
  it('skips health checks and assigns request ids', async () => {
    const { requestLogger } = await import('../../src/middleware/request-logger.js');
    const middleware = requestLogger();
    const next = vi.fn();
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      on: vi.fn(),
    };

    middleware({ method: 'GET', url: '/api/health', headers: {} }, res, next);
    expect(next).toHaveBeenCalled();

    middleware(
      { method: 'GET', url: '/api/events', headers: { 'x-request-id': 'req-123' } },
      res,
      next
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-123');
  });
});
