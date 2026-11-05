// =============================================================
// metaRoutes.js — reference lists the forms need (categories,
// programmes, skills, interests…) + the AI extraction endpoint.
// =============================================================
const db = require('../services/db');
const { readBody } = require('../lib/http');
const auth = require('../middleware/auth');
const { allSkills, allInterests } = require('../services/skillNormalizer');
const { extract } = require('../services/aiExtractor');
const C = require('../config/constants');

function register(router) {
  // Public: the registration page needs these before login
  router.get('/api/meta', async () => ({
    categories: db.read('categories').map(({ keywords, experienceTypes, ...c }) => c),
    programmes: db.read('programmes'),
    skills: allSkills(),
    interests: allInterests().map((i) => i.name),
    organizations: db.read('organizations').filter((o) => o.status === 'active').map((o) => ({ id: o.id, name: o.name, type: o.type })),
    experienceLevels: C.EXPERIENCE_LEVELS,
    proficiency: C.PROFICIENCY,
    studyLevels: C.STUDY_LEVELS,
    experienceTypes: C.EXPERIENCE_TYPES,
    trackingStatuses: C.TRACKING_STATUSES,
    roleLabels: C.ROLE_LABELS,
    weights: C.WEIGHTS,
    aiEnabled: !!process.env.GEMINI_API_KEY,
  }));

  // Public stats for the landing page
  router.get('/api/meta/landing', async () => {
    const opps = db.read('opportunities').filter((o) => o.status === 'published');
    const cats = db.read('categories').map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, bg: c.bg, count: opps.filter((o) => (o.categories || []).includes(c.id)).length }));
    return {
      opportunities: opps.length,
      students: db.read('students').length,
      organizations: db.read('organizations').filter((o) => o.status === 'active').length,
      categories: cats,
      featured: opps.slice(0, 3).map((o) => ({ id: o.id, title: o.title, organizer: o.organizer, deadline: o.deadline, categories: o.categories })),
    };
  });

  // AI-assisted extraction (Admin Portal §5)
  router.post('/api/ai/extract', auth.requireAdmin, async (req) => {
    const body = await readBody(req);
    return extract(String(body.title || ''), String(body.description || ''));
  });
}

module.exports = { register };
