// =============================================================
// notificationService.js — creates in-app notifications.
// Respects each student's notification preferences and prevents
// duplicates with a "dedupeKey" (Matching doc §11.4).
// =============================================================
const db = require('./db');
const { daysUntil } = require('../lib/dates');
const { DEADLINE_REMINDER_DAYS } = require('../config/constants');

const PREF_FOR_TYPE = {
  new_match: 'newMatches',
  general: 'general',
  deadline: 'deadlines',
  update: 'updates',
};

/** Returns true if a notification was created. */
function notify({ student, type, opportunity, title, message, dedupeKey }) {
  const prefs = student.notificationPrefs || {};
  const prefKey = PREF_FOR_TYPE[type];
  if (prefKey && prefs[prefKey] === false) return false;

  const all = db.read('notifications');
  if (dedupeKey && all.some((n) => n.dedupeKey === dedupeKey)) return false;

  all.unshift({
    id: db.newId('ntf'),
    studentId: student.id,
    type,
    opportunityId: opportunity ? opportunity.id : null,
    title,
    message,
    read: false,
    dedupeKey: dedupeKey || null,
    createdAt: new Date().toISOString(),
  });
  db.write('notifications', all);
  return true;
}

/** Remind students about SAVED opportunities whose deadline is close. */
function sendDeadlineReminders() {
  const saved = db.read('saved');
  const students = db.read('students');
  let sent = 0;
  for (const s of saved) {
    if (s.trackingStatus === 'completed' || s.trackingStatus === 'registered') continue;
    const opp = db.findById('opportunities', s.opportunityId);
    if (!opp || opp.status !== 'published') continue;
    const days = daysUntil(opp.deadline);
    if (days === null || days < 0 || days > DEADLINE_REMINDER_DAYS) continue;
    const student = students.find((x) => x.id === s.studentId);
    if (!student) continue;
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    if (notify({
      student,
      type: 'deadline',
      opportunity: opp,
      title: `Deadline ${when}: ${opp.title}`,
      message: `Registration for "${opp.title}" closes ${when}. Don't miss it!`,
      dedupeKey: `deadline:${opp.id}:${student.id}`,
    })) sent++;
  }
  return sent;
}

module.exports = { notify, sendDeadlineReminders };
