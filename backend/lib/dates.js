// Date helpers. Deadlines are stored as "YYYY-MM-DD" and count as
// open until the END of that day (local server time).

function endOfDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59`);
  return isNaN(d) ? null : d;
}

function daysUntil(dateStr) {
  const d = endOfDay(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function isPast(dateStr) {
  const d = endOfDay(dateStr);
  return d ? d < new Date() : false;
}

/** YYYY-MM-DD for "today + n days" (used by the seed script). */
function fromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = { endOfDay, daysUntil, isPast, fromToday };
