// =============================================================
// navbar.js — session check + page chrome.
//   const me = await studentPage('dashboard');   // student pages
//   const me = await adminPage('opportunities'); // admin pages
// Each call checks the login, redirects if the role is wrong, and
// draws the navbar (students) or sidebar (admins).
// =============================================================

async function loadMe() {
  return api('/api/auth/me');
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', redirectOn401: false }).catch(() => {});
  location.href = '/login.html';
}

function brandHtml(href = '/') {
  return `<a class="brand" href="${href}"><img src="/assets/images/logo.svg" alt=""><span><span class="name">OPPOR<span>A</span></span><span class="tag">Opportunities find their people</span></span></a>`;
}

// ---------------- Student navbar ----------------
async function studentPage(active) {
  const me = await loadMe();
  if (me.user.role !== 'student') { location.href = '/admin/dashboard.html'; return new Promise(() => {}); }
  const links = [
    ['dashboard', '/student/dashboard.html', 'home', 'Home'],
    ['opportunities', '/student/opportunities.html', 'compass', 'Explore'],
    ['saved', '/student/saved.html', 'bookmark', 'Saved'],
    ['calendar', '/student/calendar.html', 'calendar', 'Calendar'],
    ['profile', '/student/profile.html', 'user', 'My Profile'],
  ];
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="inner">
      ${brandHtml('/student/dashboard.html')}
      <nav class="nav" id="mainNav" aria-label="Main">
        ${links.map(([k, href, ic, label]) => `<a class="nav-link ${k === active ? 'active' : ''}" href="${href}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}
      </nav>
      <div class="header-actions">
        <a class="icon-btn" href="/student/notifications.html" aria-label="Notifications${me.unread ? `, ${me.unread} unread` : ''}">${icon('bell', 20)}${me.unread ? `<span class="dot">${me.unread > 9 ? '9+' : me.unread}</span>` : ''}</a>
        <div class="menu" id="userMenu">
          <button aria-haspopup="true" aria-expanded="false" aria-label="Account menu"><span class="avatar">${esc(initials(me.user.name))}</span></button>
          <div class="menu-list" role="menu">
            <div class="head"><b class="strong">${esc(me.user.name)}</b><div class="xs muted">${esc(me.programme || 'Student')}</div></div>
            <a href="/student/profile.html" role="menuitem">My Profile</a>
            <a href="/student/saved.html" role="menuitem">My Saved & Tracking</a>
            <a href="/student/calendar.html" role="menuitem">My Calendar</a>
            <a href="/student/settings.html" role="menuitem">Settings</a>
            <button id="logoutBtn" role="menuitem">Log out</button>
          </div>
        </div>
        <button class="icon-btn mobile-toggle" id="navToggle" aria-label="Open menu" aria-controls="mainNav">${icon('menu', 20)}</button>
      </div>
    </div>`;
  document.body.prepend(header);
  wireMenu(header);
  $('#navToggle', header).onclick = () => $('#mainNav', header).classList.toggle('open');
  window.addEventListener('scroll', () => header.style.boxShadow = scrollY > 4 ? 'var(--shadow-sm)' : 'none');
  return me;
}

function wireMenu(root) {
  const menu = $('#userMenu', root);
  const btn = menu.querySelector('button');
  btn.onclick = (e) => { e.stopPropagation(); const open = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', open); };
  document.addEventListener('click', () => { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
  $('#logoutBtn', root).onclick = logout;
}

// ---------------- Admin sidebar ----------------
const ROLE_LABELS = { super_admin: 'Super Administrator', opportunity_admin: 'Opportunity Administrator', org_rep: 'Organization Representative' };

async function adminPage(active, { title = '', allow } = {}) {
  const me = await loadMe();
  const role = me.user.role;
  if (role === 'student') { location.href = '/student/dashboard.html'; return new Promise(() => {}); }
  const staff = role === 'super_admin' || role === 'opportunity_admin';
  if (allow && !allow.includes(role)) { location.href = '/admin/dashboard.html'; return new Promise(() => {}); }

  let pending = 0;
  try { const d = await api('/api/admin/opportunities?status=pending_approval'); pending = d.items.length; } catch (_) {}

  const groups = [
    ['Overview', [['dashboard', '/admin/dashboard.html', 'home', 'Dashboard', true]]],
    ['Opportunities', [
      ['create', '/admin/opportunity-form.html', 'plus', role === 'org_rep' ? 'Submit Opportunity' : 'Create Opportunity', true],
      ['opportunities', '/admin/opportunities.html', 'list', 'Manage Opportunities', true],
      ['approvals', '/admin/approvals.html', 'check', role === 'org_rep' ? 'My Submissions' : 'Approvals', true, pending],
      ['matching', '/admin/matching.html', 'target', 'Matching Review', true],
    ]],
    ['People', [
      ['students', '/admin/students.html', 'users', 'Students', staff],
      ['organizations', '/admin/organizations.html', 'building', 'Organizations', true],
      ['users', '/admin/admin-users.html', 'shield', 'Admin Users', role === 'super_admin'],
    ]],
    ['Insights', [
      ['analytics', '/admin/analytics.html', 'chart', 'Analytics', true],
      ['logs', '/admin/activity-logs.html', 'history', 'Activity Logs', true],
    ]],
  ];

  document.body.classList.add('admin');
  const shell = document.createElement('div');
  shell.className = 'admin-shell';
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Admin navigation">
      ${brandHtml('/admin/dashboard.html')}
      ${groups.map(([g, items]) => {
        const visible = items.filter((i) => i[4]);
        if (!visible.length) return '';
        return `<div class="side-group">${g}</div>${visible.map(([k, href, ic, label, , count]) =>
          `<a class="side-link ${k === active ? 'active' : ''}" href="${href}">${icon(ic)}${label}${count ? `<span class="count">${count}</span>` : ''}</a>`).join('')}`;
      }).join('')}
      <div class="side-user">
        <span class="avatar">${esc(initials(me.user.name))}</span>
        <div class="who"><b>${esc(me.user.name)}</b><span>${esc(me.organization || ROLE_LABELS[role])}</span></div>
        <button id="logoutBtn">Log out</button>
      </div>
    </aside>
    <div class="admin-main">
      <div class="admin-top">
        <button class="icon-btn admin-burger" id="burger" aria-label="Open navigation">${icon('menu', 20)}</button>
        <span class="crumb">${esc(title)}</span>
        <span class="role badge navy">${esc(ROLE_LABELS[role])}</span>
      </div>
      <main class="admin-content" id="content"></main>
    </div>`;
  const existing = $('#page');
  document.body.prepend(shell);
  if (existing) $('#content').appendChild(existing);
  $('#logoutBtn').onclick = logout;
  $('#burger').onclick = () => $('#sidebar').classList.toggle('open');
  me.staff = staff;
  return me;
}
