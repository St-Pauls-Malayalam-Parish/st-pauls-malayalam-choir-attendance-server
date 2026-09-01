import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Attendance } from './models/Attendance.js';
import { emailFromName, parishMembers } from './data/parish-members.js';

dotenv.config();

async function upsertUser({ name, email, password, role, voicePart }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.findOneAndUpdate(
    { email },
    { $set: { name, email, passwordHash, role, voicePart, active: true, approvalStatus: 'approved' } },
    { upsert: true, new: true }
  );
}

async function seed() {
  await connectDb();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@choir.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'choiradmin';

  await upsertUser({
    name: "St Paul's Choir Admin",
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
    voicePart: 'other',
  });

  const parishEmails = parishMembers.map((member) => emailFromName(member.name));
  for (const member of parishMembers) {
    await upsertUser({
      name: member.name,
      email: emailFromName(member.name),
      password: 'choirpass',
      role: 'member',
      voicePart: 'other',
    });
  }

  const extras = await User.find({
    role: 'member',
    email: { $nin: parishEmails },
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
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Parish members: ${parishMembers.length} (from attendance sheet)`);
  console.log('Member login example: angel.benny@choir.local / choirpass');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
