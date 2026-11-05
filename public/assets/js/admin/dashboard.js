// =============================================================
// Admin dashboard (Admin Portal §3): stats, opportunity overview,
// recent activity and quick actions.
// =============================================================
const ACTION_TEXT = {
  'opportunity.created': 'created', 'opportunity.published': 'published', 'opportunity.updated': 'updated', 'opportunity.submitted': 'submitted for approval',
  'opportunity.approved': 'approved', 'opportunity.rejected': 'returned', 'opportunity.paused': 'paused', 'opportunity.closed': 'closed',
  'opportunity.archived': 'archived', 'opportunity.auto_closed': 'auto-closed', 'opportunity.rematched': 're-matched', 'opportunity.deleted': 'deleted',
  'opportunity.draft': 'moved to draft', 'organization.created': 'added organization', 'organization.updated': 'updated organization',
  'admin_user.created': 'created admin', 'admin_user.updated': 'updated admin', 'student.suspended': 'suspended student', 'student.active': 'reactivated student',
};
function activityItem(l) {
  const verb = ACTION_TEXT[l.action] || l.action;
  return `<li><span class="dot ${esc(l.action.split('.')[1] || '')}"></span><div class="grow"><b class="strong">${esc(l.actorName)}</b> ${esc(verb)} <b>${esc(l.targetName || '')}</b>
    ${l.details ? `<div class="xs muted">${esc(l.details)}</div>` : ''}</div><span class="xs muted" style="white-space:nowrap">${timeAgo(l.at)}</span></li>`;
}

(async function () {
  const me = await adminPage('dashboard', { title: 'Dashboard' });
  const page = $('#page');
  let d;
  try { d = await api('/api/admin/dashboard'); } catch (err) { page.innerHTML = errorState(err); return; }
  const s = d.stats;

  const miniList = (list, empty, right) => list.length ? `<div class="mini-list">${list.map((o) => `
    <a class="row-item" href="/admin/matching.html?id=${encodeURIComponent(o.id)}" style="text-decoration:none;color:inherit">
      <span class="grow"><b class="strong small" style="display:block">${esc(o.title)}</b><span class="xs muted">${esc(o.organizer)}</span></span>${right(o)}</a>`).join('')}</div>`
    : `<p class="small muted" style="padding:10px 0">${empty}</p>`;

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Welcome back, ${esc(me.user.name.split(' ').slice(-1)[0])}</h1><p>${me.staff ? 'Platform overview' : `Overview for ${esc(me.organization || 'your organization')}`} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <a class="btn green" href="/admin/opportunity-form.html">${icon('plus')} ${me.user.role === 'org_rep' ? 'Submit opportunity' : 'Create opportunity'}</a>
    </div>
    <div class="grid cols-4">
      <div class="stat"><div class="ico" style="background:var(--tint-blue)">🎓</div><div class="label">Registered students</div><div class="value">${s.students}</div></div>
      <div class="stat"><div class="ico" style="background:var(--tint-green)">📌</div><div class="label">Active opportunities</div><div class="value">${s.active}</div><div class="hint">${s.published} published in total</div></div>
      <div class="stat"><div class="ico" style="background:var(--tint-yellow)">🎯</div><div class="label">Student matches</div><div class="value">${s.matches}</div><div class="hint">Eligible, 40%+ compatibility</div></div>
      <div class="stat"><div class="ico" style="background:var(--tint-blue)">🔔</div><div class="label">Notifications sent</div><div class="value">${s.notifications}</div><div class="hint">${s.organizations} organizations active</div></div>
    </div>
    ${s.pending && me.staff ? `<div class="alert warn" style="margin-top:20px;align-items:center">⏳ <span class="grow"><b>${s.pending} opportunit${s.pending > 1 ? 'ies are' : 'y is'} awaiting approval.</b></span><a class="btn yellow sm" href="/admin/approvals.html">Review now</a></div>` : ''}
    <div class="grid cols-3" style="margin-top:24px;align-items:start">
      <div class="card"><div class="row between"><h3>🆕 Recently published</h3><a class="small" href="/admin/opportunities.html?status=published">All →</a></div>
        ${miniList(d.recent, 'Nothing published yet.', (o) => `<span class="badge green" title="Recommended to">${o.stats.recommended} matched</span>`)}</div>
      <div class="card"><div class="row between"><h3>⏳ Deadlines this week</h3></div>
        ${miniList(d.closingSoon, 'No deadlines in the next 7 days.', (o) => `<span class="badge ${o.daysLeft <= 3 ? 'yellow' : 'blue'}">${daysLeftText(o.daysLeft)}</span>`)}</div>
      <div class="card"><div class="row between"><h3>📅 Upcoming events</h3></div>
        ${miniList(d.upcoming, 'No upcoming events.', (o) => `<span class="xs muted" style="white-space:nowrap">${fmtDate(o.eventDate)}</span>`)}</div>
    </div>
    <div class="grid cols-2" style="margin-top:20px;align-items:start">
      <div class="card"><div class="row between"><h3>📝 Recent activity</h3><a class="small" href="/admin/activity-logs.html">Full log →</a></div>
        <ul class="activity" style="margin-top:6px">${d.activity.map(activityItem).join('') || '<li class="muted">No activity yet.</li>'}</ul></div>
      <div class="stack">
        <div class="card"><h3>${me.staff ? '⏳ Awaiting approval' : '📤 My pending submissions'}</h3>
          ${miniList(d.pending, 'Nothing pending.', () => statusPill('pending_approval'))}</div>
        <div class="card"><h3>📁 Closed recently</h3>${miniList(d.closed, 'No closed opportunities.', () => statusPill('closed'))}</div>
        <div class="card blue"><h3>Quick actions</h3>
          <div class="row wrap" style="margin-top:12px">
            <a class="btn primary sm" href="/admin/opportunities.html">Manage opportunities</a>
            ${me.staff ? '<a class="btn outline sm" href="/admin/approvals.html">Review submissions</a>' : ''}
            <a class="btn outline sm" href="/admin/organizations.html">Organizations</a>
            <a class="btn outline sm" href="/admin/analytics.html">Analytics</a>
          </div></div>
      </div>
    </div>`;
})();
