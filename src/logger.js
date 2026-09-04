import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const defaultLevel = isProduction ? 'info' : 'debug';

export const logger = pino({
  level: process.env.LOG_LEVEL || defaultLevel,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export function getRequestLog(req) {
  return req.log || logger;
}

/** Structured audit events — never pass passwords or tokens in fields. */
export function audit(event, req, fields = {}) {
  getRequestLog(req).info(
    {
      audit: event,
      userId: req.user?._id?.toString(),
      username: req.user?.username,
      ip: req.ip,
      ...fields,
    },
    event
  );
}
