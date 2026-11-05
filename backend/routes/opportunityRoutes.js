// =============================================================
// opportunityRoutes.js — the student-facing catalogue:
// browse, search, filter, suggestions, details, link clicks.
// =============================================================
const db = require('../services/db');
const { HttpError } = require('../lib/http');
const auth = require('../middleware/auth');
const { getMatch } = require('../services/matchingEngine');
const { presentOpp, matchSummary } = require('../services/present');
const { ROLES } = require('../config/constants');

const VISIBLE = ['published', 'closed'];

function register(router) {
  // ---- Catalogue with search + filters (Student Portal §5.3–5.4) ----
  router.get('/api/opportunities', auth.requireAuth, async (req) => {
    const q = req.query;
    const isStudent = req.user.role === ROLES.STUDENT;
    const matches = isStudent ? db.read('matches').filter((m) => m.studentId === req.user.id) : [];
    const savedIds = new Set(db.read('saved').filter((s) => s.studentId === req.user.id).map((s) => s.opportunityId));
    const text = (q.q || '').toLowerCase().trim();

    let items = db.read('opportunities')
      .filter((o) => VISIBLE.includes(o.status))
      .map((o) => {
        const m = matches.find((x) => x.opportunityId === o.id);
        return { ...presentOpp(o), match: matchSummary(m), saved: savedIds.has(o.id) };
      });

    if (text) {
      items = items.filter((o) => [o.title, o.description, o.organizer, ...(o.requiredSkills || []), ...(o.preferredSkills || []), ...o.categoryNames]
        .join(' ').toLowerCase().includes(text));
    }
    if (q.category) items = items.filter((o) => (o.categories || []).includes(q.category));
    if (q.level) items = items.filter((o) => o.experienceLevel === q.level || (q.level !== 'Any' && o.experienceLevel === 'Any'));
    if (q.skill) items = items.filter((o) => [...(o.requiredSkills || []), ...(o.preferredSkills || [])].includes(q.skill));
    if (q.programme) items = items.filter((o) => o.openToAll || !(o.targetProgrammes || []).length || o.targetProgrammes.includes(q.programme));
    if (q.deadlineWithin) items = items.filter((o) => o.daysLeft !== null && o.daysLeft >= 0 && o.daysLeft <= Number(q.deadlineWithin));
    if (q.eventFrom) items = items.filter((o) => (o.eventDate || '') >= q.eventFrom);
    if (q.eventTo) items = items.filter((o) => (o.eventDate || '') <= q.eventTo);

    const status = q.status || 'open';
    if (status === 'open') items = items.filter((o) => ['open', 'closing_soon'].includes(o.availability));
    else if (status !== 'all') items = items.filter((o) => o.availability === status);

    const sort = q.sort || (isStudent ? 'match' : 'deadline');
    const byDeadline = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999');
    if (sort === 'match') items.sort((a, b) => ((b.match && b.match.eligibility !== 'not_eligible' ? b.match.score : -1) ?? -1) - ((a.match && a.match.eligibility !== 'not_eligible' ? a.match.score : -1) ?? -1) || byDeadline(a, b));
    else if (sort === 'newest') items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    else items.sort(byDeadline);

    return { items, total: items.length };
  });

  // ---- Live search suggestions while typing ----
  router.get('/api/opportunities/suggest', auth.requireAuth, async (req) => {
    const text = (req.query.q || '').toLowerCase().trim();
    if (text.length < 2) return { items: [] };
    const items = db.read('opportunities')
      .filter((o) => o.status === 'published')
      .filter((o) => [o.title, o.organizer, ...(o.requiredSkills || [])].join(' ').toLowerCase().includes(text))
      .slice(0, 6)
      .map((o) => ({ id: o.id, title: o.title, organizer: o.organizer }));
    return { items };
  });

  // ---- Opportunity details + personal match explanation (Student Portal §6) ----
  router.get('/api/opportunities/:id', auth.requireAuth, async (req) => {
    const opp = db.findById('opportunities', req.params.id);
    const isStudent = req.user.role === ROLES.STUDENT;
    if (!opp || (isStudent && !VISIBLE.includes(opp.status))) throw new HttpError(404, 'This opportunity could not be found.');

    if (isStudent && !(opp.viewedBy || []).includes(req.user.id)) {
      db.update('opportunities', opp.id, { viewedBy: [...(opp.viewedBy || []), req.user.id] });
    }
    const org = db.findById('organizations', opp.organizationId);
    const saved = db.read('saved').find((s) => s.studentId === req.user.id && s.opportunityId === opp.id) || null;
    const match = isStudent ? getMatch(req.user.id, opp.id) : null;

    // Similar opportunities: share a category, ranked by this student's score
    const myMatches = isStudent ? db.read('matches').filter((m) => m.studentId === req.user.id) : [];
    const similar = db.read('opportunities')
      .filter((o) => o.id !== opp.id && o.status === 'published' && (o.categories || []).some((c) => (opp.categories || []).includes(c)))
      .map((o) => ({ ...presentOpp(o), match: matchSummary(myMatches.find((m) => m.opportunityId === o.id)) }))
      .sort((a, b) => ((b.match || {}).score || 0) - ((a.match || {}).score || 0))
      .slice(0, 3);

    return { opportunity: presentOpp(db.findById('opportunities', opp.id)), organization: org, match, saved, similar };
  });

  // ---- Track registration-link clicks (engagement for admins) ----
  router.post('/api/opportunities/:id/click', auth.requireAuth, async (req) => {
    const opp = db.findById('opportunities', req.params.id);
    if (!opp) throw new HttpError(404, 'Not found.');
    if (req.user.role === ROLES.STUDENT && !(opp.clickedBy || []).includes(req.user.id)) {
      db.update('opportunities', opp.id, { clickedBy: [...(opp.clickedBy || []), req.user.id] });
    }
    return { url: opp.registrationLink };
  });
}

module.exports = { register };
