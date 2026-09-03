export function parseDay(value, endOfDay) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: 'Dates must be in YYYY-MM-DD format' };
  }
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  if (Number.isNaN(date.getTime())) {
    return { error: 'Invalid date' };
  }
  return { date };
}

export function eventDateQuery(from, to) {
  const start = parseDay(from, false);
  const end = parseDay(to, true);
  if (start?.error) return { error: start.error };
  if (end?.error) return { error: end.error };
  if (start?.date && end?.date && start.date > end.date) {
    return { error: 'Start date must be on or before the end date' };
  }
  const range = {};
  if (start?.date) range.$gte = start.date;
  if (end?.date) range.$lte = end.date;
  return { range: Object.keys(range).length ? range : null };
}
