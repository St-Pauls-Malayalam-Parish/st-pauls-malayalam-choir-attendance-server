import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Attendance } from './models/Attendance.js';
import { emailFromName, parishMembers, usernameFromName } from './data/parish-members.js';
import { normalizeUsername } from './utils/user-fields.js';

dotenv.config();

async function upsertUser({ name, username, email, password, role, voicePart }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.findOneAndUpdate(
    { username },
    { $set: { name, username, email, passwordHash, role, voicePart, active: true, approvalStatus: 'approved' } },
    { upsert: true, new: true }
  );
}

async function seed() {
  await connectDb();

  const adminUsername = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@choir.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'choiradmin';

  await upsertUser({
    name: "St Paul's Choir Admin",
    username: adminUsername,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    voicePart: 'other',
  });

  const parishUsernames = parishMembers.map((member) => usernameFromName(member.name));
  for (const member of parishMembers) {
    const username = usernameFromName(member.name);
    await upsertUser({
      name: member.name,
      username,
      email: emailFromName(member.name),
      password: 'choirpass',
      role: 'member',
      voicePart: 'other',
    });
  }

  const extras = await User.find({
    role: 'member',
    username: { $nin: parishUsernames },
  });
  const extraIds = extras.map((user) => user._id);
  if (extraIds.length) {
    await Attendance.deleteMany({ user: { $in: extraIds } });
    await User.deleteMany({ _id: { $in: extraIds } });
  }

  const importedEvents = await Event.find({ notes: 'parish-import' }).select('_id');
  const importedIds = importedEvents.map((event) => event._id);
  await Event.deleteMany({ notes: { $ne: 'parish-import' } });
  if (importedIds.length) {
    await Attendance.deleteMany({ event: { $nin: importedIds } });
  }

  console.log('Seed complete.');
  console.log(`Admin: ${adminUsername} / ${adminPassword}`);
  console.log(`Parish members: ${parishMembers.length} (from attendance sheet)`);
  console.log('Member login example: angel.benny / choirpass');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
