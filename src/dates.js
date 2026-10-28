// Local-calendar date helpers shared by the browser app (window.Dates) and the Node tests.
// Dates are 'YYYY-MM-DD' strings and times are 'HH:MM' strings in the user's own time zone,
// so a task due on the 3rd stays on the 3rd regardless of daylight saving or travel.
(function (root) {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const pad = (n) => String(n).padStart(2, '0');

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function isValidDate(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && toISODate(parseISODate(iso)) === iso;
  }

  function isValidTime(time) {
    return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  }

  function addDays(iso, n) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  // Clamps to the end of shorter months, so Jan 31 + 1 month is Feb 28 (or 29).
  function addMonths(iso, n) {
    const d = parseISODate(iso);
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), lastDay));
    return toISODate(target);
  }

  // Whole calendar days from `from` to `to` (negative when `to` is earlier).
  function daysBetween(from, to) {
    const utc = (iso) => {
      const [y, m, d] = iso.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((utc(to) - utc(from)) / 86400000);
  }

  function weekday(iso) {
    return parseISODate(iso).getDay();
  }

  function startOfMonth(iso) {
    return iso.slice(0, 8) + '01';
  }

  // '13:00' -> '1 PM', '18:30' -> '6:30 PM'
  function formatTime(time) {
    const [h, m] = time.split(':').map(Number);
    const hour = h % 12 || 12;
    const suffix = h < 12 ? 'AM' : 'PM';
    return m ? `${hour}:${pad(m)} ${suffix}` : `${hour} ${suffix}`;
  }

  // Short, relative where it helps: 'Today', 'Tomorrow', 'Fri', 'Nov 12', 'Jan 3, 2027'.
  function formatDate(iso, today) {
    const diff = daysBetween(today, iso);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return WEEKDAYS[weekday(iso)];
    const d = parseISODate(iso);
    const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    return iso.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${d.getFullYear()}`;
  }

  function formatMonth(iso) {
    const d = parseISODate(iso);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Every day shown on a month calendar: whole weeks, Sunday first.
  function monthGrid(iso) {
    const first = startOfMonth(iso);
    const last = addDays(addMonths(first, 1), -1);
    const days = [];
    for (let d = addDays(first, -weekday(first)); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  }

  // The first date in a repeating series (starting at `anchor`) that falls strictly after `after`.
  // Counting from the anchor keeps a monthly task on the 31st from drifting to the 28th.
  function nextOccurrence(anchor, rule, after) {
    switch (rule) {
      case 'daily':
        return anchor > after ? anchor : addDays(after, 1);
      case 'weekdays': {
        let d = anchor > after ? anchor : addDays(after, 1);
        while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
        return d;
      }
      case 'weekly':
        if (anchor > after) return anchor;
        return addDays(anchor, (Math.floor(daysBetween(anchor, after) / 7) + 1) * 7);
      case 'monthly':
      case 'yearly': {
        const step = rule === 'monthly' ? 1 : 12;
        const a = parseISODate(anchor);
        const b = parseISODate(after);
        const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
        let k = Math.max(0, Math.floor(months / step));
        let d = addMonths(anchor, k * step);
        while (d <= after) d = addMonths(anchor, ++k * step);
        return d;
      }
      default:
        return null;
    }
  }

  // All occurrences strictly after `after` and on or before `end` (capped for safety).
  function occurrencesAfter(anchor, rule, after, end) {
    const dates = [];
    for (let d = nextOccurrence(anchor, rule, after); d && d <= end && dates.length < 62; d = nextOccurrence(anchor, rule, d)) {
      dates.push(d);
    }
    return dates;
  }

  const api = {
    toISODate, toTime, parseISODate, isValidDate, isValidTime, addDays, addMonths, daysBetween,
    startOfMonth, formatTime, formatDate, formatMonth, monthGrid, nextOccurrence, occurrencesAfter,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Dates = api;
})(globalThis);
