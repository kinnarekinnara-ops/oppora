// =============================================================
// matchingEngine.js — runs the full pipeline (Matching doc §2, §11):
//   1. Retrieve opportunity   2. Retrieve student profiles
//   3. Check eligibility      4. Calculate compatibility
//   5. Generate explanation   6. Store results   7. Notify
// =============================================================
const db = require('./db');
const { checkEligibility } = require('./eligibility');
const { computeScore } = require('./scoring');
const { explain } = require('./explainer');
const { notify } = require('./notificationService');
const { NOTIFY_THRESHOLD, RECOMMEND_THRESHOLD } = require('../config/constants');

/** Steps 3–5 for a single student × opportunity pair. */
function computeMatch(student, opp) {
  const eligibility = checkEligibility(student, opp);
  const result = computeScore(student, opp);
  const explanation = explain(student, opp, result, eligibility);

  return {
    id: `${student.id}__${opp.id}`,
    studentId: student.id,
    opportunityId: opp.id,
    eligibility: eligibility.status,
    eligibilityDetails: eligibility,
    score: result.score,
    label: result.label || null,
    tone: result.tone || null,
    provisional: result.provisional,
    insufficient: result.insufficient,
    breakdown: result.breakdown,
    matchedSkills: result.skills.matched,
    relatedSkills: result.skills.related,
    missingSkills: result.skills.missing,
    matchedInterests: result.interests.matched,
    reasons: explanation.reasons,
    improve: explanation.improve,
    crossDisciplinary: explanation.crossDisciplinary,
    notes: explanation.notes,
    disclaimer: explanation.disclaimer,
    computedAt: new Date().toISOString(),
  };
}

function isRecommendable(m) {
  return m && m.eligibility !== 'not_eligible' && m.score !== null && m.score >= RECOMMEND_THRESHOLD;
}

function shouldNotify(m) {
  return m.eligibility === 'eligible' && m.score !== null && m.score >= NOTIFY_THRESHOLD;
}

function notifyMatch(student, opp, m, viaProfileUpdate = false) {
  return notify({
    student,
    type: 'new_match',
    opportunity: opp,
    title: `${m.score}% ${m.label}: ${opp.title}`,
    message: viaProfileUpdate
      ? `Your updated profile now matches "${opp.title}". ${m.reasons[0] || ''}`
      : `A new opportunity matches your profile. ${m.reasons[0] || ''}`,
    dedupeKey: `match:${opp.id}:${student.id}`,
  });
}

function notifyGeneral(student, opp) {
  return notify({
    student,
    type: 'general',
    opportunity: opp,
    title: `Open to everyone: ${opp.title}`,
    message: `${opp.organizer || 'The university'} has published an opportunity open to all students.`,
    dedupeKey: `match:${opp.id}:${student.id}`, // shares the key so nobody gets two alerts for one opportunity
  });
}

/** Run matching for ONE opportunity against ALL students (on publish / update). */
function matchOpportunity(oppId, { sendNotifications = true } = {}) {
  const opp = db.findById('opportunities', oppId);
  if (!opp) return null;

  const students = db.read('students');
  const others = db.read('matches').filter((m) => m.opportunityId !== oppId);
  const fresh = opp.status === 'published' ? students.map((s) => computeMatch(s, opp)) : [];
  db.write('matches', [...others, ...fresh]);

  let notified = 0;
  if (sendNotifications && opp.status === 'published') {
    for (const m of fresh) {
      const student = students.find((s) => s.id === m.studentId);
      if (shouldNotify(m)) {
        if (notifyMatch(student, opp, m)) notified++;
      } else if (opp.openToAll && (opp.categories || []).includes('general') && m.eligibility === 'eligible') {
        if (notifyGeneral(student, opp)) notified++;
      }
    }
  }

  return {
    evaluated: fresh.length,
    eligible: fresh.filter((m) => m.eligibility === 'eligible').length,
    notEligible: fresh.filter((m) => m.eligibility === 'not_eligible').length,
    recommended: fresh.filter(isRecommendable).length,
    strong: fresh.filter((m) => m.score >= 80 && m.eligibility !== 'not_eligible').length,
    crossDisciplinary: fresh.filter((m) => m.crossDisciplinary).length,
    notified,
  };
}

/** Run matching for ONE student against ALL published opportunities (on register / profile update). */
function matchStudent(studentId, { sendNotifications = true, viaProfileUpdate = true } = {}) {
  const student = db.findById('students', studentId);
  if (!student) return null;
  const opps = db.read('opportunities').filter((o) => o.status === 'published');
  const others = db.read('matches').filter((m) => m.studentId !== studentId);
  const fresh = opps.map((o) => computeMatch(student, o));
  db.write('matches', [...others, ...fresh]);

  let newMatches = 0;
  if (sendNotifications) {
    for (const m of fresh) {
      if (shouldNotify(m)) {
        const opp = opps.find((o) => o.id === m.opportunityId);
        if (notifyMatch(student, opp, m, viaProfileUpdate)) newMatches++;
      }
    }
  }
  return { evaluated: fresh.length, recommended: fresh.filter(isRecommendable).length, newMatches };
}

/** When an admin changes an opportunity: recalc + tell students who saved it (§11.3). */
function onOpportunityChanged(oppId, summary) {
  const stats = matchOpportunity(oppId, { sendNotifications: true });
  const opp = db.findById('opportunities', oppId);
  let updated = 0;
  if (opp && opp.status === 'published' && summary) {
    const students = db.read('students');
    for (const s of db.read('saved').filter((x) => x.opportunityId === oppId)) {
      const student = students.find((x) => x.id === s.studentId);
      if (student && notify({
        student,
        type: 'update',
        opportunity: opp,
        title: `Update: ${opp.title}`,
        message: summary,
        dedupeKey: `update:${opp.id}:${student.id}:${opp.updatedAt}`,
      })) updated++;
    }
  }
  return { ...stats, updateNotifications: updated };
}

/** Get (or compute on the fly) the stored match for a pair. */
function getMatch(studentId, oppId) {
  const stored = db.read('matches').find((m) => m.studentId === studentId && m.opportunityId === oppId);
  if (stored) return stored;
  const student = db.findById('students', studentId);
  const opp = db.findById('opportunities', oppId);
  return student && opp ? computeMatch(student, opp) : null;
}

function rematchAll() {
  const opps = db.read('opportunities').filter((o) => o.status === 'published');
  const students = db.read('students');
  const all = [];
  for (const o of opps) for (const s of students) all.push(computeMatch(s, o));
  db.write('matches', all);
  return all.length;
}

module.exports = { computeMatch, matchOpportunity, matchStudent, onOpportunityChanged, getMatch, isRecommendable, rematchAll };
