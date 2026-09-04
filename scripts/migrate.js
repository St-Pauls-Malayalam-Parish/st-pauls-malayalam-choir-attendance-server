import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/db.js';
import { User } from '../src/models/User.js';
import { Event } from '../models/Event.js';
import { normalizeUsername, usernameFromName } from '../src/utils/user-fields.js';

dotenv.config();

async function backfillApprovalStatus() {
  const result = await User.updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: 'approved' } }
  );
  console.log(`approvalStatus backfill: ${result.modifiedCount} user(s) updated`);
}

async function renameRehearsalEvents() {
  const result = await Event.updateMany({ type: 'rehearsal' }, { $set: { type: 'practice' } });
  console.log(`rehearsal → practice: ${result.modifiedCount} event(s) updated`);
}

async function backfillUsernames() {
  const users = await User.find({
    $or: [{ username: { $exists: false } }, { username: null }, { username: '' }],
  });

  let updated = 0;
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
    updated += 1;
  }

  console.log(`username backfill: ${updated} user(s) updated`);
}

async function migrate() {
  await connectDb();
  await backfillApprovalStatus();
  await renameRehearsalEvents();
  await backfillUsernames();
}

migrate()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message || err);
    await disconnectDb().catch(() => {});
    process.exit(1);
  });
