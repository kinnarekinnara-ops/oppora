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

// OPPORA "Orbit O" mark — ring uses currentColor so it works on light and dark
const LOGO_MARK = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8.4 46.7 A 28 9 -28 0 1 52.6 18.6" fill="none" stroke="#FFB81C" stroke-width="3.6" stroke-linecap="round"/><circle cx="30" cy="34" r="16" fill="none" stroke="currentColor" stroke-width="7.4"/><circle cx="30" cy="34" r="5.8" fill="#FF5A3C"/><circle cx="51.8" cy="19" r="5.2" fill="#22B573" stroke="currentColor" stroke-width="1.6"/></svg>';

function brandHtml(href = '/') {
  return `<a class="lockup" href="${href}" aria-label="OPPORA home">${LOGO_MARK}<span><span class="word">oppor<i>a</i></span><span class="tag">opportunities find their people</span></span></a>`;
}

// Animated network background behind the portal (see main.css "Portal backgrounds")
function mountPortalBg(kind) {
  if (document.querySelector('.portal-bg')) return;
  document.documentElement.classList.add(`portal-${kind}`);
  const bg = document.createElement('div');
  bg.className = `portal-bg portal-bg--${kind}`;
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<div class="portal-bg__layer"><div class="portal-bg__img"></div><div class="portal-bg__glow"></div></div>';
  document.body.prepend(bg);
  if (kind === 'admin') {
    const net = document.createElement('canvas'); net.className = 'portal-bg__net'; bg.appendChild(net);
    if (document.documentElement.classList.contains('admin-dash')) galaxyStars(net); else lavaConstellation(net);
  }
  // Students get a gentle parallax that follows the pointer (throttled to one update per frame)
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (kind !== 'student' || reduce) return;
  const layer = bg.firstChild;
  let pending = false;
  let x = 0;
  let y = 0;
  window.addEventListener('pointermove', (e) => {
    x = (e.clientX / innerWidth - 0.5) * -24;
    y = (e.clientY / innerHeight - 0.5) * -16;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { layer.style.setProperty('--px', `${x}px`); layer.style.setProperty('--py', `${y}px`); pending = false; });
  }, { passive: true });
}

// Admin dashboard background: twinkling stars drifting slowly over the galaxy,
// a few glinting bright stars and the occasional shooting star.
function galaxyStars(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TINTS = ['255,255,255', '255,236,214', '255,205,225', '214,226,255', '255,222,170'];
  let W = 0, H = 0, stars = [], shooters = [], nextShot = 0;
  function build() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(260, (W * H) / 7000));
    stars = Array.from({ length: n }, (_, i) => ({
      x: rand(0, W), y: rand(0, H), r: Math.random() < 0.08 ? rand(1.4, 2.2) : rand(0.4, 1.3),
      c: TINTS[(Math.random() * TINTS.length) | 0], ph: rand(0, 6.28), sp: rand(0.5, 2.2),
      vx: -rand(1.5, 7), glint: i % 22 === 0,
    }));
  }
  function frame(now) {
    const dt = Math.min(64, now - (frame.last || now)) / 1000; frame.last = now;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      if (!reduce) { s.x += s.vx * dt; if (s.x < -4) { s.x = W + 4; s.y = rand(0, H); } }
      const tw = reduce ? 0.85 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 1000 * s.sp + s.ph));
      ctx.fillStyle = `rgba(${s.c},${tw})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      if (s.r > 1.3 || s.glint) { // soft halo
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
        g.addColorStop(0, `rgba(${s.c},${0.35 * tw})`); g.addColorStop(1, `rgba(${s.c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 6, 0, 6.283); ctx.fill();
      }
      if (s.glint) { // four-point glint that pulses
        const l = 7 + 9 * tw;
        ctx.strokeStyle = `rgba(${s.c},${0.75 * tw})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - l, s.y); ctx.lineTo(s.x + l, s.y); ctx.moveTo(s.x, s.y - l); ctx.lineTo(s.x, s.y + l); ctx.stroke();
      }
    }
    // shooting stars
    if (!reduce && now > nextShot) {
      nextShot = now + rand(3500, 8000);
      const sx = rand(W * 0.35, W * 1.05), sy = rand(-20, H * 0.35);
      shooters.push({ x: sx, y: sy, vx: -rand(650, 950), vy: rand(220, 360), life: 0, max: rand(0.7, 1.1) });
    }
    shooters = shooters.filter((m) => {
      m.life += dt; if (m.life > m.max) return false;
      m.x += m.vx * dt; m.y += m.vy * dt;
      const fade = Math.sin(Math.PI * (m.life / m.max));
      const tx = m.x - m.vx * 0.16, ty = m.y - m.vy * 0.16;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,240,220,${0.95 * fade})`); g.addColorStop(0.3, `rgba(255,170,190,${0.45 * fade})`); g.addColorStop(1, 'rgba(255,150,180,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = `rgba(255,250,240,${fade})`; ctx.beginPath(); ctx.arc(m.x, m.y, 1.6, 0, 6.283); ctx.fill();
      return true;
    });
    if (!reduce) frame.raf = requestAnimationFrame(frame);
  }
  build();
  nextShot = performance.now() + 1200;
  frame.raf = requestAnimationFrame(frame);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) requestAnimationFrame(frame); }, 200); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame.raf);
    if (!document.hidden && !reduce) { frame.last = performance.now(); frame.raf = requestAnimationFrame(frame); }
  });
}

