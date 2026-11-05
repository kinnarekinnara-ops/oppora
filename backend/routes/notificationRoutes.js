// notificationRoutes.js — the student's notification centre (Student Portal §10).
const db = require('../services/db');
const auth = require('../middleware/auth');

function register(router) {
  router.get('/api/notifications', auth.requireStudent, async (req) => {
    let items = db.read('notifications').filter((n) => n.studentId === req.user.id);
    const unread = items.filter((n) => !n.read).length;
    if (req.query.filter === 'unread') items = items.filter((n) => !n.read);
    else if (req.query.filter) items = items.filter((n) => n.type === req.query.filter);
    const opps = db.read('opportunities');
    items = items.map((n) => {
      const o = opps.find((x) => x.id === n.opportunityId);
      return { ...n, opportunityTitle: o ? o.title : null, opportunityDeadline: o ? o.deadline : null };
    });
    return { items, unread };
  });

  router.post('/api/notifications/read-all', auth.requireStudent, async (req) => {
    const all = db.read('notifications');
    all.forEach((n) => { if (n.studentId === req.user.id) n.read = true; });
    db.write('notifications', all);
    return { ok: true };
  });

  router.post('/api/notifications/:id/read', auth.requireStudent, async (req) => {
    const all = db.read('notifications');
    const n = all.find((x) => x.id === req.params.id && x.studentId === req.user.id);
    if (n) { n.read = true; db.write('notifications', all); }
    return { ok: true };
  });

  router.delete('/api/notifications/:id', auth.requireStudent, async (req) => {
    db.remove('notifications', (n) => n.id === req.params.id && n.studentId === req.user.id);
    return { ok: true };
  });
}

module.exports = { register };
