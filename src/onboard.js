import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Attendance } from './models/Attendance.js';
import { emailFromName, parishMembers, usernameFromName } from './data/parish-members.js';
import { normalizeUsername } from './utils/user-fields.js';

dotenv.config();

const IMPORT_NOTE = 'parish-import';
const SESSION_COUNT = 20;

function importDates() {
  const dates = [];
  const last = new Date('2026-08-30T10:00:00');
  for (let i = SESSION_COUNT - 1; i >= 0; i -= 1) {
    const date = new Date(last);
    date.setDate(last.getDate() - i * 7);
    dates.push(date);
  }
  return dates;
}

async function onboard() {
  await connectDb();

  const adminUsername = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
  const admin = await User.findOne({ username: adminUsername, role: 'admin' });
  if (!admin) {
    throw new Error('Create the admin account first with npm run seed');
  }

  const password = process.env.MEMBER_PASSWORD || 'choirpass';
  const passwordHash = await bcrypt.hash(password, 12);
  const members = [];

  for (const member of parishMembers) {
    const username = usernameFromName(member.name);
    const email = emailFromName(member.name);
    const user = await User.findOneAndUpdate(
      { username },
      {
        $set: {
          name: member.name,
          username,
          email,
          passwordHash,
          role: 'member',
          voicePart: 'other',
          active: true,
          approvalStatus: 'approved',
        },
      },
      { upsert: true, new: true }
    );
    members.push({ user, present: member.present, absent: member.absent });
  }

  const existing = await Event.find({ notes: IMPORT_NOTE });
  if (existing.length) {
    const ids = existing.map((event) => event._id);
    await Attendance.deleteMany({ event: { $in: ids } });
    await Event.deleteMany({ _id: { $in: ids } });
  }

  const events = await Event.insertMany(
    importDates().map((date, index) => ({
      title: index % 2 === 0 ? 'Sunday service' : 'Choir practice',
      date,
      type: index % 2 === 0 ? 'service' : 'rehearsal',
      notes: IMPORT_NOTE,
      createdBy: admin._id,
    }))
  );

  const docs = [];
  for (const member of members) {
    const presentCount = Math.min(member.present, events.length);
    for (const [index, event] of events.entries()) {
      docs.push({
        user: member.user._id,
        event: event._id,
        status: index < presentCount ? 'present' : 'absent',
        markedBy: admin._id,
      });
    }
  }
  await Attendance.insertMany(docs);

  console.log(`Onboarded ${members.length} approved members from the attendance report.`);
  console.log('Temporary password for all of them: ' + password);
  console.log('Username pattern: firstname.lastname');
  console.log('Example: angel.benny');
  process.exit(0);
}

onboard().catch((err) => {
  console.error(err);
  process.exit(1);
});
