// =============================================================
// seed.js — (re)creates the demo database.
//   node scripts/seed.js      → wipes and recreates all demo data
// Dates are relative to TODAY so the demo always looks fresh.
// Reference files (skills_catalog, categories, programmes) are kept.
// =============================================================
const db = require('../backend/services/db');
const { hashPassword } = require('../backend/middleware/auth');
const { fromToday } = require('../backend/lib/dates');

function daysAgoIso(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seed() {
  db.clearCache();
  require('../backend/services/skillNormalizer').reload();
  for (const name of ['users', 'students', 'opportunities', 'organizations', 'matches', 'saved', 'notifications', 'activity_logs', 'sessions']) {
    db.write(name, []);
  }

  // ---------------- Organizations ----------------
  const orgs = [
    { id: 'org_cyber', name: 'Cybersecurity & Linux Club', type: 'Club', email: 'cyberclub@oppora.edu' },
    { id: 'org_sca', name: 'Student Affairs Office', type: 'Office', email: 'studentaffairs@oppora.edu' },
    { id: 'org_fcs', name: 'Faculty of Computing', type: 'Faculty', email: 'computing@oppora.edu' },
    { id: 'org_career', name: 'Career Development Centre', type: 'Department', email: 'careers@oppora.edu' },
    { id: 'org_ai', name: 'AI & Data Society', type: 'Society', email: 'aidata@oppora.edu' },
    { id: 'org_green', name: 'Green Campus Volunteers', type: 'Club', email: 'green@oppora.edu' },
    { id: 'org_robotics', name: 'Robotics Club', type: 'Club', email: 'robotics@oppora.edu' },
  ].map((o) => ({ ...o, description: '', status: 'active', createdAt: daysAgoIso(60) }));
  db.write('organizations', orgs);

  // ---------------- Admin accounts ----------------
  const mkUser = (id, name, email, password, role, organizationId = null) => {
    const { salt, hash } = hashPassword(password);
    return { id, name, email, role, organizationId, salt, passwordHash: hash, status: 'active', createdAt: daysAgoIso(45) };
  };
  const users = [
    mkUser('usr_admin', 'Dr. Sarah Lee', 'admin@oppora.edu', 'admin123', 'super_admin'),
    mkUser('usr_staff', 'Mr. Kevin Raj', 'staff@oppora.edu', 'staff123', 'opportunity_admin'),
    mkUser('usr_club', 'Aiman Hakim', 'club@oppora.edu', 'club123', 'org_rep', 'org_cyber'),
    mkUser('usr_robot', 'Grace Chen', 'robotics@oppora.edu', 'robot123', 'org_rep', 'org_robotics'),
  ];

  // ---------------- Students ----------------
  const S = (level) => (name) => ({ name, level });
  const students = [
    {
      id: 'stu_alex', name: 'Alex Tan', email: 'alex@student.oppora.edu',
      profile: {
        programme: 'Cybersecurity', faculty: 'Computing', year: 2, studyLevel: 'Undergraduate',
        skills: [S('Beginner')('Linux'), S('Intermediate')('Networking'), S('Beginner')('Python'), S('Beginner')('Web Security'), S('Intermediate')('Teamwork'), S('Intermediate')('Problem Solving')],
        interests: ['Cybersecurity', 'Cloud & Infrastructure', 'Software Engineering'],
        experience: [{ type: 'competition', title: 'Inter-varsity CTF 2025', year: '2025' }],
        certifications: ['CompTIA IT Fundamentals'],
        careerGoals: 'Become a security engineer and get a cybersecurity internship next year.',
      },
    },
    {
      id: 'stu_priya', name: 'Priya Nair', email: 'priya@student.oppora.edu',
      profile: {
        programme: 'Artificial Intelligence', faculty: 'Computing', year: 3, studyLevel: 'Undergraduate',
        skills: [S('Advanced')('Python'), S('Intermediate')('Machine Learning'), S('Intermediate')('Data Analysis'), S('Beginner')('Research'), S('Intermediate')('Public Speaking')],
        interests: ['Artificial Intelligence', 'Research', 'Data Science'],
        experience: [{ type: 'hackathon', title: 'GenAI Hackathon 2025', year: '2025' }, { type: 'project', title: 'Sign-language recognition app', year: '2025' }],
        certifications: ['Google Data Analytics'],
        careerGoals: 'Pursue AI research and publish a paper before graduating.',
      },
    },
    {
      id: 'stu_daniel', name: 'Daniel Lim', email: 'daniel@student.oppora.edu',
      profile: {
        programme: 'Software Engineering', faculty: 'Computing', year: 1, studyLevel: 'Undergraduate',
        skills: [S('Intermediate')('JavaScript'), S('Intermediate')('Web Development'), S('Beginner')('Database Management'), S('Beginner')('UI/UX Design')],
        interests: ['Software Engineering', 'Entrepreneurship', 'Design & Creativity'],
        experience: [{ type: 'project', title: 'Personal portfolio website', year: '2026' }],
        certifications: [], careerGoals: 'Build my own startup.',
      },
    },
    {
      id: 'stu_siti', name: 'Siti Aisyah', email: 'siti@student.oppora.edu',
      profile: {
        programme: 'Business Management', faculty: 'Business', year: 2, studyLevel: 'Undergraduate',
        skills: [S('Advanced')('Communication'), S('Intermediate')('Leadership'), S('Intermediate')('Event Management'), S('Beginner')('Digital Marketing')],
        interests: ['Leadership', 'Entrepreneurship', 'Community & Volunteering'],
        experience: [{ type: 'club', title: 'Treasurer, Business Society', year: '2025' }, { type: 'volunteering', title: 'Food bank volunteer', year: '2025' }],
        certifications: [], careerGoals: 'Lead a social enterprise.',
      },
    },
    {
      id: 'stu_marcus', name: 'Marcus Wong', email: 'marcus@student.oppora.edu',
      profile: {
        programme: 'Computer Science', faculty: 'Computing', year: 4, studyLevel: 'Undergraduate',
        skills: [S('Advanced')('Linux'), S('Intermediate')('Cloud Computing'), S('Advanced')('Java'), S('Intermediate')('Networking'), S('Intermediate')('System Administration')],
        interests: ['Cloud & Infrastructure', 'Software Engineering', 'Career Development'],
        experience: [{ type: 'internship', title: 'DevOps intern, local fintech', year: '2025' }, { type: 'hackathon', title: 'Campus Hack 2024', year: '2024' }],
        certifications: ['AWS Cloud Practitioner'], careerGoals: 'Land a graduate cloud engineering role.',
      },
    },
    {
      id: 'stu_iman', name: 'Nur Iman', email: 'iman@student.oppora.edu',
      profile: {
        programme: 'Computer Engineering', faculty: 'Engineering', year: 3, studyLevel: 'Undergraduate',
        skills: [S('Intermediate')('IoT'), S('Intermediate')('C/C++'), S('Beginner')('Python'), S('Beginner')('Robotics')],
        interests: ['Hardware & IoT', 'Research', 'Artificial Intelligence'],
        experience: [{ type: 'project', title: 'Smart parking sensor prototype', year: '2025' }],
        certifications: [], careerGoals: 'Work on embedded AI systems.',
      },
    },
    {
      id: 'stu_jason', name: 'Jason Ong', email: 'jason@student.oppora.edu',
      profile: {
        programme: 'Multimedia & Design', faculty: 'Design', year: 2, studyLevel: 'Undergraduate',
        skills: [S('Advanced')('UI/UX Design'), S('Intermediate')('Graphic Design'), S('Beginner')('Web Development')],
        interests: ['Design & Creativity', 'Entrepreneurship'],
        experience: [], certifications: [], careerGoals: '',
      },
    },
    {
      id: 'stu_mei', name: 'Mei Ling', email: 'mei@student.oppora.edu',
      profile: {
        programme: 'Accounting & Finance', faculty: 'Business', year: 1, studyLevel: 'Undergraduate',
        skills: [], interests: ['Business'], experience: [], certifications: [], careerGoals: '',
      },
    },
  ];

  for (const s of students) {
    users.push(mkUser(s.id, s.name, s.email, 'student123', 'student'));
  }
  db.write('users', users);
  db.write('students', students.map((s) => ({
    id: s.id, university: 'OPPORA Demo University', ...s.profile,
    notificationPrefs: { newMatches: true, general: true, deadlines: true, updates: true },
    createdAt: daysAgoIso(40), updatedAt: daysAgoIso(10),
  })));

  // ---------------- Opportunities ----------------
  const base = { viewedBy: [], clickedBy: [], attachments: [], knowledgeAreas: [], academicFields: [], preferredSkills: [], targetProgrammes: [],
    eligibleYears: [], studyLevels: [], mandatoryRequirements: [], openToAll: false, restrictToProgrammes: false, maxParticipants: null,
    deliveryMode: 'In-person', applicationInstructions: '', aiAssisted: false, aiSource: null, eventEndDate: '' };
  const opp = (o) => ({ ...base, ...o, organizer: orgs.find((x) => x.id === o.organizationId).name, createdAt: o.publishedAt || daysAgoIso(3), updatedAt: o.publishedAt || daysAgoIso(3) });

  const opportunities = [
    opp({
      id: 'opp_linux', title: 'Linux Systems Challenge 2026', organizationId: 'org_cyber', categories: ['technical'],
      description: 'A beginner-friendly competition involving Linux command-line operations, basic networking, system administration and troubleshooting. Work in teams of three to fix broken servers against the clock. Mentors from the Cybersecurity & Linux Club will be on hand, and all participants receive a certificate.',
      requiredSkills: ['Linux', 'Networking', 'System Administration', 'Troubleshooting'], preferredSkills: ['Teamwork'],
      experienceLevel: 'Beginner', targetProgrammes: ['Software Engineering'], academicFields: ['Cybersecurity', 'Computer Science', 'Software Engineering'],
      knowledgeAreas: ['Linux command line', 'Server troubleshooting'], eventDate: fromToday(16), deadline: fromToday(9),
      location: 'Lab 4-02, Block B', registrationLink: 'https://forms.example.com/linux-challenge', maxParticipants: 60,
      status: 'published', publishedAt: daysAgoIso(1), aiAssisted: true, aiSource: 'rules', createdBy: 'usr_club',
    }),
    opp({
      id: 'opp_ai', title: 'AI Innovation Challenge', organizationId: 'org_ai', categories: ['technical'],
      description: 'Build an AI-powered solution for a smart campus problem in 48 hours. Teams will train machine learning models, analyse campus data and pitch to industry judges. Participants should be comfortable programming in Python.',
      requiredSkills: ['Python', 'Machine Learning', 'Data Analysis'], preferredSkills: ['Public Speaking', 'UI/UX Design'],
      experienceLevel: 'Intermediate', targetProgrammes: ['Artificial Intelligence', 'Computer Science', 'Software Engineering', 'Data Science'],
      academicFields: ['Artificial Intelligence', 'Data Science'], eligibleYears: [2, 3, 4],
      mandatoryRequirements: [{ type: 'skill', value: 'Python', minLevel: '' }],
      eventDate: fromToday(21), eventEndDate: fromToday(23), deadline: fromToday(12), location: 'Innovation Hub',
      registrationLink: 'https://forms.example.com/ai-challenge', maxParticipants: 120, status: 'published', publishedAt: daysAgoIso(3), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_ra', title: 'Research Assistant — Smart Campus IoT Lab', organizationId: 'org_fcs', categories: ['academic'],
      description: 'The Smart Campus IoT Lab is recruiting two part-time research assistants to help build sensor networks and analyse occupancy data. You will co-author a conference paper. Applicants must be from Computer Science or Computer Engineering in Year 3 or 4.',
      requiredSkills: ['IoT', 'Python', 'Data Analysis'], preferredSkills: ['C/C++', 'Research'],
      experienceLevel: 'Intermediate', targetProgrammes: ['Computer Science', 'Computer Engineering'], restrictToProgrammes: true,
      academicFields: ['Computer Engineering', 'Computer Science'], eligibleYears: [3, 4],
      mandatoryRequirements: [{ type: 'text', value: 'Available for 10 hours per week during the semester' }],
      eventDate: fromToday(35), deadline: fromToday(20), location: 'IoT Lab, Engineering Block', deliveryMode: 'Hybrid',
      registrationLink: 'https://forms.example.com/ra-iot', applicationInstructions: 'Submit your CV and a one-page statement of interest.', maxParticipants: 2,
      status: 'published', publishedAt: daysAgoIso(5), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_mentor', title: 'Industry Mentorship Programme', organizationId: 'org_career', categories: ['professional'],
      description: 'Get matched with an industry mentor for 8 weeks. Monthly one-to-one sessions covering career planning, resume reviews, interview skills and professional networking. Open to all students regardless of programme.',
      requiredSkills: ['Career Planning', 'Communication'], preferredSkills: [], experienceLevel: 'Any', openToAll: true,
      eventDate: fromToday(14), deadline: fromToday(4), location: 'Online + Career Centre', deliveryMode: 'Hybrid',
      registrationLink: 'https://forms.example.com/mentorship', maxParticipants: 80, status: 'published', publishedAt: daysAgoIso(6), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_council', title: 'Student Council Committee Recruitment', organizationId: 'org_sca', categories: ['activities'],
      description: 'Join the Student Council committee! We are recruiting for events, marketing and community roles. Help organise university-wide festivals and represent student voices. Leadership, teamwork and event planning experience are a plus.',
      requiredSkills: ['Leadership', 'Communication', 'Teamwork'], preferredSkills: ['Event Management', 'Digital Marketing'],
      experienceLevel: 'Any', openToAll: true, eventDate: fromToday(18), deadline: fromToday(11), location: 'Student Centre',
      registrationLink: 'https://forms.example.com/council', status: 'published', publishedAt: daysAgoIso(2), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_green', title: 'Campus Green Volunteering Day', organizationId: 'org_green', categories: ['volunteering'],
      description: 'Spend a Saturday morning planting trees and setting up recycling stations around campus. No experience needed — just bring your energy! Volunteers earn community-service hours.',
      requiredSkills: ['Teamwork'], experienceLevel: 'Beginner', openToAll: true,
      eventDate: fromToday(6), deadline: fromToday(3), location: 'Main Campus Lawn',
      registrationLink: 'https://forms.example.com/green-day', status: 'published', publishedAt: daysAgoIso(4), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_cloud', title: 'Tech Talk: Careers in Cloud Computing', organizationId: 'org_fcs', categories: ['general', 'professional'],
      description: 'A university-wide talk with cloud engineers from the industry. Learn how cloud infrastructure, DevOps and Linux skills translate into graduate roles. Free seminar, open to everyone.',
      requiredSkills: ['Cloud Computing'], preferredSkills: ['Linux'], experienceLevel: 'Any', openToAll: true,
      eventDate: fromToday(8), deadline: fromToday(7), location: 'Auditorium 1',
      registrationLink: 'https://forms.example.com/cloud-talk', status: 'published', publishedAt: daysAgoIso(0), createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_ctf', title: 'Capture The Flag (CTF) Beginner Bootcamp', organizationId: 'org_cyber', categories: ['technical'],
      description: 'A two-day bootcamp introducing ethical hacking, web security and cryptography through hands-on CTF challenges. Ideal for first-timers who want to get into cybersecurity competitions.',
      requiredSkills: ['Ethical Hacking', 'Web Security', 'Linux'], preferredSkills: ['Cryptography', 'Python'],
      experienceLevel: 'Beginner', targetProgrammes: ['Cybersecurity'], academicFields: ['Cybersecurity'],
      eventDate: fromToday(26), deadline: fromToday(15), location: 'Cyber Range Lab',
      registrationLink: 'https://forms.example.com/ctf-bootcamp', maxParticipants: 40, status: 'published', publishedAt: daysAgoIso(8), createdBy: 'usr_club',
    }),
    opp({
      id: 'opp_webhack', title: 'Web Dev Hackathon: Build for Good', organizationId: 'org_sca', categories: ['technical', 'volunteering'],
      description: 'Build websites for local charities in a 24-hour hackathon. Teams need front-end, back-end and design skills. Experience with JavaScript, databases and UI/UX design is recommended.',
      requiredSkills: ['Web Development', 'JavaScript', 'Database Management'], preferredSkills: ['UI/UX Design', 'Teamwork'],
      experienceLevel: 'Intermediate', targetProgrammes: ['Software Engineering', 'Computer Science', 'Information Technology'],
      academicFields: ['Software Engineering'], eventDate: fromToday(30), deadline: fromToday(19), location: 'Innovation Hub',
      registrationLink: 'https://forms.example.com/webhack', status: 'published', publishedAt: daysAgoIso(9), createdBy: 'usr_staff',
    }),
    // --- Non-published examples for the admin portal ---
    opp({
      id: 'opp_robotics', title: 'Robotics Club Open Day', organizationId: 'org_robotics', categories: ['activities'],
      description: 'Come see our line-following and sumo robots, try building a simple Arduino circuit, and meet the team. Great for anyone curious about robotics and embedded systems.',
      requiredSkills: ['Robotics', 'IoT'], experienceLevel: 'Beginner', openToAll: true,
      eventDate: fromToday(13), deadline: fromToday(12), location: 'Engineering Workshop',
      registrationLink: 'https://forms.example.com/robotics-open-day', status: 'pending_approval', submittedAt: daysAgoIso(1), createdBy: 'usr_robot',
    }),
    opp({
      id: 'opp_datasci', title: 'Data Science Workshop Series', organizationId: 'org_ai', categories: ['general'],
      description: 'Draft — four-week workshop series on pandas, visualisation and statistics.',
      requiredSkills: ['Data Analysis', 'Python'], experienceLevel: 'Beginner', openToAll: true,
      eventDate: '', deadline: '', registrationLink: '', status: 'draft', createdBy: 'usr_staff',
    }),
    opp({
      id: 'opp_orient', title: 'Hackathon Orientation Night', organizationId: 'org_sca', categories: ['general'],
      description: 'An evening introducing new students to hackathons, team formation and the campus tech community.',
      requiredSkills: ['Programming'], experienceLevel: 'Any', openToAll: true,
      eventDate: fromToday(-3), deadline: fromToday(-6), location: 'Auditorium 2',
      registrationLink: 'https://forms.example.com/orientation', status: 'closed', publishedAt: daysAgoIso(20), closedAt: daysAgoIso(6), createdBy: 'usr_staff',
    }),
  ];
  // Fake some engagement so analytics isn't empty
  const ids = students.map((s) => s.id);
  opportunities.forEach((o, i) => {
    if (['published', 'closed'].includes(o.status)) {
      o.viewedBy = ids.filter((_, j) => (i + j) % 3 !== 0);
      o.clickedBy = ids.filter((_, j) => (i + j) % 4 === 0);
    }
  });
  db.write('opportunities', opportunities);

  // ---------------- Run the real matching engine ----------------
  const engine = require('../backend/services/matchingEngine');
  const published = opportunities.filter((o) => o.status === 'published').sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  for (const o of published) {
    const stats = engine.matchOpportunity(o.id, { sendNotifications: true });
    db.update('opportunities', o.id, { lastMatchStats: { ...stats, at: o.publishedAt } });
    // Back-date notifications to when the opportunity was published
    const all = db.read('notifications');
    all.forEach((n) => { if (n.opportunityId === o.id) n.createdAt = o.publishedAt; });
    db.write('notifications', all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  // Older notifications are already read
  const all = db.read('notifications');
  all.forEach((n) => { if (n.createdAt < daysAgoIso(3)) n.read = true; });
  db.write('notifications', all);

  // ---------------- Saved items ----------------
  const now = new Date().toISOString();
  db.write('saved', [
    { id: 'sav_1', studentId: 'stu_alex', opportunityId: 'opp_ctf', trackingStatus: 'registered', savedAt: daysAgoIso(6) },
    { id: 'sav_2', studentId: 'stu_alex', opportunityId: 'opp_mentor', trackingStatus: 'planning', savedAt: daysAgoIso(4) },
    { id: 'sav_3', studentId: 'stu_alex', opportunityId: 'opp_green', trackingStatus: 'saved', savedAt: daysAgoIso(2) },
    { id: 'sav_4', studentId: 'stu_priya', opportunityId: 'opp_ai', trackingStatus: 'planning', savedAt: daysAgoIso(2) },
    { id: 'sav_5', studentId: 'stu_marcus', opportunityId: 'opp_cloud', trackingStatus: 'saved', savedAt: now },
    { id: 'sav_6', studentId: 'stu_siti', opportunityId: 'opp_council', trackingStatus: 'saved', savedAt: daysAgoIso(1) },
    { id: 'sav_7', studentId: 'stu_daniel', opportunityId: 'opp_webhack', trackingStatus: 'saved', savedAt: daysAgoIso(5) },
  ]);
  require('../backend/services/notificationService').sendDeadlineReminders();

  // ---------------- Activity log history ----------------
  const logs = [];
  const add = (at, actor, action, opp, details = '') => {
    const u = users.find((x) => x.id === actor);
    logs.push({ id: db.newId('log'), actorId: u.id, actorName: u.name, actorRole: u.role, action, targetType: 'opportunity', targetId: opp.id, targetName: opp.title, details, at });
  };
  for (const o of opportunities) {
    add(o.createdAt, o.createdBy, 'opportunity.created', o, o.aiAssisted ? 'AI-assisted (rules)' : '');
    if (o.publishedAt) add(o.publishedAt, o.createdBy === 'usr_club' ? 'usr_staff' : o.createdBy, 'opportunity.published', o,
      `Matched ${(db.findById('opportunities', o.id).lastMatchStats || {}).recommended || 0} students`);
    if (o.status === 'pending_approval') add(o.submittedAt, o.createdBy, 'opportunity.submitted', o, 'Submitted for approval');
    if (o.status === 'closed') logs.push({ id: db.newId('log'), actorId: 'system', actorName: 'OPPORA System', actorRole: 'system', action: 'opportunity.auto_closed', targetType: 'opportunity', targetId: o.id, targetName: o.title, details: 'Registration deadline passed', at: o.closedAt });
  }
  db.write('activity_logs', logs.sort((a, b) => b.at.localeCompare(a.at)));

  const count = (n) => db.read(n).length;
  console.log(`Seeded: ${count('users')} users, ${count('opportunities')} opportunities, ${count('matches')} matches, ${count('notifications')} notifications.`);
}

module.exports = { seed };

if (require.main === module) seed();
