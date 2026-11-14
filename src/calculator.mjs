/** Pure calculation and date utilities for LeadPredictor. No external dependencies. */
const MAX_PEOPLE = Number.MAX_SAFE_INTEGER;

/**
 * Calculate the minimum number of people required at each stage of the funnel.
 * The user-provided rates are percentages from 0 to 100.
 * Values are rounded UP because a fraction of a person cannot satisfy a target.
 * Infinity means the target cannot be achieved at a 0% conversion rate.
 */
export function calculateForecast({ revenue, orderValue, leadRate, prospectRate }) {
  const rawValues = [revenue, orderValue, leadRate, prospectRate];
  // Empty HTML number fields must not silently become zero (Number('') === 0).
  if (rawValues.some((value) => value === '' || value === null || value === undefined || typeof value === 'string' && value.trim() === '')) {
    return { valid: false, error: 'invalidNumbers' };
  }
  const values = rawValues.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return { valid: false, error: 'invalidNumbers' };
  }
  const [targetRevenue, averageOrder, leadResponse, prospectResponse] = values;
  if (targetRevenue < 0 || averageOrder <= 0 || leadResponse < 0 || leadResponse > 100 || prospectResponse < 0 || prospectResponse > 100) {
    return { valid: false, error: 'invalidNumbers' };
  }

  const customers = Math.ceil(targetRevenue / averageOrder);
  const leads = customers === 0 ? 0 : leadResponse === 0 ? Infinity : Math.ceil(customers * 100 / leadResponse);
  const prospects = leads === 0 ? 0 : prospectResponse === 0 ? Infinity : Math.ceil(leads * 100 / prospectResponse);
  if ([customers, leads, prospects].some((count) => count > MAX_PEOPLE && Number.isFinite(count))) {
    return { valid: false, error: 'numbersTooLarge' };
  }

  return {
    valid: true,
    customers,
    leads,
    prospects,
    leadShare: Number.isFinite(prospects) && prospects > 0 ? (leads / prospects) * 100 : 0,
    customerShare: Number.isFinite(prospects) && prospects > 0 ? (customers / prospects) * 100 : 0,
    responseLead: leadResponse,
    responseProspect: prospectResponse,
  };
}

/** Parse a strict YYYY-MM-DD ISO date, accounting for leap years. */
export function parseISODate(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

const DAY_MS = 86400000;
function dayNumber(date) { return Math.floor(date.getTime() / DAY_MS); }
function isoDay(date) { return date.toISOString().slice(0, 10); }

/** Return up to maxBars contiguous, duration-weighted period buckets. */
export function getMonthlyBuckets(startISO, endISO, maxBars = 8) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end || dayNumber(end) < dayNumber(start)) return { valid: false, error: 'invalidDates', buckets: [] };
  if (!Number.isInteger(maxBars) || maxBars < 1) return { valid: false, error: 'invalidDates', buckets: [] };

  const months = [];
  let cursorYear = start.getUTCFullYear();
  let cursorMonth = start.getUTCMonth();
  while (cursorYear < end.getUTCFullYear() || (cursorYear === end.getUTCFullYear() && cursorMonth <= end.getUTCMonth())) {
    // Long ranges are not useful for a monthly chart; protect the browser.
    if (months.length >= 600) return { valid: false, error: 'dateRangeTooLarge', buckets: [] };
    const monthStart = new Date(Date.UTC(cursorYear, cursorMonth, 1, 12));
    const nextMonth = new Date(Date.UTC(cursorYear, cursorMonth + 1, 1, 12));
    const monthEnd = new Date(nextMonth.getTime() - DAY_MS);
    const first = new Date(Math.max(start.getTime(), monthStart.getTime()));
    const last = new Date(Math.min(end.getTime(), monthEnd.getTime()));
    months.push({ start: isoDay(first), end: isoDay(last), days: dayNumber(last) - dayNumber(first) + 1 });
    cursorMonth += 1;
    if (cursorMonth === 12) { cursorMonth = 0; cursorYear += 1; }
  }

  const groupSize = Math.max(1, Math.ceil(months.length / maxBars));
  const buckets = [];
  const totalDays = months.reduce((sum, item) => sum + item.days, 0);
  let elapsed = 0;
  for (let i = 0; i < months.length; i += groupSize) {
    const group = months.slice(i, i + groupSize);
    const days = group.reduce((sum, item) => sum + item.days, 0);
    elapsed += days;
    buckets.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      days,
      portion: elapsed / totalDays,
      grouped: group.length > 1,
    });
  }
  return { valid: true, buckets, totalDays };
}

/** Locale-aware, rounded-up display. Infinity is displayed as an em dash in the app. */
export function peopleText(value, language = 'bg') {
  return Number.isFinite(value) ? new Intl.NumberFormat(language === 'bg' ? 'bg-BG' : 'en-US', { maximumFractionDigits: 0 }).format(value) : '—';
}

export function formatPercent(value, language = 'bg') {
  return new Intl.NumberFormat(language === 'bg' ? 'bg-BG' : 'en-US', { maximumFractionDigits: 1 }).format(value) + '%';
}
