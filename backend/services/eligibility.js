// =============================================================
// eligibility.js — RULE-BASED mandatory checks (Matching doc §5).
// Runs BEFORE scoring. Only requirements the admin explicitly marked
// as mandatory can exclude a student. AI never decides eligibility.
//
// Result:
//   status: 'eligible' | 'not_eligible' | 'unconfirmed'
//   failed:      reasons the student is not eligible
//   unknown:     profile info missing, so we can't confirm
//   selfConfirm: free-text conditions the student must check themselves
// =============================================================
const { normalize } = require('./skillNormalizer');

const LEVEL_RANK = { Beginner: 1, Intermediate: 2, Advanced: 3 };

function checkEligibility(student, opp) {
  const failed = [];
  const unknown = [];
  const selfConfirm = [];

  // A. Academic programme — only when the admin restricted it
  if (!opp.openToAll && opp.restrictToProgrammes && (opp.targetProgrammes || []).length) {
    if (!student.programme) {
      unknown.push('Add your academic programme to confirm programme eligibility.');
    } else if (!opp.targetProgrammes.includes(student.programme)) {
      failed.push(`Open only to ${opp.targetProgrammes.join(', ')} students.`);
    }
  }

  // B. Academic year
  if ((opp.eligibleYears || []).length) {
    if (!student.year) {
      unknown.push('Add your year of study to confirm eligibility.');
    } else if (!opp.eligibleYears.map(Number).includes(Number(student.year))) {
      failed.push(`Open to Year ${opp.eligibleYears.join(', ')} students only (you are in Year ${student.year}).`);
    }
  }

  // B2. Study level
  if ((opp.studyLevels || []).length) {
    if (!student.studyLevel) {
      unknown.push('Add your study level to confirm eligibility.');
    } else if (!opp.studyLevels.includes(student.studyLevel)) {
      failed.push(`Open to ${opp.studyLevels.join(' / ')} students only.`);
    }
  }

  // C/D. Mandatory requirements
  const studentSkills = new Map((student.skills || []).map((s) => [normalize(s.name), s.level]));
  for (const req of opp.mandatoryRequirements || []) {
    if (req.type === 'skill') {
      const skill = normalize(req.value);
      if (!studentSkills.has(skill)) {
        failed.push(`Requires ${skill}${req.minLevel ? ` (${req.minLevel} level or above)` : ''}, which is not on your profile.`);
      } else if (req.minLevel && (LEVEL_RANK[studentSkills.get(skill)] || 1) < LEVEL_RANK[req.minLevel]) {
        failed.push(`Requires ${skill} at ${req.minLevel} level (your profile says ${studentSkills.get(skill) || 'Beginner'}).`);
      }
    } else if (req.value) {
      // Things the system can't verify (availability, prerequisites courses, etc.)
      selfConfirm.push(req.value);
    }
  }

  let status = 'eligible';
  if (failed.length) status = 'not_eligible';
  else if (unknown.length) status = 'unconfirmed';

  return { status, failed, unknown, selfConfirm };
}

module.exports = { checkEligibility };
