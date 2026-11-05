// =============================================================
// scoring.js — weighted compatibility score (Matching doc §6–7).
//
//   Score = Skills×0.50 + Interests×0.25 + Academic×0.15 + Experience×0.10
//
// Each dimension returns 0–100, or null when the profile has no data
// for it. Missing dimensions are NOT treated as zero: the remaining
// weights are rescaled and the result is flagged "provisional" (§7.2).
// =============================================================
const db = require('./db');
const { normalize, relatedTo } = require('./skillNormalizer');
const { WEIGHTS, LABELS } = require('../config/constants');

const LEVEL_RANK = { Beginner: 1, Intermediate: 2, Advanced: 3 };

function oppText(opp) {
  return (' ' + [opp.title, opp.description, (opp.requiredSkills || []).join(' '), (opp.preferredSkills || []).join(' '),
    (opp.academicFields || []).join(' '), (opp.knowledgeAreas || []).join(' ')].join(' ') + ' ').toLowerCase();
}

// ---------- Skills (50%) ----------
function scoreSkills(student, opp) {
  const required = (opp.requiredSkills || []).map(normalize);
  const preferred = (opp.preferredSkills || []).map(normalize).filter((s) => !required.includes(s));
  const studentSkills = new Map((student.skills || []).map((s) => [normalize(s.name), s.level || 'Beginner']));

  const result = { score: null, matched: [], related: [], missing: [] };
  if (!required.length && !preferred.length) return result; // opportunity defines no skills
  if (!studentSkills.size) { result.missing = required; return result; } // profile has no skills

  const oppRank = LEVEL_RANK[opp.experienceLevel] || 0; // 0 = Any
  let earned = 0;
  let possible = 0;

  const evaluate = (skill, weight, isRequired) => {
    possible += weight;
    if (studentSkills.has(skill)) {
      let credit = 1;
      // Proficiency only matters when the opportunity asks for a level.
      // Beginners never get zero for a skill they have (§6.2).
      const gap = oppRank - (LEVEL_RANK[studentSkills.get(skill)] || 1);
      if (gap === 1) credit = 0.85;
      if (gap >= 2) credit = 0.7;
      earned += weight * credit;
      result.matched.push(skill);
      return;
    }
    // Related skill via the defined skill mapping → partial credit
    const via = relatedTo(skill).find((r) => studentSkills.has(r));
    if (via) {
      earned += weight * 0.5;
      result.related.push({ skill, via });
    }
    if (isRequired) result.missing.push(skill);
  };

  required.forEach((s) => evaluate(s, 1, true));
  preferred.forEach((s) => evaluate(s, 0.5, false));

  result.score = Math.round((earned / possible) * 100);
  return result;
}

// ---------- Interests (25%) ----------
function scoreInterests(student, opp) {
  const interests = student.interests || [];
  const result = { score: null, matched: [] };
  if (!interests.length) return result;

  const catalog = db.read('skills_catalog').interests || [];
  const text = oppText(opp);
  for (const name of interests) {
    const def = catalog.find((i) => i.name === name);
    const keywords = def ? def.keywords : [name.toLowerCase()];
    if (keywords.some((k) => text.includes(k.toLowerCase())) || text.includes(name.toLowerCase())) {
      result.matched.push(name);
    }
  }
  const n = result.matched.length;
  result.score = n === 0 ? 10 : Math.min(100, 60 + (n - 1) * 20); // 1 → 60, 2 → 80, 3+ → 100
  return result;
}

// ---------- Academic background (15%) ----------
function scoreAcademic(student, opp) {
  const result = { score: null, level: null };
  if (!student.programme) return result;

  const programmes = db.read('programmes');
  const prog = programmes.find((p) => p.name === student.programme);
  const targets = opp.targetProgrammes || [];
  const fields = opp.academicFields || [];

  if (targets.includes(student.programme)) { result.score = 100; result.level = 'target'; }
  else if (fields.includes(student.programme)) { result.score = 85; result.level = 'field'; }
  else if (prog && [...targets, ...fields].some((t) => prog.related.includes(t))) { result.score = 70; result.level = 'related'; }
  else if (opp.openToAll || (!targets.length && !fields.length)) { result.score = 60; result.level = 'open'; }
  else { result.score = 30; result.level = 'outside'; }
  return result;
}

// ---------- Experience (10%) ----------
function scoreExperience(student, opp) {
  const exp = student.experience || [];
  const result = { score: null, relevant: [] };
  if (!exp.length) return result;

  const categories = db.read('categories');
  const relevantTypes = new Set();
  (opp.categories || []).forEach((c) => {
    const cat = categories.find((x) => x.id === c);
    if (cat) cat.experienceTypes.forEach((t) => relevantTypes.add(t));
  });
  const oppSkills = [...(opp.requiredSkills || []), ...(opp.preferredSkills || [])].map((s) => s.toLowerCase());

  for (const e of exp) {
    const title = (e.title || '').toLowerCase();
    if (relevantTypes.has(e.type) || oppSkills.some((s) => title.includes(s.toLowerCase()))) result.relevant.push(e);
  }
  const n = result.relevant.length;
  const beginnerFriendly = !opp.experienceLevel || ['Any', 'Beginner'].includes(opp.experienceLevel);
  // No relevant experience never excludes students from beginner-friendly opportunities (§6.5)
  result.score = n === 0 ? (beginnerFriendly ? 50 : 20) : n === 1 ? 75 : 100;
  return result;
}

function labelFor(score) {
  return LABELS.find((l) => score >= l.min);
}

/** Full compatibility calculation for one student × one opportunity. */
function computeScore(student, opp) {
  const skills = scoreSkills(student, opp);
  const interests = scoreInterests(student, opp);
  const academic = scoreAcademic(student, opp);
  const experience = scoreExperience(student, opp);

  const dims = { skills: skills.score, interests: interests.score, academic: academic.score, experience: experience.score };

  // If the opportunity itself lists no skills, skills can't be scored — that's not the student's fault.
  const oppHasSkills = (opp.requiredSkills || []).length + (opp.preferredSkills || []).length > 0;

  // Not enough info to produce a meaningful score (§7.2)
  if (dims.skills === null && dims.interests === null) {
    return { score: null, provisional: true, insufficient: true, breakdown: dims, skills, interests, academic, experience };
  }

  let total = 0;
  let weightUsed = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (dims[k] !== null) { total += dims[k] * w; weightUsed += w; }
  }
  const score = Math.round(total / weightUsed);
  const missingDims = Object.keys(dims).filter((k) => dims[k] === null && !(k === 'skills' && !oppHasSkills));
  const l = labelFor(score);

  return {
    score,
    label: l.label,
    tone: l.tone,
    provisional: missingDims.length > 0,
    missingDimensions: missingDims,
    insufficient: false,
    breakdown: dims,
    skills, interests, academic, experience,
  };
}

module.exports = { computeScore, labelFor };
