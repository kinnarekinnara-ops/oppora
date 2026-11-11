// =============================================================
// components.js — small reusable UI pieces used across pages:
// escaping, dates, icons, match badges, opportunity cards, toasts,
// modals, skeletons, tag inputs.
// =============================================================

// ---------- Safety: always escape user-provided text ----------
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Dates ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseDay(s) { return s ? new Date(`${s}T00:00:00`) : null; }
function fmtDate(s, withDay = false) {
  const d = parseDay(s);
  if (!d || isNaN(d)) return 'TBA';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${d.toLocaleDateString('en-GB', { weekday: 'short' })}, ${base}` : base;
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function daysLeftText(n) {
  if (n === null || n === undefined) return 'No deadline';
  if (n < 0) return 'Closed';
  if (n === 0) return 'Closes today';
  if (n === 1) return '1 day left';
  return `${n} days left`;
}

// ---------- Icons (inline SVG, stroke style) ----------
const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.8-6 7-6s6 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c-.6-2.6-2-4.4-4-5.3"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v-4M12 15V7M17 15v-7"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
function icon(name, size = 19) {
  return `<svg class="nav-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

// ---------- Categories ----------
// Bold flat colours + halftone dots (no gradients). `dark` = use light text on top.
const HALFTONE = 'radial-gradient(rgba(255,255,255,.24) 1.3px, transparent 1.6px) 0 0/11px 11px';
const CATEGORY_STYLE = {
  academic: { color: '#2D5BE3', bg: `${HALFTONE}, #2D5BE3`, emoji: '🎓', dark: true },
  technical: { color: '#0E1A3A', bg: `${HALFTONE}, #0E1A3A`, emoji: '💻', dark: true },
  professional: { color: '#22B573', bg: `${HALFTONE}, #22B573`, emoji: '💼', dark: false },
  activities: { color: '#FFB81C', bg: `${HALFTONE}, #FFB81C`, emoji: '🎉', dark: false },
  volunteering: { color: '#12B5CB', bg: `${HALFTONE}, #12B5CB`, emoji: '🤝', dark: false },
  general: { color: '#FF5A3C', bg: `${HALFTONE}, #FF5A3C`, emoji: '📢', dark: false },
};
function catStyle(id) { return CATEGORY_STYLE[id] || CATEGORY_STYLE.general; }
function categoryBadges(opp) {
  return (opp.categories || []).map((c, i) => `<span class="badge cat" style="background:${catStyle(c).color};color:${catStyle(c).dark ? '#fff' : '#161A2E'}">${catStyle(c).emoji} ${esc((opp.categoryNames || [])[i] || c)}</span>`).join(' ');
}

// ---------- Match + status badges ----------
function matchBadge(m, { long = true } = {}) {
  if (!m) return '';
  if (m.eligibility === 'not_eligible') return '<span class="badge red">Not eligible</span>';
  if (m.score === null || m.score === undefined) return '<span class="badge gray">Complete profile to see match</span>';
  return `<span class="match ${m.tone}" title="${esc(m.label)}${m.provisional ? ' (provisional)' : ''}"><span class="pct">${m.score}%</span>${long ? esc(m.label) : ''}${m.provisional ? '*' : ''}</span>`;
}
const STATUS_LABEL = {
  draft: 'Draft', pending_approval: 'Pending approval', published: 'Published', paused: 'Paused', closed: 'Closed', archived: 'Archived',
  open: 'Open', closing_soon: 'Closing soon', expired: 'Expired', eligible: 'Eligible', not_eligible: 'Not eligible', unconfirmed: 'Eligibility unconfirmed',
  saved: 'Saved', planning: 'Planning to apply', registered: 'Registered', completed: 'Completed', active: 'Active', suspended: 'Suspended',
};
function statusPill(s) { return `<span class="status ${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`; }

// ---------- Cover image: the uploaded photo, or a designed placeholder ----------
// extraClass: 'thumb' for small table thumbnails. `inner` = extra markup layered on top.
function coverHtml(o, { extraClass = '', inner = '' } = {}) {
  const cat = (o.categories || [])[0];
  const st = catStyle(cat);
  const label = (o.categoryNames || [])[0] || 'Opportunity';
  const media = o.imageUrl
    ? `<img src="${esc(o.imageUrl)}" alt="" loading="lazy" decoding="async">`
    : `<div class="cover-ph ${st.dark ? '' : 'light'}" style="--c:${st.color}"><span class="ph-icon" aria-hidden="true">${st.emoji}</span><span class="ph-label">${esc(label)}</span></div>`;
  return `<div class="cover ${extraClass}">${media}${inner}</div>`;
}

// ---------- Opportunity card ----------
function oppCard(o, { showReason = true } = {}) {
  const urgent = o.daysLeft !== null && o.daysLeft >= 0 && o.daysLeft <= 3;
  const badges = categoryBadges(o).replace(/class="badge cat" style="[^"]+"/g, 'class="badge"');
  const heart = o.saved !== undefined
    ? `<button class="heart ${o.saved ? 'on' : ''}" data-save="${esc(o.id)}" aria-label="${o.saved ? 'Remove from saved' : 'Save opportunity'}" aria-pressed="${!!o.saved}">${o.saved ? '♥' : '♡'}</button>`
    : '';
  return `
  <article class="opp-card" data-id="${esc(o.id)}" tabindex="0" role="link" aria-label="${esc(o.title)}">
    ${coverHtml(o, { inner: `<div class="cover-top"><div class="row wrap" style="gap:6px">${badges}</div>${heart}</div>` })}
    <div class="body">
      <div class="row wrap" style="gap:6px">${matchBadge(o.match)}${o.match && o.match.crossDisciplinary ? '<span class="badge yellow">✦ Beyond your programme</span>' : ''}</div>
      <h3>${esc(o.title)}</h3>
      <div class="meta">
        <span>🏛 ${esc(o.organizer)}</span>
        <span>📅 ${fmtDate(o.eventDate, true)}</span>
        <span style="${urgent ? 'color:#B45309;font-weight:700' : ''}">⏳ Deadline ${fmtDate(o.deadline)} · ${daysLeftText(o.daysLeft)}</span>
      </div>
      ${showReason && o.match && o.match.reason && o.match.eligibility !== 'not_eligible' ? `<p class="reason">💡 ${esc(o.match.reason)}</p>` : ''}
      <div class="foot">
        <span class="small muted">${esc(o.experienceLevel || 'Any')} level</span>
        <a class="btn yellow sm" href="/student/opportunity.html?id=${encodeURIComponent(o.id)}">View details →</a>
      </div>
    </div>
  </article>`;
}

/** Wire up click-to-open + heart toggles inside a container of opp cards. */
function bindOppCards(container, { onSaveChange } = {}) {
  container.addEventListener('click', async (e) => {
    const heart = e.target.closest('[data-save]');
    if (heart) {
      e.preventDefault(); e.stopPropagation();
      const id = heart.dataset.save;
      const on = heart.classList.contains('on');
      try {
        await api(`/api/saved/${encodeURIComponent(id)}`, { method: on ? 'DELETE' : 'POST' });
        heart.classList.toggle('on', !on);
        heart.textContent = on ? '♡' : '♥';
        heart.setAttribute('aria-pressed', String(!on));
        toast(on ? 'Removed from saved' : 'Saved — find it under Saved', on ? '' : 'success');
        if (onSaveChange) onSaveChange(id, !on);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (e.target.closest('a')) return;
    const card = e.target.closest('.opp-card');
    if (card) location.href = `/student/opportunity.html?id=${encodeURIComponent(card.dataset.id)}`;
  });
  container.addEventListener('keydown', (e) => {
    const card = e.target.closest('.opp-card');
    if (card && e.key === 'Enter' && e.target === card) location.href = `/student/opportunity.html?id=${encodeURIComponent(card.dataset.id)}`;
  });
}

// ---------- Feedback: toast, skeleton, empty ----------
function toast(msg, type = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}
function skeletons(n = 3, h = 300) {
  return Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}px"></div>`).join('');
}
function emptyState(emoji, title, text, actionHtml = '') {
  return `<div class="empty"><div class="big">${emoji}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;
}
function errorState(err) {
  return `<div class="alert error">⚠️ ${esc(err.message || err)}</div>`;
}

// ---------- Modal ----------
function openModal(html, { wide = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  const first = back.querySelector('input, select, textarea, button:not([data-close])');
  if (first) first.focus();
  return { el: back.querySelector('.modal'), close };
}
function confirmDialog(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    const m = openModal(`
      <div class="modal-head"><h2>${esc(title)}</h2></div>
      <p>${esc(text)}</p>
      <div class="modal-foot"><button class="btn outline" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="okBtn">${esc(okLabel)}</button></div>`);
    m.el.querySelector('#okBtn').onclick = () => { m.close(); resolve(true); };
    m.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}

// ---------- Form error helper ----------
function showFieldErrors(form, fields) {
  $$('.error', form).forEach((e) => e.remove());
  $$('.invalid', form).forEach((e) => e.classList.remove('invalid'));
  if (!fields) return;
  let first = null;
  for (const [name, msg] of Object.entries(fields)) {
    const input = form.querySelector(`[name="${name}"]`) || form.querySelector(`[data-field="${name}"]`);
    const wrap = input ? input.closest('.field') : null;
    if (input && input.classList) input.classList.add('invalid');
    if (wrap) { wrap.insertAdjacentHTML('beforeend', `<span class="error">${esc(msg)}</span>`); first = first || input; }
  }
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Tag input with autocomplete (skills, programmes...) ----------
// createTagInput(el, { options: [...strings], values: [...], placeholder, allowCustom, onChange })
function createTagInput(el, { options = [], values = [], placeholder = 'Type and press Enter', allowCustom = true, onChange, renderTag, mapNew } = {}) {
  let tags = [...values];
  el.classList.add('tag-input');
  el.innerHTML = '<div class="chips"></div><input type="text" autocomplete="off"><div class="suggest-list hidden" role="listbox"></div>';
  const chipsEl = el.querySelector('.chips');
  const input = el.querySelector('input');
  const list = el.querySelector('.suggest-list');
  input.placeholder = placeholder;
  let active = -1;

  const draw = () => {
    chipsEl.innerHTML = tags.map((t, i) => renderTag ? renderTag(t, i) : `<span class="chip blue">${esc(t)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(t)}">×</button></span>`).join('');
    if (onChange) onChange(tags);
  };
  const add = (val) => {
    const v = String(val).trim();
    if (!v) return;
    const match = options.find((o) => o.toLowerCase() === v.toLowerCase());
    const final = match || (allowCustom ? v : null);
    if (final && !tags.some((t) => (typeof t === 'string' ? t : t.name).toLowerCase() === final.toLowerCase())) { tags.push(mapNew ? mapNew(final) : final); draw(); }
    input.value = ''; list.classList.add('hidden');
  };
  const suggest = () => {
    const q = input.value.trim().toLowerCase();
    const taken = new Set(tags.map((t) => (typeof t === 'string' ? t : t.name).toLowerCase()));
    const hits = options.filter((o) => !taken.has(o.toLowerCase()) && (!q || o.toLowerCase().includes(q))).slice(0, 8);
    active = -1;
    if (!hits.length || document.activeElement !== input) { list.classList.add('hidden'); return; }
    list.innerHTML = hits.map((h) => `<button type="button" data-add="${esc(h)}">${esc(h)}</button>`).join('');
    list.classList.remove('hidden');
  };
  input.addEventListener('input', suggest);
  input.addEventListener('focus', suggest);
  input.addEventListener('blur', () => setTimeout(() => list.classList.add('hidden'), 150));
  input.addEventListener('keydown', (e) => {
    const btns = $$('button', list);
    if (e.key === 'ArrowDown' && btns.length) { e.preventDefault(); active = (active + 1) % btns.length; btns.forEach((b, i) => b.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp' && btns.length) { e.preventDefault(); active = (active - 1 + btns.length) % btns.length; btns.forEach((b, i) => b.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(active >= 0 && btns[active] ? btns[active].dataset.add : input.value); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
  });
  list.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-add]'); if (b) { e.preventDefault(); add(b.dataset.add); } });
  el.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { tags.splice(Number(rm.dataset.rm), 1); draw(); return; }
    if (e.target === el || e.target === chipsEl) input.focus();
  });
  draw();
  return {
    get: () => [...tags],
    set: (v) => { tags = [...v]; draw(); },
    add,
    update: (i, val) => { tags[i] = val; draw(); },
    remove: (i) => { tags.splice(i, 1); draw(); },
  };
}

