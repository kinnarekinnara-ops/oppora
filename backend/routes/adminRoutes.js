// =============================================================
// adminRoutes.js — Admin Portal API.
// Role rules (Admin Portal §2):
//   super_admin        → everything
//   opportunity_admin  → all opportunities, approvals, students, analytics
//   org_rep            → only their own organization's opportunities;
//                        "publish" becomes "submit for approval"
// =============================================================
const db = require('../services/db');
const { HttpError, readBody } = require('../lib/http');
const auth = require('../middleware/auth');
const engine = require('../services/matchingEngine');
const { log } = require('../services/activityLogger');
const { presentOpp, profileCompletion } = require('../services/present');
const { normalize, normalizeList } = require('../services/skillNormalizer');
const { daysUntil, isPast } = require('../lib/dates');
const C = require('../config/constants');

const isStaff = (u) => u.role === C.ROLES.SUPER_ADMIN || u.role === C.ROLES.OPP_ADMIN;

function canManage(user, opp) {
  return isStaff(user) || (user.role === C.ROLES.ORG_REP && opp.organizationId === user.organizationId);
}

function scopedOpps(user) {
  const all = db.read('opportunities');
  return isStaff(user) ? all : all.filter((o) => o.organizationId === user.organizationId);
}

function getManageable(req) {
  const opp = db.findById('opportunities', req.params.id);
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (!canManage(req.user, opp)) throw new HttpError(403, 'You can only manage your own organization\'s opportunities.');
  return opp;
}

// ---------- Validation (Admin Portal §4.2) ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function cleanOpportunity(body, user) {
  const cats = db.read('categories').map((c) => c.id);
  const programmes = db.read('programmes').map((p) => p.name);
  const strArr = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);

  let organizationId = body.organizationId || null;
  if (user.role === C.ROLES.ORG_REP) organizationId = user.organizationId; // org reps can't post for others
  const org = organizationId ? db.findById('organizations', organizationId) : null;

  const required = normalizeList(strArr(body.requiredSkills));
  return {
    title: String(body.title || '').trim().slice(0, 150),
    description: String(body.description || '').trim().slice(0, 5000),
    categories: [...new Set(strArr(body.categories).filter((c) => cats.includes(c)))],
    organizationId,
    organizer: org ? org.name : String(body.organizer || '').trim().slice(0, 120),
    eventDate: DATE_RE.test(body.eventDate || '') ? body.eventDate : '',
    eventEndDate: DATE_RE.test(body.eventEndDate || '') ? body.eventEndDate : '',
    deadline: DATE_RE.test(body.deadline || '') ? body.deadline : '',
    registrationLink: String(body.registrationLink || '').trim().slice(0, 500),
    applicationInstructions: String(body.applicationInstructions || '').trim().slice(0, 1000),
    location: String(body.location || '').trim().slice(0, 150),
    deliveryMode: ['In-person', 'Online', 'Hybrid'].includes(body.deliveryMode) ? body.deliveryMode : 'In-person',
    experienceLevel: C.EXPERIENCE_LEVELS.includes(body.experienceLevel) ? body.experienceLevel : 'Any',
    requiredSkills: required,
    preferredSkills: normalizeList(strArr(body.preferredSkills)).filter((s) => !required.includes(s)),
    academicFields: strArr(body.academicFields).filter((p) => programmes.includes(p)),
    knowledgeAreas: strArr(body.knowledgeAreas).slice(0, 8),
    openToAll: !!body.openToAll,
    targetProgrammes: body.openToAll ? [] : strArr(body.targetProgrammes).filter((p) => programmes.includes(p)),
    restrictToProgrammes: !body.openToAll && !!body.restrictToProgrammes,
    eligibleYears: strArr(body.eligibleYears).map(Number).filter((y) => y >= 1 && y <= 6),
    studyLevels: strArr(body.studyLevels).filter((l) => C.STUDY_LEVELS.includes(l)),
    mandatoryRequirements: (Array.isArray(body.mandatoryRequirements) ? body.mandatoryRequirements : [])
      .filter((r) => r && String(r.value || '').trim())
      .map((r) => r.type === 'skill'
        ? { type: 'skill', value: normalize(r.value), minLevel: C.PROFICIENCY.includes(r.minLevel) ? r.minLevel : '' }
        : { type: 'text', value: String(r.value).trim().slice(0, 200) })
      .slice(0, 10),
    maxParticipants: body.maxParticipants ? Math.max(0, parseInt(body.maxParticipants, 10) || 0) : null,
    attachments: (Array.isArray(body.attachments) ? body.attachments : [])
      .filter((a) => a && URL_RE.test(a.url || ''))
      .map((a) => ({ label: String(a.label || 'Document').slice(0, 80), url: a.url }))
      .slice(0, 5),
    aiAssisted: !!body.aiAssisted,
    aiSource: body.aiSource || null,
  };
}