// Admin background: lava-crystal stars joined by thin lines, with soft light
// pulses travelling between them. Pauses when the tab is hidden.
function lavaConstellation(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // Pre-rendered glow sprite: white-hot core → amber → lava red → clear
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sg = sprite.getContext('2d');
  const g = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.1, 'rgba(255,236,170,1)'); g.addColorStop(0.22, 'rgba(255,170,60,.95)');
  g.addColorStop(0.42, 'rgba(255,104,36,.45)'); g.addColorStop(0.7, 'rgba(255,80,40,.12)'); g.addColorStop(1, 'rgba(255,80,40,0)');
  sg.fillStyle = g; sg.fillRect(0, 0, 64, 64);
  let W = 0, H = 0, pts = [], edges = [], pulses = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(64, Math.max(26, (W * H) / 26000)));
    pts = [];
    // keep the page heading and the account menu clear of glowing points
    const busy = (x, y) => (W < 860 && y < 230) || (y < 140 && x < Math.min(920, W * 0.62)) || (y < 100 && x > W - 460);
    for (let guard = 0; pts.length < n && guard < n * 20; guard++) {
      // denser towards the top-right, like the sample
      const top = Math.random() < 0.6;
      const x = top ? rand(W * 0.3, W) : rand(0, W), y = top ? H * 0.55 * Math.pow(Math.random(), 0.8) : rand(0, H);
      if (busy(x, y)) continue;
      pts.push({ x, y,
        r: rand(2.2, 4.4), ph: rand(0, 6.28), sp: rand(0.6, 1.4), flare: 0, crystal: Math.random() < 0.3 });
    }
    edges = []; const seen = new Set();
    pts.forEach((a, i) => {
      pts.map((b, j) => [j, Math.hypot(a.x - b.x, a.y - b.y)]).sort((p, q) => p[1] - q[1]).slice(1, 4)
        .forEach(([j, d]) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (d < 300 && !seen.has(k)) { seen.add(k); edges.push([i, j, d]); } });
    });
    pulses = [];
  }
  function spawn() {
    if (!edges.length) return;
    const e = edges[(Math.random() * edges.length) | 0];
    const fwd = Math.random() < 0.5;
    pulses.push({ a: fwd ? e[0] : e[1], b: fwd ? e[1] : e[0], t: 0, dur: 900 + e[2] * 6 });
  }
  function star(p, s, alpha) {
    const size = p.r * 12 * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    if (p.crystal) { // little four-point crystal glint
      ctx.strokeStyle = `rgba(255,236,200,${0.8 * alpha})`; ctx.lineWidth = 1;
      const l = p.r * 4.5 * s;
      ctx.beginPath(); ctx.moveTo(p.x - l, p.y); ctx.lineTo(p.x + l, p.y); ctx.moveTo(p.x, p.y - l); ctx.lineTo(p.x, p.y + l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  let last = performance.now(), nextSpawn = 0, raf = 0;
  function frame(now) {
    const dt = Math.min(64, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    edges.forEach(([i, j]) => {
      const a = pts[i], b = pts[j];
      ctx.strokeStyle = 'rgba(255,238,220,.38)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    // light travelling between points
    if (!reduce && now > nextSpawn && pulses.length < 9) { spawn(); nextSpawn = now + rand(250, 700); }
    pulses = pulses.filter((p) => {
      p.t += dt / p.dur;
      const a = pts[p.a], b = pts[p.b];
      if (p.t >= 1) { b.flare = 1; return false; }
      const e = p.t < 0.5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      const tx = a.x + (b.x - a.x) * Math.max(0, e - 0.18), ty = a.y + (b.y - a.y) * Math.max(0, e - 0.18);
      const lg = ctx.createLinearGradient(tx, ty, x, y);
      lg.addColorStop(0, 'rgba(255,214,150,0)'); lg.addColorStop(1, 'rgba(255,226,170,.95)');
      ctx.strokeStyle = lg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.drawImage(sprite, x - 14, y - 14, 28, 28); ctx.globalAlpha = 1;
      return true;
    });
    pts.forEach((p) => {
      const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(now / 1000 * p.sp + p.ph);
      star(p, 1 + p.flare * 0.9, Math.min(1, tw + p.flare * 0.4));
      p.flare = Math.max(0, p.flare - dt / 600);
    });
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  build();
  raf = requestAnimationFrame(frame);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) requestAnimationFrame(frame); }, 200); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
}

function revealPage() {
  if (window.OpporaTransition) OpporaTransition.reveal();
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
  mountPortalBg('student');
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
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 4), { passive: true });
  revealPage();
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
  mountPortalBg('admin');
  const shell = document.createElement('div');
  shell.className = 'admin-shell';
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Admin navigation">
      <canvas class="side-sky" aria-hidden="true"></canvas>
      ${brandHtml('/admin/dashboard.html')}
      <nav class="side-nav">
      ${groups.map(([g, items]) => {
        const visible = items.filter((i) => i[4]);
        if (!visible.length) return '';
        // Parent label = section heading; children = secondary links underneath
        return `<section class="side-section"><h2 class="side-heading">${g}</h2><ul class="side-sub">${visible.map(([k, href, ic, label, , count]) =>
          `<li><a class="side-link ${k === active ? 'active' : ''}" href="${href}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic, 17)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a></li>`).join('')}</ul></section>`;
      }).join('')}
      </nav>
      <svg class="side-art" viewBox="0 0 280 220" aria-hidden="true" preserveAspectRatio="xMinYMax slice">
        <defs><radialGradient id="sideStar"><stop offset="0" stop-color="#FFF4D6"/><stop offset=".45" stop-color="#FFC94D"/><stop offset="1" stop-color="#FFB81C" stop-opacity="0"/></radialGradient></defs>
        <circle class="side-art__arc" cx="-36" cy="318" r="196" fill="none"/>
        <g class="side-art__lines" fill="none"><path d="M112 64 L150 50 L188 70 L224 34 M150 50 L160 98 L210 112 L238 84 L224 34 M160 98 L132 132 L176 160 L210 112 M132 132 L100 116 L112 64 M176 160 L196 196"/></g>
        <g class="side-art__stars">${[[112, 64], [150, 50], [188, 70], [224, 34], [160, 98], [210, 112], [238, 84], [132, 132], [176, 160], [100, 116], [196, 196]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2.4 : 3.4}" style="--d:${(i * 0.37).toFixed(2)}s"/>`).join('')}</g>
      </svg>
    </aside>
    <div class="admin-main">
      <div class="admin-top">
        <button class="icon-btn admin-burger" id="burger" aria-label="Open navigation">${icon('menu', 20)}</button>
        <span class="crumb">${esc(title)}</span>
        <div class="admin-top__actions">
          <a class="icon-btn admin-bell" href="/admin/approvals.html" aria-label="${pending ? `${pending} awaiting approval` : 'Approvals'}">${icon('bell', 20)}${pending ? '<span class="dot"></span>' : ''}</a>
          <div class="menu admin-user" id="userMenu">
            <button aria-haspopup="true" aria-expanded="false" aria-label="Account menu">
              <span class="avatar">${esc(initials(me.user.name))}</span>
              <span class="who"><b>${esc(me.user.name)}</b><span>${esc(ROLE_LABELS[role])}</span></span>
              <svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="menu-list" role="menu">
              <div class="head"><b class="strong">${esc(me.user.name)}</b><div class="xs muted">${esc(me.organization || ROLE_LABELS[role])}</div></div>
              <a href="/admin/dashboard.html" role="menuitem">Dashboard</a>
              <a href="/admin/approvals.html" role="menuitem">${role === 'org_rep' ? 'My submissions' : 'Approvals'}</a>
              <button id="logoutBtn" role="menuitem">Log out</button>
            </div>
          </div>
        </div>
      </div>
      <main class="admin-content" id="content"></main>
    </div>`;
  const existing = $('#page');
  document.body.prepend(shell);
  if (existing) $('#content').appendChild(existing);
  wireMenu(shell);
  $('#burger').onclick = () => $('#sidebar').classList.toggle('open');
  // A quiet starfield behind the sidebar (stars only, no drones)
  if (window.OpporaSky) OpporaSky.mount($('.side-sky'), { stars: 70, drones: 0, shapes: [], parallax: false, speed: 0.01 });
  me.staff = staff;
  revealPage();
  return me;
}
