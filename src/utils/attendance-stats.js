import { Attendance } from '../models/Attendance.js';

export function summaryFromCounts(stats = {}) {
  const present = stats.present || 0;
  const absent = stats.absent || 0;
  const late = stats.late || 0;
  const excused = stats.excused || 0;
  const total = stats.total || 0;
  const counted = present + absent + late;
  const rate = counted === 0 ? 0 : Math.round(((present + late) / counted) * 100);
  return { present, absent, late, excused, total, rate };
}

export async function aggregateAttendanceByUsers(userIds, dateRange = null) {
  if (!userIds.length) {
    return new Map();
  }

  const pipeline = [
    { $match: { user: { $in: userIds } } },
    {
      $lookup: {
        from: 'events',
        localField: 'event',
        foreignField: '_id',
        as: 'eventDoc',
      },
    },
    { $unwind: '$eventDoc' },
  ];

  if (dateRange) {
    pipeline.push({ $match: { 'eventDoc.date': dateRange } });
  }

  pipeline.push({
    $group: {
      _id: '$user',
      present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
      late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
      excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
      total: { $sum: 1 },
    },
  });

  const records = await Attendance.aggregate(pipeline);
  return new Map(records.map((row) => [row._id.toString(), row]));
}
