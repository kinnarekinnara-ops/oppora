// =============================================================
// Admin dashboard (Admin Portal §3) — reorganised into clear sections:
//   1. Header: greeting, role context, primary actions
//   2. At a glance: four equal KPI cards (role-specific)
//   3. Needs attention: approvals / returned drafts
//   4. Opportunity pipeline: one tabbed table instead of five side-by-side lists
//   5. Recent activity  +  Quick actions (role-specific)
// Every piece of information from the previous dashboard is still here.
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

// Filled icons for the KPI cards
const KPI_ICONS = {
  cap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 1 8.5 12 14l9-4.5V16h2V8.5z"/><path d="M5 12.2V16c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5v-3.8L12 15.7z"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.5c3 0 6 1 7 2-1 6-4 10-8.5 12.5l-5-5C10.5 7.5 11.5 2.5 14.5 2.5zM16 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/><path d="M7.3 13.2 4 12.5l3-4.5 3.2-.3zM10.8 16.7l.7 3.3 4.5-3 .3-3.2zM5.5 16.5c-1.5.5-2.5 2-2.5 4.5 2.5 0 4-1 4.5-2.5z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="3.5"/><circle cx="5.5" cy="9" r="2.5"/><circle cx="18.5" cy="9" r="2.5"/><path d="M12 12.5c3.6 0 6 2 6 5V19H6v-1.5c0-3 2.4-5 6-5zM5.3 13c-.8.9-1.3 2.5-1.3 4H.5v-1c0-1.8 2-3.2 4.8-3zM18.7 13c.8.9 1.3 2.5 1.3 4h3.5v-1c0-1.8-2-3.2-4.8-3z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.6A6.5 6.5 0 0 1 18.5 10.5c0 5 2.5 6.5 2.5 6.5v1H3v-1s2.5-1.5 2.5-6.5a6.5 6.5 0 0 1 5-6.4v-.6A1.5 1.5 0 0 1 12 2zM9.5 19.5h5a2.5 2.5 0 0 1-5 0z"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12v2h-1v3.5L13.5 12l3.5 4.5V20h1v2H6v-2h1v-3.5l3.5-4.5L7 7.5V4H6zM9 4v2.8l3 3.9 3-3.9V4z"/></svg>',
};

