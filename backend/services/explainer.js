// =============================================================
// explainer.js — template-based "Why this matches you" text
// (Matching doc §8). Every sentence is built from ACTUAL profile data:
// we never claim a student has a skill they didn't list, and skill
// gaps are framed as growth areas, not disqualifications.
// =============================================================

function list(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

const EXP_WORDS = {
  hackathon: 'hackathon', competition: 'competition', project: 'project', research: 'research',
  internship: 'internship', club: 'club', leadership: 'leadership', volunteering: 'volunteering',
  certification: 'certification', mentorship: 'mentorship',
};

function explain(student, opp, result, eligibility) {
  const reasons = [];
  const { skills, interests, academic, experience } = result;

  if (skills.matched.length) {
    reasons.push(`Your ${list(skills.matched)} skill${skills.matched.length > 1 ? 's are' : ' is'} directly relevant to this opportunity.`);
  }
  if (skills.related.length) {
    const r = skills.related.slice(0, 2).map((x) => `${x.via} (related to ${x.skill})`);
    reasons.push(`Your ${list(r)} gives you a head start.`);
  }
  if (interests.matched.length) {
    reasons.push(`It aligns with your interest in ${list(interests.matched)}.`);
  }
  if (academic.level === 'target') {
    reasons.push(`It is aimed at ${student.programme} students.`);
  } else if (academic.level === 'field' || academic.level === 'related') {
    reasons.push(`Your ${student.programme} background provides relevant foundational knowledge.`);
  }
  if (experience.relevant.length) {
    const e = experience.relevant[0];
    reasons.push(`Your previous ${EXP_WORDS[e.type] || e.type} experience${e.title ? ` ("${e.title}")` : ''} is relevant.`);
  }
  if (['Beginner', 'Any', undefined, ''].includes(opp.experienceLevel)) {
    reasons.push(opp.experienceLevel === 'Beginner' ? 'It is beginner-friendly, so you can join without prior experience.' : 'It is open to all experience levels.');
  }

  // Cross-disciplinary discovery (§9): not aimed at their programme, but skills fit
  const targets = opp.targetProgrammes || [];
  const crossDisciplinary = !!(student.programme && targets.length && !targets.includes(student.programme)
    && eligibility.status !== 'not_eligible' && (skills.matched.length || interests.matched.length) && result.score >= 60);
  if (crossDisciplinary) {
    reasons.unshift(`Although it's promoted to ${list(targets)} students, your skills and interests make you a strong candidate.`);
  }

  const notes = [];
  if (result.provisional) {
    const names = { skills: 'skills', interests: 'interests', academic: 'academic programme', experience: 'experience' };
    notes.push(`This score is provisional — add your ${list(result.missingDimensions.map((d) => names[d]))} to make it more accurate.`);
  }

  return {
    reasons: reasons.slice(0, 5),
    improve: skills.missing, // shown as "Potential areas to improve"
    crossDisciplinary,
    notes,
    disclaimer: 'A compatibility score is a guide, not a guarantee of eligibility, acceptance or selection.',
  };
}

module.exports = { explain };
