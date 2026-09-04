import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../logger.js';

export function requestLogger() {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const existing = req.headers['x-request-id'];
      const id = existing ? String(existing) : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url} failed: ${err?.message || res.statusCode}`;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    autoLogging: {
      ignore(req) {
        return req.url === '/api/health' || req.url?.startsWith('/api/health?');
      },
    },
    customProps(req) {
      const props = {};
      if (req.user?._id) {
        props.userId = req.user._id.toString();
        props.username = req.user.username;
      }
      return props;
    },
  });
}