// Tiny trend line drawn from the real weekly series
function sparkline(series) {
  const w = 72, h = 32, max = Math.max(...series), min = Math.min(...series), span = max - min || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="kpi__spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path} L${w} ${h} L0 ${h}Z" fill="currentColor" opacity=".1"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

(async function () {
  const me = await adminPage('dashboard', { title: 'Dashboard' });
  const page = $('#page');
  let d;
  try { d = await api('/api/admin/dashboard'); } catch (err) { page.innerHTML = errorState(err); return; }
  const s = d.stats;
  const role = me.user.role;
  const isRep = role === 'org_rep';

  // ---- Role-specific KPIs: [icon, colour, label, value, trend key, fallback hint] ----
  const tr = d.trends || {};
  const kpis = isRep ? [
    ['rocket', 'pink', 'Live opportunities', s.active, 'active', `${s.published} published in total`],
    ['hourglass', 'blue', 'Awaiting approval', s.pending, 'pending', `${s.drafts} draft${s.drafts === 1 ? '' : 's'}`],
    ['people', 'amber', 'Students reached', s.matches, 'matches', 'Eligible, 40%+ compatibility'],
    ['bell', 'violet', 'Notifications sent', s.notifications, 'notifications', 'For your opportunities'],
  ] : [
    ['cap', 'blue', 'Registered students', s.students, 'students', 'Across all programmes'],
    ['rocket', 'pink', 'Active opportunities', s.active, 'active', `${s.published} published in total`],
    ['people', 'amber', 'Student matches', s.matches, 'matches', 'Eligible, 40%+ compatibility'],
    ['bell', 'violet', 'Notifications sent', s.notifications, 'notifications', `${s.organizations} organizations active`],
  ];

  // ---- Role-specific quick actions ----
  const actions = {
    super_admin: [['plus', 'Create opportunity', '/admin/opportunity-form.html'], ['check', 'Review approvals', '/admin/approvals.html'], ['shield', 'Admin users', '/admin/admin-users.html'], ['users', 'Students', '/admin/students.html'], ['building', 'Organizations', '/admin/organizations.html'], ['chart', 'Analytics', '/admin/analytics.html']],
    opportunity_admin: [['plus', 'Create opportunity', '/admin/opportunity-form.html'], ['check', 'Review approvals', '/admin/approvals.html'], ['list', 'Manage opportunities', '/admin/opportunities.html'], ['target', 'Matching review', '/admin/matching.html'], ['users', 'Students', '/admin/students.html'], ['chart', 'Analytics', '/admin/analytics.html']],
    org_rep: [['plus', 'Submit opportunity', '/admin/opportunity-form.html'], ['check', 'My submissions', '/admin/approvals.html'], ['list', 'My opportunities', '/admin/opportunities.html'], ['target', 'Matching review', '/admin/matching.html'], ['chart', 'Analytics', '/admin/analytics.html']],
  }[role];

  const subtitle = {
    super_admin: 'Platform overview — everything happening on OPPORA.',
    opportunity_admin: 'Opportunities, approvals and student reach across campus.',
    org_rep: `Your organization: ${me.organization || ''}. Track submissions and how students respond.`,
  }[role];

  // ---- Pipeline tabs (previously five separate boxes) ----
  const tabs = [
    { key: 'closing', label: 'Closing this week', items: d.closingSoon, empty: 'No deadlines in the next 7 days.', date: (o) => ({ main: fmtDate(o.deadline), sub: daysLeftText(o.daysLeft) }) },
    { key: 'recent', label: 'Recently published', items: d.recent, empty: 'Nothing published yet.', date: (o) => ({ main: fmtDate((o.publishedAt || '').slice(0, 10)), sub: 'published' }) },
    { key: 'upcoming', label: 'Upcoming events', items: d.upcoming, empty: 'No upcoming events.', date: (o) => ({ main: fmtDate(o.eventDate), sub: 'event date' }) },
    { key: 'pending', label: isRep ? 'My pending submissions' : 'Awaiting approval', items: d.pending, empty: 'Nothing pending.', date: (o) => ({ main: fmtDate(o.deadline), sub: 'deadline' }) },
    { key: 'closed', label: 'Recently closed', items: d.closed, empty: 'No closed opportunities.', date: (o) => ({ main: fmtDate(o.deadline), sub: 'closed' }) },
  ];
  let activeTab = tabs.find((t) => t.items.length) ? tabs.find((t) => t.items.length).key : 'closing';

  page.innerHTML = `
    <header class="dash-hello">
      <h1>Dashboard</h1>
      <p>Welcome back, ${esc(me.user.name)}! <span class="spark" aria-hidden="true">✨</span></p>
      <p class="sub">${esc(subtitle)}</p>
    </header>

    <section class="dash-block" aria-label="At a glance">
      <div class="kpi-grid">
        ${kpis.map(([ic, tone, label, value, key, hint]) => {
          const t = tr[key];
          const trend = t && t.last30 ? `<b>↑ ${t.last30}</b> in 30 days` : esc(hint);
          return `<div class="kpi kpi--${tone}"><span class="kpi__icon" aria-hidden="true">${KPI_ICONS[ic]}</span><div><p class="kpi__label">${label}</p><p class="kpi__value">${value}</p><p class="kpi__trend" title="${esc(hint)}">${trend}</p></div>${t ? sparkline(t.series) : ''}</div>`;
        }).join('')}
      </div>
    </section>

    ${s.pending ? `
    <section class="dash-block">
      <div class="attention">
        <span class="attention__icon" aria-hidden="true">i</span>
        <div class="grow"><b>${s.pending} opportunit${s.pending > 1 ? 'ies are' : 'y is'} ${isRep ? 'waiting for an administrator to review' : 'awaiting your approval'}.</b>
          <p class="small muted">${isRep ? 'You\'ll see it go live here once approved.' : 'Approving publishes them and runs matching straight away.'}</p></div>
        <a class="btn yellow sm" href="/admin/approvals.html">${isRep ? 'View submissions' : 'Review now'} →</a>
      </div>
    </section>` : ''}

    <section class="dash-block card dash-panel">
      <header class="dash-panel__head">
        <div><h2>Opportunity pipeline</h2><p class="small muted">Track match workflow progress</p></div>
        <a class="small" href="/admin/opportunities.html">Manage all →</a>
      </header>
      <div class="tabs" role="tablist" id="pipeTabs">
        ${tabs.map((t) => `<button class="tab" role="tab" data-tab="${t.key}">${esc(t.label)}<span class="count">${t.items.length}</span></button>`).join('')}
      </div>
      <div id="pipeBody"></div>
    </section>

    <section class="dash-block dash-split">
      <div class="card dash-panel">
        <header class="dash-panel__head"><h2>Recent activity</h2><a class="small" href="/admin/activity-logs.html">Full log →</a></header>
        <ul class="activity">${d.activity.map(activityItem).join('') || '<li class="muted">No activity yet.</li>'}</ul>
      </div>
      <div class="card dash-panel">
        <header class="dash-panel__head"><h2>Quick actions</h2></header>
        <div class="quick-grid">
          ${actions.map(([ic, label, href]) => `<a class="quick" href="${href}">${icon(ic, 18)}<span>${label}</span></a>`).join('')}
        </div>
        ${!isRep ? `<div class="dash-note"><b>${s.drafts}</b> draft${s.drafts === 1 ? '' : 's'} in progress · <b>${s.organizations}</b> active organizations</div>` : ''}
      </div>
    </section>`;

  function drawTab() {
    const t = tabs.find((x) => x.key === activeTab);
    $$('#pipeTabs .tab').forEach((b) => { const on = b.dataset.tab === activeTab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('#pipeBody').innerHTML = t.items.length ? `
      <div class="table-wrap flat"><table class="table">
        <thead><tr><th>Opportunity</th><th>Status</th><th>Date</th><th>Matched</th><th>Notified</th><th></th></tr></thead>
        <tbody>${t.items.map((o) => {
          const dt = t.date(o);
          return `<tr class="clickable" data-href="/admin/matching.html?id=${encodeURIComponent(o.id)}">
            <td><div class="row" style="gap:12px">${coverHtml(o, { extraClass: 'thumb' })}<div><div class="title">${esc(o.title)}</div><div class="xs muted">${esc(o.organizer)}</div></div></div></td>
            <td>${statusPill(o.status === 'published' ? o.availability : o.status)}</td>
            <td class="small"><b class="strong">${dt.main}</b><div class="xs muted">${esc(dt.sub)}</div></td>
            <td><b class="strong">${o.stats.recommended}</b></td>
            <td>${o.stats.notified}</td>
            <td style="text-align:right"><a class="btn outline sm" href="/admin/opportunity-form.html?id=${encodeURIComponent(o.id)}">Edit</a></td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : `<p class="home-empty" style="padding:24px 4px">${esc(t.empty)}</p>`;
    $$('#pipeBody tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = tr.dataset.href; }));
  }
  $$('#pipeTabs .tab').forEach((b) => b.onclick = () => { activeTab = b.dataset.tab; drawTab(); });
  drawTab();
})();