/** Returns a { field: message } map. Drafts only need a title. */
function validate(o, forPublishing) {
  const e = {};
  if (o.title.length < 5) e.title = 'Title must be at least 5 characters.';
  if (!forPublishing) return e;
  if (o.description.length < 30) e.description = 'Description must be at least 30 characters.';
  if (!o.categories.length) e.categories = 'Choose at least one category.';
  if (!o.organizer) e.organizationId = 'Choose the organizing department or club.';
  if (!o.eventDate) e.eventDate = 'Event date is required.';
  if (!o.deadline) e.deadline = 'Registration deadline is required.';
  else if (isPast(o.deadline)) e.deadline = 'The registration deadline is already in the past.';
  if (o.deadline && o.eventDate && o.deadline > (o.eventEndDate || o.eventDate)) e.deadline = 'The deadline must be on or before the event date.';
  if (o.eventEndDate && o.eventDate && o.eventEndDate < o.eventDate) e.eventEndDate = 'End date must be after the start date.';
  if (!o.registrationLink && !o.applicationInstructions) e.registrationLink = 'Add a registration link or application instructions.';
  if (o.registrationLink && !URL_RE.test(o.registrationLink)) e.registrationLink = 'Registration link must start with http:// or https://';
  if (!o.openToAll && !o.targetProgrammes.length) e.targetProgrammes = 'Choose target programmes, or mark it as open to all students.';
  return e;
}

/** Human summary of changes students care about (for update notifications). */
function changeSummary(before, after) {
  const parts = [];
  if (before.deadline !== after.deadline) parts.push(`The registration deadline is now ${after.deadline}.`);
  if (before.eventDate !== after.eventDate) parts.push(`The event date is now ${after.eventDate}.`);
  if (before.location !== after.location) parts.push(`The location changed to ${after.location || 'TBA'}.`);
  if (before.registrationLink !== after.registrationLink) parts.push('The registration link was updated.');
  if (JSON.stringify(before.mandatoryRequirements) !== JSON.stringify(after.mandatoryRequirements)
    || JSON.stringify(before.eligibleYears) !== JSON.stringify(after.eligibleYears)
    || before.restrictToProgrammes !== after.restrictToProgrammes) parts.push('Eligibility requirements were updated — please re-check.');
  return parts.join(' ');
}

function publish(opp, user) {
  const updated = db.update('opportunities', opp.id, {
    status: 'published',
    publishedAt: opp.publishedAt || new Date().toISOString(),
    publishedBy: user.id,
    updatedAt: new Date().toISOString(),
  });
  const stats = engine.matchOpportunity(opp.id, { sendNotifications: true });
  db.update('opportunities', opp.id, { lastMatchStats: { ...stats, at: new Date().toISOString() } });
  log(user, 'opportunity.published', { type: 'opportunity', id: opp.id, name: opp.title },
    `Matched ${stats.recommended} students, notified ${stats.notified}`);
  return { opportunity: presentOpp(db.findById('opportunities', updated.id)), matchStats: stats };
}

function oppStats(opp) {
  const matches = db.read('matches').filter((m) => m.opportunityId === opp.id);
  return {
    evaluated: matches.length,
    eligible: matches.filter((m) => m.eligibility === 'eligible').length,
    recommended: matches.filter(engine.isRecommendable).length,
    strong: matches.filter((m) => engine.isRecommendable(m) && m.score >= 80).length,
    crossDisciplinary: matches.filter((m) => m.crossDisciplinary).length,
    notified: db.read('notifications').filter((n) => n.opportunityId === opp.id && ['new_match', 'general'].includes(n.type)).length,
    saved: db.read('saved').filter((s) => s.opportunityId === opp.id).length,
    views: (opp.viewedBy || []).length,
    clicks: (opp.clickedBy || []).length,
  };
}

