// =============================================================
// auth.js — passwords, login sessions and role checks.
// Passwords are hashed with scrypt (built into Node) and never stored
// in plain text. Sessions live in data/sessions.json so a server
// restart doesn't log everyone out during the demo.
// =============================================================
const crypto = require('crypto');
const db = require('../services/db');
const { HttpError, parseCookies } = require('../lib/http');
const { ROLES, SESSION_COOKIE, SESSION_DAYS } = require('../config/constants');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  const sessions = db.read('sessions').filter((s) => s.expiresAt > Date.now());
  sessions.push({ token, userId, expiresAt });
  db.write('sessions', sessions);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
  return token;
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) db.write('sessions', db.read('sessions').filter((s) => s.token !== token));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

/** Attach req.user if a valid session cookie exists (never throws). */
function loadUser(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = db.read('sessions').find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) return null;
  const user = db.findById('users', session.userId);
  if (!user || user.status !== 'active') return null;
  req.user = user;
  return user;
}

/** Route guard: any logged-in user. */
function requireAuth(req) {
  if (!req.user && !loadUser(req)) throw new HttpError(401, 'Please log in to continue.');
}

/** Route guard factory: only the listed roles may pass. */
function requireRole(...roles) {
  return (req) => {
    requireAuth(req);
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do this.');
  };
}

const requireStudent = requireRole(ROLES.STUDENT);
const requireAdmin = requireRole(ROLES.SUPER_ADMIN, ROLES.OPP_ADMIN, ROLES.ORG_REP);
const requireStaff = requireRole(ROLES.SUPER_ADMIN, ROLES.OPP_ADMIN); // not org reps
const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);

/** What we send to the browser — never the password hash. */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

module.exports = {
  hashPassword, verifyPassword, createSession, destroySession, loadUser,
  requireAuth, requireRole, requireStudent, requireAdmin, requireStaff, requireSuperAdmin, publicUser,
};
