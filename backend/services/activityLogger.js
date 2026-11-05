// activityLogger.js — records administrative actions (Admin Portal §11).
const db = require('./db');

function log(actor, action, target = {}, details = '') {
  const entry = {
    id: db.newId('log'),
    actorId: actor ? actor.id : 'system',
    actorName: actor ? actor.name : 'OPPORA System',
    actorRole: actor ? actor.role : 'system',
    action, // e.g. 'opportunity.published'
    targetType: target.type || null,
    targetId: target.id || null,
    targetName: target.name || null,
    details,
    at: new Date().toISOString(),
  };
  const logs = db.read('activity_logs');
  logs.unshift(entry);
  db.write('activity_logs', logs.slice(0, 2000)); // keep the file small
  return entry;
}

module.exports = { log };
