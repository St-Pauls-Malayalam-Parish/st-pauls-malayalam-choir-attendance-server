import { afterEach, vi } from 'vitest';
import './helpers/mongoose-mock.js';
import './helpers/model-mocks.js';
import { mongooseMock, resetMongooseMock } from './helpers/mongoose-mock.js';
import { resetModelMocks } from './helpers/model-mocks.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-enough-length-for-dev';
process.env.MONGODB_URI = 'mongodb://in-memory/choir-test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_MS = '604800000';

vi.mock('express-rate-limit', () => ({
  default: () => (_req, _res, next) => next(),
}));

afterEach(() => {
  resetModelMocks();
  resetMongooseMock();
});
