import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { validateEnv } from './config/env.js';
import { connectDb, disconnectDb } from './db.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import attendanceRoutes from './routes/attendance.js';
import memberRoutes from './routes/members.js';
import healthRoutes from './routes/health.js';

dotenv.config();

try {
  validateEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT) || 4000;
let server;

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

app.use('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/members', memberRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message =
      field === 'username'
        ? 'This username is already taken'
        : 'An account with this email already exists';
    return res.status(409).json({ error: message });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  if (!server) {
    disconnectDb()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    return;
  }

  server.close(() => {
    disconnectDb()
      .then(() => {
        console.log('Server stopped');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during shutdown', err);
        process.exit(1);
      });
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

connectDb()
  .then(() => {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`Choir API listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
