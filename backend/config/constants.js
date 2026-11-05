// =============================================================
// constants.js — every "magic number" and fixed list in one place.
// Adjust the scoring weights here after testing.
// =============================================================

module.exports = {
  // Matching Engine & AI Logic, section 6.1
  WEIGHTS: { skills: 0.5, interests: 0.25, academic: 0.15, experience: 0.1 },

  // Section 7.3 — presentation labels, NOT eligibility rules
  LABELS: [
    { min: 80, label: 'Strong Match', tone: 'strong' },
    { min: 60, label: 'Good Match', tone: 'good' },
    { min: 40, label: 'Potential Match', tone: 'potential' },
    { min: 0, label: 'Lower Relevance', tone: 'low' },
  ],

  // Students are notified about matches at or above this score
  NOTIFY_THRESHOLD: 60,
  // Recommendations shown on the dashboard start from this score
  RECOMMEND_THRESHOLD: 40,
  // Saved opportunities trigger a reminder this many days before the deadline
  DEADLINE_REMINDER_DAYS: 3,

  ROLES: {
    STUDENT: 'student',
    SUPER_ADMIN: 'super_admin',
    OPP_ADMIN: 'opportunity_admin',
    ORG_REP: 'org_rep',
  },
  ROLE_LABELS: {
    student: 'Student',
    super_admin: 'Super Administrator',
    opportunity_admin: 'Opportunity Administrator',
    org_rep: 'Organization Representative',
  },

  // Admin Portal 4.5
  STATUSES: ['draft', 'pending_approval', 'published', 'paused', 'closed', 'archived'],

  EXPERIENCE_LEVELS: ['Any', 'Beginner', 'Intermediate', 'Advanced'],
  PROFICIENCY: ['Beginner', 'Intermediate', 'Advanced'],
  STUDY_LEVELS: ['Foundation', 'Diploma', 'Undergraduate', 'Postgraduate'],
  EXPERIENCE_TYPES: ['hackathon', 'competition', 'project', 'research', 'internship', 'club', 'leadership', 'volunteering', 'certification', 'mentorship'],
  TRACKING_STATUSES: ['saved', 'planning', 'registered', 'completed'],

  SESSION_COOKIE: 'oppora_sid',
  SESSION_DAYS: 7,
};