function register(router) {
  // ================= DASHBOARD (Admin §3) =================
  router.get('/api/admin/dashboard', auth.requireAdmin, async (req) => {
    const opps = scopedOpps(req.user);
    const ids = new Set(opps.map((o) => o.id));
    const published = opps.filter((o) => o.status === 'published');
    const matches = db.read('matches').filter((m) => ids.has(m.opportunityId));
    const logs = db.read('activity_logs').filter((l) => isStaff(req.user) || (l.targetId && ids.has(l.targetId)) || l.actorId === req.user.id);
    const p = (list) => list.map((o) => ({ ...presentOpp(o), stats: oppStats(o) }));

    return {
      stats: {
        students: db.read('students').length,
        published: published.length,
        active: published.filter((o) => (daysUntil(o.deadline) ?? -1) >= 0).length,
        organizations: db.read('organizations').filter((o) => o.status === 'active').length,
        matches: matches.filter(engine.isRecommendable).length,
        notifications: db.read('notifications').filter((n) => ids.has(n.opportunityId)).length,
        pending: opps.filter((o) => o.status === 'pending_approval').length,
        drafts: opps.filter((o) => o.status === 'draft').length,
      },
      recent: p(published.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')).slice(0, 5)),
      upcoming: p(published.filter((o) => o.eventDate && (daysUntil(o.eventDate) ?? -1) >= 0).sort((a, b) => a.eventDate.localeCompare(b.eventDate)).slice(0, 5)),
      closingSoon: p(published.filter((o) => { const d = daysUntil(o.deadline); return d !== null && d >= 0 && d <= 7; }).sort((a, b) => a.deadline.localeCompare(b.deadline))),
      pending: p(opps.filter((o) => o.status === 'pending_approval')),
      closed: p(opps.filter((o) => o.status === 'closed').slice(0, 5)),
      activity: logs.slice(0, 10),
    };
  });

  // ================= OPPORTUNITY MANAGEMENT (Admin §4) =================
  router.get('/api/admin/opportunities', auth.requireAdmin, async (req) => {
    let items = scopedOpps(req.user);
    if (req.query.status && req.query.status !== 'all') items = items.filter((o) => o.status === req.query.status);
    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      items = items.filter((o) => `${o.title} ${o.organizer}`.toLowerCase().includes(q));
    }
    items = items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const counts = {};
    for (const s of C.STATUSES) counts[s] = scopedOpps(req.user).filter((o) => o.status === s).length;
    return { items: items.map((o) => ({ ...presentOpp(o), stats: oppStats(o) })), counts };
  });

  router.get('/api/admin/opportunities/:id', auth.requireAdmin, async (req) => {
    const opp = getManageable(req);
    return { opportunity: presentOpp(opp), stats: oppStats(opp) };
  });

  // Create. body.action: 'draft' | 'publish' (org reps: 'publish' = submit for approval)
  router.post('/api/admin/opportunities', auth.requireAdmin, async (req) => {
    const body = await readBody(req);
    const data = cleanOpportunity(body, req.user);
    const publishing = body.action === 'publish';
    const errors = validate(data, publishing);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { fields: errors });

    const now = new Date().toISOString();
    const opp = db.insert('opportunities', {
      id: db.newId('opp'), ...data, status: 'draft',
      createdBy: req.user.id, createdAt: now, updatedAt: now, viewedBy: [], clickedBy: [],
    });
    log(req.user, 'opportunity.created', { type: 'opportunity', id: opp.id, name: opp.title }, data.aiAssisted ? `AI-assisted (${data.aiSource})` : '');

    if (!publishing) return { opportunity: presentOpp(opp), message: 'Saved as draft.' };
    if (req.user.role === C.ROLES.ORG_REP) {
      db.update('opportunities', opp.id, { status: 'pending_approval', submittedAt: now });
      log(req.user, 'opportunity.submitted', { type: 'opportunity', id: opp.id, name: opp.title }, 'Submitted for approval');
      return { opportunity: presentOpp(db.findById('opportunities', opp.id)), message: 'Submitted for approval. An administrator will review it.' };
    }
    return { ...publish(opp, req.user), message: 'Published! Matching complete.' };
  });

  // Edit. Re-matches + notifies students who saved it about important changes (§4.5, Matching §11.3)
  router.put('/api/admin/opportunities/:id', auth.requireAdmin, async (req) => {
    const before = getManageable(req);
    const body = await readBody(req);
    const data = cleanOpportunity({ ...before, ...body }, req.user);
    const publishing = body.action === 'publish' || before.status === 'published';
    const errors = validate(data, publishing);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { fields: errors });

    const after = db.update('opportunities', before.id, { ...data, updatedAt: new Date().toISOString() });
    log(req.user, 'opportunity.updated', { type: 'opportunity', id: after.id, name: after.title });

    if (before.status === 'published') {
      const summary = changeSummary(before, after);
      const stats = engine.onOpportunityChanged(after.id, summary);
      db.update('opportunities', after.id, { lastMatchStats: { ...stats, at: new Date().toISOString() } });
      return { opportunity: presentOpp(db.findById('opportunities', after.id)), matchStats: stats, message: 'Changes saved and matches recalculated.' };
    }
    if (body.action === 'publish') {
      if (req.user.role === C.ROLES.ORG_REP) {
        db.update('opportunities', after.id, { status: 'pending_approval', submittedAt: new Date().toISOString() });
        log(req.user, 'opportunity.submitted', { type: 'opportunity', id: after.id, name: after.title });
        return { opportunity: presentOpp(db.findById('opportunities', after.id)), message: 'Submitted for approval.' };
      }
      return { ...publish(after, req.user), message: 'Published! Matching complete.' };
    }
    return { opportunity: presentOpp(after), message: 'Draft saved.' };
  });

  // Change status: pause, close, archive, re-publish, back to draft
  router.post('/api/admin/opportunities/:id/status', auth.requireAdmin, async (req) => {
    const opp = getManageable(req);
    const { status } = await readBody(req);
    if (!C.STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
    if (status === 'published') {
      if (req.user.role === C.ROLES.ORG_REP && !opp.publishedAt) throw new HttpError(403, 'Opportunities need administrator approval before they are first published.');
      const errors = validate(opp, true);
      if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], { fields: errors });
      return { ...publish(opp, req.user), message: 'Published.' };
    }
    if (status === 'pending_approval') throw new HttpError(400, 'Use "Submit for approval" from the edit form.');
    db.update('opportunities', opp.id, { status, updatedAt: new Date().toISOString() });
    if (status !== 'published') engine.matchOpportunity(opp.id, { sendNotifications: false }); // removes matches from dashboards
    log(req.user, `opportunity.${status}`, { type: 'opportunity', id: opp.id, name: opp.title });
    return { opportunity: presentOpp(db.findById('opportunities', opp.id)), message: `Status changed to ${status.replace('_', ' ')}.` };
  });

  router.post('/api/admin/opportunities/:id/approve', auth.requireStaff, async (req) => {
    const opp = getManageable(req);
    if (opp.status !== 'pending_approval') throw new HttpError(400, 'This opportunity is not awaiting approval.');
    const errors = validate(opp, true);
    if (Object.keys(errors).length) throw new HttpError(400, `Cannot approve: ${Object.values(errors)[0]}`);
    log(req.user, 'opportunity.approved', { type: 'opportunity', id: opp.id, name: opp.title });
    return { ...publish(opp, req.user), message: 'Approved and published.' };
  });

  router.post('/api/admin/opportunities/:id/reject', auth.requireStaff, async (req) => {
    const opp = getManageable(req);
    const { reason } = await readBody(req);
    db.update('opportunities', opp.id, { status: 'draft', rejectionReason: String(reason || 'No reason given').slice(0, 300), updatedAt: new Date().toISOString() });
    log(req.user, 'opportunity.rejected', { type: 'opportunity', id: opp.id, name: opp.title }, reason || '');
    return { message: 'Returned to the organization as a draft with your feedback.' };
  });

  // Drafts are deleted; anything that was ever published is archived instead (keeps history)
  router.delete('/api/admin/opportunities/:id', auth.requireAdmin, async (req) => {
    const opp = getManageable(req);
    if (opp.status === 'draft' && !opp.publishedAt) {
      db.remove('opportunities', (o) => o.id === opp.id);
      log(req.user, 'opportunity.deleted', { type: 'opportunity', id: opp.id, name: opp.title });
      return { message: 'Draft deleted.' };
    }
    db.update('opportunities', opp.id, { status: 'archived', updatedAt: new Date().toISOString() });
    engine.matchOpportunity(opp.id, { sendNotifications: false });
    log(req.user, 'opportunity.archived', { type: 'opportunity', id: opp.id, name: opp.title });
    return { message: 'Opportunity archived.' };
  });

  // ================= MATCHING REVIEW (Admin §6) =================
  router.get('/api/admin/opportunities/:id/matches', auth.requireAdmin, async (req) => {
    const opp = getManageable(req);
    const staff = isStaff(req.user);
    const users = db.read('users');
    const students = db.read('students');
    const notified = new Set(db.read('notifications').filter((n) => n.opportunityId === opp.id).map((n) => n.studentId));
    const saved = new Set(db.read('saved').filter((s) => s.opportunityId === opp.id).map((s) => s.studentId));

    const rows = db.read('matches')
      .filter((m) => m.opportunityId === opp.id)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((m, i) => {
        const u = users.find((x) => x.id === m.studentId) || {};
        const s = students.find((x) => x.id === m.studentId) || {};
        return {
          // Org reps see anonymised rows — student personal info is staff-only (Admin §13)
          student: staff ? u.name : `Student #${i + 1}`,
          studentId: staff ? m.studentId : null,
          programme: s.programme, year: s.year,
          score: m.score, label: m.label, tone: m.tone, eligibility: m.eligibility,
          eligibilityReasons: m.eligibilityDetails ? m.eligibilityDetails.failed : [],
          crossDisciplinary: m.crossDisciplinary, provisional: m.provisional,
          matchedSkills: m.matchedSkills, missingSkills: m.missingSkills,
          notified: notified.has(m.studentId), saved: saved.has(m.studentId),
          breakdown: m.breakdown,
        };
      });

    const buckets = { strong: 0, good: 0, potential: 0, low: 0, notEligible: 0, insufficient: 0 };
    for (const r of rows) {
      if (r.eligibility === 'not_eligible') buckets.notEligible++;
      else if (r.score === null) buckets.insufficient++;
      else buckets[r.tone]++;
    }
    const byProgramme = {};
    rows.filter((r) => r.eligibility !== 'not_eligible' && r.score >= C.RECOMMEND_THRESHOLD)
      .forEach((r) => { byProgramme[r.programme || 'Unknown'] = (byProgramme[r.programme || 'Unknown'] || 0) + 1; });

    return { opportunity: presentOpp(opp), stats: oppStats(opp), rows, buckets, byProgramme, anonymised: !staff };
  });

  router.post('/api/admin/opportunities/:id/rematch', auth.requireAdmin, async (req) => {
    const opp = getManageable(req);
    if (opp.status !== 'published') throw new HttpError(400, 'Only published opportunities are matched.');
    const stats = engine.matchOpportunity(opp.id, { sendNotifications: true });
    db.update('opportunities', opp.id, { lastMatchStats: { ...stats, at: new Date().toISOString() } });
    log(req.user, 'opportunity.rematched', { type: 'opportunity', id: opp.id, name: opp.title });
    return { matchStats: stats, message: `Re-matched: ${stats.recommended} recommended, ${stats.notified} new notifications.` };
  });

  // ================= STUDENTS (Admin §8) =================
  router.get('/api/admin/students', auth.requireStaff, async (req) => {
    const q = (req.query.q || '').toLowerCase();
    const users = db.read('users');
    const matches = db.read('matches');
    let items = db.read('students').map((s) => {
      const u = users.find((x) => x.id === s.id) || {};
      return {
        id: s.id, name: u.name, email: u.email, status: u.status, university: s.university,
        programme: s.programme, year: s.year, skills: (s.skills || []).map((k) => k.name), interests: s.interests || [],
        completion: profileCompletion(s).percent,
        recommendations: matches.filter((m) => m.studentId === s.id && engine.isRecommendable(m)).length,
        saved: db.read('saved').filter((x) => x.studentId === s.id).length,
        createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
      };
    });
    if (q) items = items.filter((s) => `${s.name} ${s.email} ${s.programme} ${s.skills.join(' ')}`.toLowerCase().includes(q));
    if (req.query.programme) items = items.filter((s) => s.programme === req.query.programme);
    return { items };
  });

  router.get('/api/admin/students/:id', auth.requireStaff, async (req) => {
    const u = db.findById('users', req.params.id);
    const s = db.findById('students', req.params.id);
    if (!u || !s) throw new HttpError(404, 'Student not found.');
    const opps = db.read('opportunities');
    const top = db.read('matches').filter((m) => m.studentId === s.id && engine.isRecommendable(m))
      .sort((a, b) => b.score - a.score).slice(0, 8)
      .map((m) => ({ title: (opps.find((o) => o.id === m.opportunityId) || {}).title, score: m.score, label: m.label, tone: m.tone }));
    return { user: auth.publicUser(u), profile: s, completion: profileCompletion(s), topMatches: top };
  });

  router.put('/api/admin/students/:id/status', auth.requireSuperAdmin, async (req) => {
    const { status } = await readBody(req);
    if (!['active', 'suspended'].includes(status)) throw new HttpError(400, 'Invalid status.');
    const u = db.update('users', req.params.id, { status });
    if (!u) throw new HttpError(404, 'Student not found.');
    log(req.user, `student.${status}`, { type: 'student', id: u.id, name: u.name });
    return { message: `Account ${status}.` };
  });

  // ================= ORGANIZATIONS (Admin §9) =================
  router.get('/api/admin/organizations', auth.requireAdmin, async () => {
    const opps = db.read('opportunities');
    const users = db.read('users');
    return {
      items: db.read('organizations').map((o) => ({
        ...o,
        opportunities: opps.filter((x) => x.organizationId === o.id).length,
        published: opps.filter((x) => x.organizationId === o.id && x.status === 'published').length,
        representatives: users.filter((u) => u.organizationId === o.id).map((u) => u.name),
      })),
    };
  });

  router.post('/api/admin/organizations', auth.requireStaff, async (req) => {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    if (name.length < 3) throw new HttpError(400, 'Organization name is required.');
    if (db.read('organizations').some((o) => o.name.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'An organization with this name already exists.');
    const org = db.insert('organizations', {
      id: db.newId('org'), name,
      type: ['Department', 'Club', 'Society', 'Faculty', 'Office', 'External Partner'].includes(b.type) ? b.type : 'Club',
      email: String(b.email || '').trim(), description: String(b.description || '').slice(0, 500),
      status: 'active', createdAt: new Date().toISOString(),
    });
    log(req.user, 'organization.created', { type: 'organization', id: org.id, name: org.name });
    return { organization: org, message: 'Organization added.' };
  });

  router.put('/api/admin/organizations/:id', auth.requireStaff, async (req) => {
    const b = await readBody(req);
    const changes = {};
    ['name', 'type', 'email', 'description'].forEach((k) => { if (b[k] !== undefined) changes[k] = String(b[k]).trim(); });
    if (b.status && ['active', 'suspended'].includes(b.status)) changes.status = b.status;
    const org = db.update('organizations', req.params.id, changes);
    if (!org) throw new HttpError(404, 'Organization not found.');
    log(req.user, 'organization.updated', { type: 'organization', id: org.id, name: org.name }, b.status ? `Status: ${b.status}` : '');
    return { organization: org, message: 'Organization updated.' };
  });

  // ================= ADMIN USERS (Super Admin only) =================
  router.get('/api/admin/users', auth.requireSuperAdmin, async () => ({
    items: db.read('users').filter((u) => u.role !== C.ROLES.STUDENT).map((u) => ({
      ...auth.publicUser(u),
      organization: u.organizationId ? (db.findById('organizations', u.organizationId) || {}).name : null,
    })),
  }));

  router.post('/api/admin/users', auth.requireSuperAdmin, async (req) => {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Valid email required.');
    if (db.read('users').some((u) => u.email === email)) throw new HttpError(400, 'Email already in use.');
    if (![C.ROLES.SUPER_ADMIN, C.ROLES.OPP_ADMIN, C.ROLES.ORG_REP].includes(b.role)) throw new HttpError(400, 'Choose a role.');
    if (b.role === C.ROLES.ORG_REP && !db.findById('organizations', b.organizationId)) throw new HttpError(400, 'Organization representatives need an organization.');
    if (String(b.password || '').length < 6) throw new HttpError(400, 'Temporary password must be at least 6 characters.');
    const { salt, hash } = auth.hashPassword(b.password);
    const u = db.insert('users', {
      id: db.newId('usr'), email, name: String(b.name || email).trim(), role: b.role,
      organizationId: b.role === C.ROLES.ORG_REP ? b.organizationId : null,
      salt, passwordHash: hash, status: 'active', createdAt: new Date().toISOString(),
    });
    log(req.user, 'admin_user.created', { type: 'user', id: u.id, name: u.name }, C.ROLE_LABELS[u.role]);
    return { user: auth.publicUser(u), message: 'Administrator account created.' };
  });

  router.put('/api/admin/users/:id', auth.requireSuperAdmin, async (req) => {
    const b = await readBody(req);
    if (req.params.id === req.user.id && b.status === 'suspended') throw new HttpError(400, 'You cannot suspend your own account.');
    const changes = {};
    if (b.role && [C.ROLES.SUPER_ADMIN, C.ROLES.OPP_ADMIN, C.ROLES.ORG_REP].includes(b.role)) changes.role = b.role;
    if (b.status && ['active', 'suspended'].includes(b.status)) changes.status = b.status;
    if (b.organizationId !== undefined) changes.organizationId = b.organizationId || null;
    const u = db.update('users', req.params.id, changes);
    if (!u) throw new HttpError(404, 'User not found.');
    log(req.user, 'admin_user.updated', { type: 'user', id: u.id, name: u.name }, JSON.stringify(changes));
    return { message: 'User updated.' };
  });

  // ================= ACTIVITY LOGS (Admin §11) =================
  router.get('/api/admin/logs', auth.requireAdmin, async (req) => {
    const ids = new Set(scopedOpps(req.user).map((o) => o.id));
    let items = db.read('activity_logs').filter((l) => isStaff(req.user) || (l.targetId && ids.has(l.targetId)));
    if (req.query.action) items = items.filter((l) => l.action.startsWith(req.query.action));
    return { items: items.slice(0, 300) };
  });

  // ================= ANALYTICS (Admin §10) =================
  router.get('/api/admin/analytics', auth.requireAdmin, async (req) => {
    const opps = scopedOpps(req.user).filter((o) => ['published', 'closed'].includes(o.status));
    const rows = opps.map((o) => ({ id: o.id, title: o.title, status: o.status, categories: presentOpp(o).categoryNames, deadline: o.deadline, ...oppStats(o) }))
      .sort((a, b) => b.recommended - a.recommended);
    const totals = rows.reduce((t, r) => {
      ['recommended', 'notified', 'saved', 'views', 'clicks', 'crossDisciplinary'].forEach((k) => { t[k] = (t[k] || 0) + r[k]; });
      return t;
    }, {});

    const categories = db.read('categories').map((c) => ({
      name: c.name, color: c.color,
      count: opps.filter((o) => (o.categories || []).includes(c.id)).length,
    }));

    // Skill demand vs supply — which skills opportunities ask for vs how many students have them
    const students = db.read('students');
    const demand = {};
    opps.forEach((o) => (o.requiredSkills || []).forEach((s) => { demand[s] = (demand[s] || 0) + 1; }));
    const skillGap = Object.entries(demand).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([skill, n]) => ({
      skill, opportunities: n, students: students.filter((s) => (s.skills || []).some((k) => k.name === skill)).length,
    }));

    const programmes = {};
    students.forEach((s) => { programmes[s.programme || 'Not set'] = (programmes[s.programme || 'Not set'] || 0) + 1; });

    return { rows, totals, categories, skillGap, programmes, studentCount: students.length };
  });
}

module.exports = { register };
