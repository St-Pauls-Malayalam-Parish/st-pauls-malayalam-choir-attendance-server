import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { validateEnv } from './config/env.js';
import { connectDb } from './db.js';
import { attachGracefulShutdown, shuttingDownMiddleware } from './graceful-shutdown.js';
import { logger, getRequestLog } from './logger.js';
import { requestLogger } from './middleware/request-logger.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import attendanceRoutes from './routes/attendance.js';
import memberRoutes from './routes/members.js';
import healthRoutes from './routes/health.js';

dotenv.config();

try {
  validateEnv();
} catch (err) {
  logger.fatal({ err }, err.message);
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT) || 4000;

let shutdownState = { isShuttingDown: () => false };

// Render terminates TLS and forwards requests; trust one proxy hop for req.ip / rate limits.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, res, next) => shuttingDownMiddleware(shutdownState.isShuttingDown)(req, res, next));
app.use(requestLogger());

app.use('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/members', memberRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message =
      field === 'username'
        ? 'This username is already taken'
        : 'An account with this email already exists';
    return res.status(409).json({ error: message });
  }

  getRequestLog(req).error(
    {
      err,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?._id?.toString(),
      username: req.user?.username,
    },
    'Unhandled request error'
  );
  res.status(500).json({ error: 'Something went wrong' });
});

connectDb()
  .then(() => {
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info({ port }, 'Choir API listening');
    });
    shutdownState = attachGracefulShutdown(server);
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
