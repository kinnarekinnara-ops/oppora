// =============================================================
// savedRoutes.js — bookmark + track opportunities (Student Portal §8–9).
// =============================================================
const db = require('../services/db');
const { HttpError, readBody } = require('../lib/http');
const auth = require('../middleware/auth');
const { getMatch } = require('../services/matchingEngine');
const { presentOpp, matchSummary } = require('../services/present');
const { TRACKING_STATUSES } = require('../config/constants');
const { sendDeadlineReminders } = require('../services/notificationService');

function register(router) {
  router.get('/api/saved', auth.requireStudent, async (req) => {
    const items = db.read('saved')
      .filter((s) => s.studentId === req.user.id)
      .map((s) => {
        const opp = db.findById('opportunities', s.opportunityId);
        if (!opp) return null;
        return { ...presentOpp(opp), trackingStatus: s.trackingStatus, savedAt: s.savedAt, note: s.note || '', match: matchSummary(getMatch(req.user.id, opp.id)) };
      })
      .filter(Boolean)
      .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    return { items };
  });

  router.post('/api/saved/:id', auth.requireStudent, async (req) => {
    const opp = db.findById('opportunities', req.params.id);
    if (!opp || !['published', 'closed'].includes(opp.status)) throw new HttpError(404, 'Opportunity not found.');
    const rows = db.read('saved');
    if (!rows.some((s) => s.studentId === req.user.id && s.opportunityId === opp.id)) {
      rows.push({ id: db.newId('sav'), studentId: req.user.id, opportunityId: opp.id, trackingStatus: 'saved', savedAt: new Date().toISOString() });
      db.write('saved', rows);
      sendDeadlineReminders(); // if it's already close to the deadline, remind straight away
    }
    return { saved: true };
  });

  router.put('/api/saved/:id', auth.requireStudent, async (req) => {
    const body = await readBody(req);
    const rows = db.read('saved');
    const row = rows.find((s) => s.studentId === req.user.id && s.opportunityId === req.params.id);
    if (!row) throw new HttpError(404, 'This opportunity is not in your saved list.');
    if (body.trackingStatus !== undefined) {
      if (!TRACKING_STATUSES.includes(body.trackingStatus)) throw new HttpError(400, 'Invalid status.');
      row.trackingStatus = body.trackingStatus;
    }
    if (body.note !== undefined) row.note = String(body.note).slice(0, 300);
    db.write('saved', rows);
    return { ok: true };
  });

  router.delete('/api/saved/:id', auth.requireStudent, async (req) => {
    db.remove('saved', (s) => s.studentId === req.user.id && s.opportunityId === req.params.id);
    return { saved: false };
  });
}

module.exports = { register };
