const EVENT_TYPES = ['practice', 'service', 'concert', 'other'];
const LITURGICAL_COLORS = ['white', 'green', 'purple', 'red', 'black'];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEventDateFilter(query) {
  const bounds = {};

  if (query.year) {
    const year = Number(query.year);
    if (!Number.isNaN(year)) {
      bounds.min = new Date(`${year}-01-01T00:00:00`);
      bounds.max = new Date(`${year}-12-31T23:59:59.999`);
    }
  }

  const from = parseDayBounds(query.from, false);
  if (from?.error) return { error: from.error };
  const to = parseDayBounds(query.to, true);
  if (to?.error) return { error: to.error };
  if (from?.date && to?.date && from.date > to.date) {
    return { error: 'Start date must be on or before the end date' };
  }

  if (from?.date) {
    bounds.min = bounds.min ? new Date(Math.max(bounds.min.getTime(), from.date.getTime())) : from.date;
  }
  if (to?.date) {
    bounds.max = bounds.max ? new Date(Math.min(bounds.max.getTime(), to.date.getTime())) : to.date;
  }

  if (bounds.min && bounds.max && bounds.min > bounds.max) {
    return { filter: { _id: { $exists: false } } };
  }

  const date = {};
  if (bounds.min) date.$gte = bounds.min;
  if (bounds.max) date.$lte = bounds.max;
  return { filter: Object.keys(date).length ? { date } : {} };
}

function parseDayBounds(value, endOfDay) {
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

export function parsePagination(query) {
  const page = Math.max(DEFAULT_PAGE, Number.parseInt(query.page, 10) || DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT)
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

export function buildPaginationMeta({ page, pageSize, total }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * pageSize;
  const rangeEnd = Math.min(skip + pageSize, total);

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    rangeStart: total === 0 ? 0 : skip + 1,
    rangeEnd,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

export function buildEventFilter(query) {
  const filter = {};
  const search = typeof query.search === 'string' ? query.search.trim() : '';

  if (search) {
    const term = escapeRegex(search);
    filter.$or = [
      { title: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
    ];
  }

  if (query.type && EVENT_TYPES.includes(query.type)) {
    filter.type = query.type;
  }

  if (query.liturgicalColor) {
    if (query.liturgicalColor === '__none__') {
      filter.liturgicalColor = '';
    } else if (LITURGICAL_COLORS.includes(query.liturgicalColor)) {
      filter.liturgicalColor = query.liturgicalColor;
    }
  }

  const dateFilter = buildEventDateFilter(query);
  if (dateFilter.error) {
    return { error: dateFilter.error };
  }

  return { filter: { ...filter, ...dateFilter.filter } };
}
