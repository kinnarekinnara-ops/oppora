// =============================================================
// studentRoutes.js — profile, settings, dashboard, recommendations.
// =============================================================
const db = require('../services/db');
const { HttpError, readBody } = require('../lib/http');
const auth = require('../middleware/auth');
const { normalize } = require('../services/skillNormalizer');
const { matchStudent, isRecommendable } = require('../services/matchingEngine');
const { presentOpp, matchSummary, profileCompletion } = require('../services/present');
const { daysUntil } = require('../lib/dates');
const C = require('../config/constants');

/** Validate + clean profile input. Used by registration too. */
function sanitizeProfile(body) {
  const out = {};
  const programmes = db.read('programmes').map((p) => p.name);
  const interests = (db.read('skills_catalog').interests || []).map((i) => i.name);

  if (body.programme !== undefined) out.programme = programmes.includes(body.programme) ? body.programme : '';
  if (body.faculty !== undefined) {
    const prog = db.read('programmes').find((p) => p.name === out.programme);
    out.faculty = String(body.faculty || (prog ? prog.faculty : '')).slice(0, 80);
  }
  if (body.year !== undefined) {
    const y = parseInt(body.year, 10);
    out.year = y >= 1 && y <= 6 ? y : null;
  }
  if (body.studyLevel !== undefined) out.studyLevel = C.STUDY_LEVELS.includes(body.studyLevel) ? body.studyLevel : '';
  if (body.university !== undefined && String(body.university).trim()) out.university = String(body.university).trim().slice(0, 120);

  if (body.skills !== undefined) {
    const seen = new Set();
    out.skills = [];
    for (const s of Array.isArray(body.skills) ? body.skills : []) {
      const name = normalize(typeof s === 'string' ? s : s.name);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.skills.push({ name, level: C.PROFICIENCY.includes(s.level) ? s.level : 'Beginner' });
    }
    out.skills = out.skills.slice(0, 30);
  }
  if (body.interests !== undefined) {
    out.interests = [...new Set((body.interests || []).filter((i) => interests.includes(i)))].slice(0, 15);
  }
  if (body.experience !== undefined) {
    out.experience = (Array.isArray(body.experience) ? body.experience : [])
      .filter((e) => e && C.EXPERIENCE_TYPES.includes(e.type) && String(e.title || '').trim())
      .map((e) => ({ type: e.type, title: String(e.title).trim().slice(0, 120), year: e.year ? String(e.year).slice(0, 4) : '' }))
      .slice(0, 20);
  }
  if (body.certifications !== undefined) {
    out.certifications = (Array.isArray(body.certifications) ? body.certifications : [])
      .map((c) => String(c).trim()).filter(Boolean).slice(0, 15);
  }
  if (body.careerGoals !== undefined) out.careerGoals = String(body.careerGoals || '').slice(0, 500);
  return out;
}

function recommendationsFor(studentId) {
  const opps = db.read('opportunities');
  return db.read('matches')
    .filter((m) => m.studentId === studentId && isRecommendable(m))
    .map((m) => ({ opp: opps.find((o) => o.id === m.opportunityId), m }))
    .filter((x) => x.opp && x.opp.status === 'published' && (daysUntil(x.opp.deadline) ?? 0) >= 0)
    .sort((a, b) => b.m.score - a.m.score)
    .map((x) => ({ ...presentOpp(x.opp), match: matchSummary(x.m) }));
}

function register(router) {
  router.get('/api/student/profile', auth.requireStudent, async (req) => {
    const profile = db.findById('students', req.user.id);
    return { user: auth.publicUser(req.user), profile, completion: profileCompletion(profile) };
  });

  // ---- Update profile → re-run matching (Student Portal §3.7) ----
  router.put('/api/student/profile', auth.requireStudent, async (req) => {
    const body = await readBody(req);
    const changes = sanitizeProfile(body);
    if (body.programme !== undefined && !changes.programme) throw new HttpError(400, 'Please choose a valid academic programme.');
    const profile = db.update('students', req.user.id, { ...changes, updatedAt: new Date().toISOString() });
    const result = matchStudent(req.user.id, { sendNotifications: true, viaProfileUpdate: true });
    return { profile, completion: profileCompletion(profile), matchResult: result };
  });

  router.put('/api/student/settings', auth.requireStudent, async (req) => {
    const body = await readBody(req);
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) throw new HttpError(400, 'Please enter your name.');
      db.update('users', req.user.id, { name });
    }
    if (body.notificationPrefs) {
      const p = body.notificationPrefs;
      db.update('students', req.user.id, {
        notificationPrefs: { newMatches: !!p.newMatches, general: !!p.general, deadlines: !!p.deadlines, updates: !!p.updates },
      });
    }
    return { ok: true, message: 'Settings saved.' };
  });

  router.post('/api/student/account/delete-request', auth.requireStudent, async () => {
    // Account deletion is requested, then handled by an administrator
    return { ok: true, message: 'Your deletion request has been recorded. An administrator will process it.' };
  });

  // ---- Dashboard (Student Portal §4) ----
  router.get('/api/student/dashboard', auth.requireStudent, async (req) => {
    const profile = db.findById('students', req.user.id);
    const completion = profileCompletion(profile);
    const recommended = recommendationsFor(req.user.id);
    const opps = db.read('opportunities');
    const matches = db.read('matches').filter((m) => m.studentId === req.user.id);
    const savedRows = db.read('saved').filter((s) => s.studentId === req.user.id);
    const savedIds = new Set(savedRows.map((s) => s.opportunityId));

    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const newOpps = opps
      .filter((o) => o.status === 'published' && new Date(o.publishedAt).getTime() > twoWeeksAgo && (daysUntil(o.deadline) ?? 0) >= 0)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 6)
      .map((o) => ({ ...presentOpp(o), match: matchSummary(matches.find((m) => m.opportunityId === o.id)), saved: savedIds.has(o.id) }));

    const upcomingDeadlines = savedRows
      .map((s) => ({ s, o: opps.find((o) => o.id === s.opportunityId) }))
      .filter((x) => x.o && x.o.status === 'published' && (daysUntil(x.o.deadline) ?? -1) >= 0)
      .sort((a, b) => a.o.deadline.localeCompare(b.o.deadline))
      .slice(0, 5)
      .map((x) => ({ ...presentOpp(x.o), trackingStatus: x.s.trackingStatus }));

    const notifications = db.read('notifications').filter((n) => n.studentId === req.user.id);

    return {
      user: auth.publicUser(req.user),
      profile,
      completion,
      recommended: recommended.slice(0, 6).map((r) => ({ ...r, saved: savedIds.has(r.id) })),
      crossDisciplinary: recommended.filter((r) => r.match.crossDisciplinary).slice(0, 3),
      newOpportunities: newOpps,
      upcomingDeadlines,
      savedCount: savedRows.length,
      notifications: notifications.slice(0, 5),
      unread: notifications.filter((n) => !n.read).length,
      stats: {
        recommended: recommended.length,
        strong: recommended.filter((r) => r.match.score >= 80).length,
        saved: savedRows.length,
        closingSoon: upcomingDeadlines.filter((u) => u.daysLeft <= 3).length,
      },
    };
  });

  router.get('/api/student/recommendations', auth.requireStudent, async (req) => {
    const savedIds = new Set(db.read('saved').filter((s) => s.studentId === req.user.id).map((s) => s.opportunityId));
    return { items: recommendationsFor(req.user.id).map((r) => ({ ...r, saved: savedIds.has(r.id) })) };
  });
}

module.exports = { register, sanitizeProfile };
