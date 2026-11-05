// =============================================================
// test-api.js — end-to-end check of the whole OPPORA flow.
//   npm test
// Starts the server on port 3999, runs the demo story through the
// real API, then re-seeds the demo data so nothing is left behind.
// =============================================================
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: this.cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, data };
  }
  get(u) { return this.req('GET', u); }
  post(u, b) { return this.req('POST', u, b); }
  put(u, b) { return this.req('PUT', u, b); }
  login(email, password) { return this.post('/api/auth/login', { email, password }); }
}

function day(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log('\n1. Authentication & roles');
  const admin = new Client();
  check('admin login', (await admin.login('admin@oppora.edu', 'admin123')).status === 200);
  check('wrong password rejected', (await new Client().login('admin@oppora.edu', 'nope')).status === 401);
  const alex = new Client();
  check('student login', (await alex.login('alex@student.oppora.edu', 'student123')).status === 200);
  check('student blocked from admin API', (await alex.get('/api/admin/dashboard')).status === 403);
  check('anonymous blocked', (await new Client().get('/api/student/dashboard')).status === 401);

  console.log('\n2. Matching engine — the cross-disciplinary story');
  const linux = (await alex.get('/api/opportunities/opp_linux')).data.match;
  check('Alex (Cybersecurity) matches Linux Challenge aimed at Software Engineering', linux.score >= 80, `score=${linux.score}`);
  check('flagged as cross-disciplinary', linux.crossDisciplinary === true);
  check('explanation mentions real skills', linux.reasons.some((r) => r.includes('Linux')));
  check('skill gaps shown as growth areas', linux.improve.includes('Troubleshooting'));
  const ra = (await alex.get('/api/opportunities/opp_ra')).data.match;
  check('mandatory programme restriction excludes Alex from RA role', ra.eligibility === 'not_eligible');
  const mei = new Client();
  await mei.login('mei@student.oppora.edu', 'student123');
  const meiDash = (await mei.get('/api/student/dashboard')).data;
  check('incomplete profile → provisional scores', meiDash.recommended.every((r) => r.match.provisional));

  console.log('\n3. AI extraction (rule-based fallback works without a key)');
  const ai = (await admin.post('/api/ai/extract', {
    title: 'Python Data Hackathon',
    description: 'A beginner-friendly hackathon on data analysis and machine learning with Python. Teamwork and presentation skills help.',
  })).data;
  check('AI returns suggestions', ai.ok && ai.suggestions.requiredSkills.includes('Python'), JSON.stringify(ai.suggestions));
  check('AI suggests category', ai.suggestions.categories.includes('technical'));
  check('AI detects level', ai.suggestions.experienceLevel === 'Beginner');

  console.log('\n4. Publish → match → notify');
  const bad = await admin.post('/api/admin/opportunities', { title: 'Hi', action: 'publish' });
  check('validation rejects incomplete opportunity', bad.status === 400 && bad.data.fields.title);
  const created = (await admin.post('/api/admin/opportunities', {
    action: 'publish', title: 'Python Data Hackathon', description: 'A beginner-friendly hackathon on data analysis and machine learning with Python. Teamwork and presentation skills help.',
    categories: ['technical'], organizationId: 'org_ai', experienceLevel: 'Beginner', requiredSkills: ['Python', 'Data Analysis', 'Machine Learning'],
    preferredSkills: ['Teamwork'], eventDate: day(20), deadline: day(10), registrationLink: 'https://example.com/r',
    targetProgrammes: ['Artificial Intelligence', 'Data Science'],
  })).data;
  check('published with match stats', created.matchStats && created.matchStats.evaluated === 8, JSON.stringify(created.matchStats));
  check('students notified', created.matchStats.notified >= 1);
  const priya = new Client();
  await priya.login('priya@student.oppora.edu', 'student123');
  const pn = (await priya.get('/api/notifications')).data.items;
  check('Priya (AI student) got a notification', pn.some((n) => n.opportunityId === created.opportunity.id));
  const again = (await admin.post(`/api/admin/opportunities/${created.opportunity.id}/rematch`)).data;
  check('re-matching does not duplicate notifications', again.matchStats.notified === 0);

  console.log('\n5. Student actions');
  check('save opportunity', (await alex.post('/api/saved/opp_linux')).status === 200);
  check('update tracking status', (await alex.put('/api/saved/opp_linux', { trackingStatus: 'planning' })).status === 200);
  const saved = (await alex.get('/api/saved')).data.items;
  check('saved list contains it', saved.some((s) => s.id === 'opp_linux' && s.trackingStatus === 'planning'));
  const search = (await alex.get('/api/opportunities?q=linux&status=all')).data.items;
  check('search finds Linux opportunities', search.length >= 1);
  const before = (await alex.get('/api/student/profile')).data.profile;
  const upd = (await alex.put('/api/student/profile', { skills: [...before.skills, { name: 'sysadmin', level: 'Beginner' }, { name: 'Troubleshooting', level: 'Beginner' }] })).data;
  check('synonym normalised ("sysadmin" → System Administration)', upd.profile.skills.some((s) => s.name === 'System Administration'));
  const linux2 = (await alex.get('/api/opportunities/opp_linux')).data.match;
  check('profile update raised the Linux score', linux2.score > linux.score, `${linux.score} → ${linux2.score}`);

  console.log('\n6. Edits notify students who saved it');
  await admin.put('/api/admin/opportunities/opp_linux', { deadline: day(12) });
  const an = (await alex.get('/api/notifications')).data.items;
  check('Alex got an update notification', an.some((n) => n.type === 'update' && n.opportunityId === 'opp_linux'));

  console.log('\n7. Organization representative + approvals');
  const club = new Client();
  await club.login('club@oppora.edu', 'club123');
  const sub = (await club.post('/api/admin/opportunities', {
    action: 'publish', title: 'Wireshark Workshop', description: 'Hands-on packet analysis workshop for beginners using Wireshark and basic networking concepts.',
    categories: ['technical'], requiredSkills: ['Networking'], eventDate: day(9), deadline: day(7), registrationLink: 'https://example.com/w', openToAll: true,
  })).data;
  check('org rep submission goes to approval', sub.opportunity.status === 'pending_approval');
  check('org rep forced to own organization', sub.opportunity.organizationId === 'org_cyber');
  check('org rep cannot edit other orgs', (await club.put('/api/admin/opportunities/opp_ai', { title: 'Hacked' })).status === 403);
  check('org rep cannot approve', (await club.post(`/api/admin/opportunities/${sub.opportunity.id}/approve`)).status === 403);
  const m = (await club.get('/api/admin/opportunities/opp_linux/matches')).data;
  check('org rep sees anonymised match rows', m.anonymised && m.rows.every((r) => r.studentId === null));
  const appr = (await admin.post(`/api/admin/opportunities/${sub.opportunity.id}/approve`)).data;
  check('staff approval publishes + matches', appr.opportunity.status === 'published' && appr.matchStats.evaluated > 0);

  console.log('\n8. Admin data');
  const dash = (await admin.get('/api/admin/dashboard')).data;
  check('dashboard stats', dash.stats.students === 8 && dash.stats.published >= 10);
  check('analytics', (await admin.get('/api/admin/analytics')).data.rows.length >= 10);
  check('activity logged', (await admin.get('/api/admin/logs')).data.items.some((l) => l.action === 'opportunity.approved'));
  const reg = await new Client().post('/api/auth/register', { name: 'Test User', email: 'test@x.edu', password: 'secret1', university: 'Demo U', programme: 'Data Science', year: 2, studyLevel: 'Undergraduate', skills: [{ name: 'python', level: 'Intermediate' }], interests: ['Data Science'] });
  check('registration creates student + matches', reg.status === 200 && reg.data.matches.evaluated > 0);
}

(async () => {
  const root = path.join(__dirname, '..');
  require('./seed').seed();
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), GEMINI_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${BASE}/api/meta`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  try { await run(); } catch (err) { failed++; console.error(err); }
  server.kill();
  require('../backend/services/db').clearCache();
  require('./seed').seed();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
