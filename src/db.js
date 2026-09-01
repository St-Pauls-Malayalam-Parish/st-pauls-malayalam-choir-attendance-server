import mongoose from 'mongoose';
import { User } from './models/User.js';

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  await User.updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: 'approved' } }
  );
  console.log('Connected to MongoDB');
}
