// =============================================================
// authRoutes.js — register, login, logout, current user, password.
// =============================================================
const db = require('../services/db');
const { HttpError, readBody } = require('../lib/http');
const auth = require('../middleware/auth');
const { matchStudent } = require('../services/matchingEngine');
const { sanitizeProfile } = require('./studentRoutes');
const { ROLES } = require('../config/constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectFor(user) {
  return user.role === ROLES.STUDENT ? '/student/dashboard.html' : '/admin/dashboard.html';
}

function register(router) {
  // ---- Student registration (multi-step form submits everything at once) ----
  router.post('/api/auth/register', async (req, res) => {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const university = String(body.university || '').trim();

    const errors = {};
    if (name.length < 2) errors.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
    if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
    if (!university) errors.university = 'Please enter your university.';
    if (db.read('users').some((u) => u.email === email)) errors.email = 'An account with this email already exists.';
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { fields: errors });

    const { salt, hash } = auth.hashPassword(password);
    const user = db.insert('users', {
      id: db.newId('usr'),
      email, name, role: ROLES.STUDENT, salt, passwordHash: hash,
      status: 'active', createdAt: new Date().toISOString(),
    });

    const profile = {
      id: user.id,
      university,
      ...sanitizeProfile(body),
      notificationPrefs: { newMatches: true, general: true, deadlines: true, updates: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.insert('students', profile);

    const result = matchStudent(user.id, { sendNotifications: true, viaProfileUpdate: false });
    auth.createSession(res, user.id);
    return { user: auth.publicUser(user), redirect: redirectFor(user), matches: result };
  });

  // ---- Login (students and admins share one form) ----
  router.post('/api/auth/login', async (req, res) => {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.read('users').find((u) => u.email === email);
    if (!user || !auth.verifyPassword(String(body.password || ''), user)) {
      throw new HttpError(401, 'Incorrect email or password.');
    }
    if (user.status !== 'active') throw new HttpError(403, 'This account is not active. Please contact an administrator.');
    db.update('users', user.id, { lastLoginAt: new Date().toISOString() });
    auth.createSession(res, user.id);
    return { user: auth.publicUser(user), redirect: redirectFor(user) };
  });

  router.post('/api/auth/logout', async (req, res) => {
    auth.destroySession(req, res);
    return { ok: true };
  });

  // ---- Who am I? Used by every page to draw the navbar ----
  router.get('/api/auth/me', auth.requireAuth, async (req) => {
    const out = { user: auth.publicUser(req.user) };
    if (req.user.role === ROLES.STUDENT) {
      out.unread = db.read('notifications').filter((n) => n.studentId === req.user.id && !n.read).length;
      const p = db.findById('students', req.user.id);
      out.programme = p ? p.programme : null;
    } else if (req.user.organizationId) {
      const org = db.findById('organizations', req.user.organizationId);
      out.organization = org ? org.name : null;
    }
    return out;
  });

  router.post('/api/auth/change-password', auth.requireAuth, async (req) => {
    const body = await readBody(req);
    if (!auth.verifyPassword(String(body.currentPassword || ''), req.user)) throw new HttpError(400, 'Your current password is incorrect.');
    if (String(body.newPassword || '').length < 6) throw new HttpError(400, 'New password must be at least 6 characters.');
    const { salt, hash } = auth.hashPassword(body.newPassword);
    db.update('users', req.user.id, { salt, passwordHash: hash });
    return { ok: true, message: 'Password updated.' };
  });
}

module.exports = { register };
