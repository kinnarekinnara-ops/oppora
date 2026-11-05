// =============================================================
// present.js — shapes stored records into what the browser needs:
// category names, days left, availability status, profile completion.
// =============================================================
const db = require('./db');
const { daysUntil, isPast } = require('../lib/dates');

/** Student-facing availability (Student Portal §9: upcoming, open, closed, expired). */
function availability(opp) {
  if (opp.status === 'closed' || opp.status === 'archived') {
    return opp.eventDate && isPast(opp.eventEndDate || opp.eventDate) ? 'expired' : 'closed';
  }
  if (opp.status !== 'published') return opp.status;
  const d = daysUntil(opp.deadline);
  if (d !== null && d < 0) return 'closed';
  if (d !== null && d <= 3) return 'closing_soon';
  return 'open';
}

function presentOpp(opp) {
  const cats = db.read('categories');
  return {
    ...opp,
    categoryNames: (opp.categories || []).map((id) => (cats.find((c) => c.id === id) || {}).name || id),
    daysLeft: daysUntil(opp.deadline),
    availability: availability(opp),
    viewCount: (opp.viewedBy || []).length,
    clickCount: (opp.clickedBy || []).length,
    viewedBy: undefined,
    clickedBy: undefined,
  };
}

/** Light match info for cards and lists. */
function matchSummary(m) {
  if (!m) return null;
  return {
    score: m.score,
    label: m.label,
    tone: m.tone,
    eligibility: m.eligibility,
    provisional: m.provisional,
    insufficient: m.insufficient,
    crossDisciplinary: m.crossDisciplinary,
    reason: m.reasons[0] || '',
    matchedSkills: m.matchedSkills,
  };
}

/** Profile completion indicator (Student Portal §3.6). */
function profileCompletion(p) {
  if (!p) return { percent: 0, missing: [] };
  const checks = [
    ['programme', 15, !!p.programme, 'Academic programme'],
    ['year', 10, !!p.year, 'Year of study'],
    ['studyLevel', 5, !!p.studyLevel, 'Study level'],
    ['faculty', 5, !!p.faculty, 'Faculty'],
    ['skills', 20, (p.skills || []).length >= 1, 'At least one skill'],
    ['skills3', 5, (p.skills || []).length >= 3, 'Three or more skills'],
    ['interests', 15, (p.interests || []).length >= 1, 'Areas of interest'],
    ['experience', 10, (p.experience || []).length >= 1, 'Experience or achievements'],
    ['careerGoals', 10, !!(p.careerGoals || '').trim(), 'Career goals'],
    ['certifications', 5, (p.certifications || []).length >= 1, 'Certifications'],
  ];
  const percent = checks.reduce((sum, c) => sum + (c[2] ? c[1] : 0), 0);
  return { percent, missing: checks.filter((c) => !c[2]).map((c) => c[3]) };
}

module.exports = { presentOpp, matchSummary, profileCompletion, availability };