// ---------- Skills widget: tags with a proficiency level ----------
// Click the level on a chip to cycle Beginner → Intermediate → Advanced.
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
function createSkillInput(el, skillNames, values = []) {
  const widget = createTagInput(el, {
    options: skillNames,
    values: values.map((s) => ({ name: s.name, level: s.level || 'Beginner' })),
    placeholder: 'Add a skill…',
    mapNew: (name) => ({ name, level: 'Beginner' }),
    renderTag: (t, i) => `<span class="chip ${t.level === 'Advanced' ? '' : t.level === 'Intermediate' ? 'blue' : 'gray'}">
      ${esc(t.name)} · <button type="button" data-lvl="${i}" title="Change level" style="font-size:12px;font-weight:700;text-decoration:underline dotted">${t.level}</button>
      <button type="button" data-rm="${i}" aria-label="Remove ${esc(t.name)}">×</button></span>`,
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lvl]');
    if (!b) return;
    const i = Number(b.dataset.lvl);
    const t = widget.get()[i];
    widget.update(i, { ...t, level: LEVELS[(LEVELS.indexOf(t.level) + 1) % LEVELS.length] });
  });
  return widget;
}

// ---------- Experience list editor ----------
const EXP_LABELS = { hackathon: 'Hackathon', competition: 'Competition', project: 'Project', research: 'Research', internship: 'Internship', club: 'Club activity', leadership: 'Leadership role', volunteering: 'Volunteering', certification: 'Certification', mentorship: 'Mentorship' };
function createExperienceEditor(listEl, addBtn, values = []) {
  const addRow = (e = { type: 'project', title: '', year: '' }) => {
    const row = document.createElement('div');
    row.className = 'row exp-row';
    row.innerHTML = `
      <select class="input" style="width:170px" aria-label="Type">${Object.entries(EXP_LABELS).map(([k, v]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input class="input grow" placeholder="e.g. Inter-varsity CTF 2025" value="${esc(e.title)}" aria-label="Title">
      <input class="input" style="width:90px" placeholder="Year" value="${esc(e.year || '')}" aria-label="Year">
      <button type="button" class="btn danger sm" aria-label="Remove">×</button>`;
    row.querySelector('button').onclick = () => row.remove();
    listEl.appendChild(row);
  };
  values.forEach(addRow);
  addBtn.onclick = () => addRow();
  return {
    get: () => $$('.exp-row', listEl).map((r) => {
      const [type, title, year] = [r.querySelector('select').value, ...$$('input', r).map((i) => i.value.trim())];
      return { type, title, year };
    }).filter((e) => e.title),
  };
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--blue-bright)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--tone-low)';
}
