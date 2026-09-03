import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { normalizeUsername, usernameFromName } from './utils/user-fields.js';

async function backfillUsernames() {
  const users = await User.find({
    $or: [{ username: { $exists: false } }, { username: null }, { username: '' }],
  });

  for (const user of users) {
    let base;
    if (user.role === 'admin') {
      base = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
    } else if (user.email?.includes('@')) {
      base = normalizeUsername(user.email.split('@')[0]);
    } else {
      base = usernameFromName(user.name);
    }

    let username = base;
    let suffix = 2;
    while (await User.findOne({ username, _id: { $ne: user._id } })) {
      username = `${base}${suffix}`;
      suffix += 1;
    }

    user.username = username;
    await user.save();
  }
}

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
  await Event.updateMany({ type: 'rehearsal' }, { $set: { type: 'practice' } });
  await backfillUsernames();
  console.log('Connected to MongoDB');
}
