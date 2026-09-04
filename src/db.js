import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info({ database: mongoose.connection.name }, 'Connected to MongoDB');
}

export async function disconnectDb() {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}
