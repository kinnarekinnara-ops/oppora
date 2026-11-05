// =============================================================
// statusScheduler.js — background job that runs every minute:
//   • closes opportunities whose registration deadline has passed
//   • sends deadline reminders for saved opportunities
// (Admin Portal §4.5: "automatically close opportunities when their
//  registration deadlines pass")
// =============================================================
const db = require('./db');
const { isPast } = require('../lib/dates');
const { sendDeadlineReminders } = require('./notificationService');
const { log } = require('./activityLogger');

function runOnce() {
  const opps = db.read('opportunities');
  let closed = 0;
  for (const o of opps) {
    if ((o.status === 'published' || o.status === 'paused') && isPast(o.deadline)) {
      o.status = 'closed';
      o.closedAt = new Date().toISOString();
      closed++;
      log(null, 'opportunity.auto_closed', { type: 'opportunity', id: o.id, name: o.title }, 'Registration deadline passed');
    }
  }
  if (closed) db.write('opportunities', opps);
  const reminders = sendDeadlineReminders();
  return { closed, reminders };
}

function start(intervalMs = 60 * 1000) {
  runOnce();
  return setInterval(runOnce, intervalMs).unref();
}

module.exports = { start, runOnce };
