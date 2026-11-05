// =============================================================
// Notifications centre (Student Portal §10).
// =============================================================
(async function () {
  await studentPage('');
  const page = $('#page');
  let filter = '';
  const ICONS = { new_match: ['🎯', 'var(--tint-green)', 'New match'], general: ['📢', 'var(--tint-blue)', 'Open to all'], deadline: ['⏳', 'var(--tint-yellow)', 'Deadline'], update: ['📝', 'var(--tint-blue)', 'Update'] };

  async function load() {
    let d;
    try { d = await api(`/api/notifications${filter ? `?filter=${filter}` : ''}`); }
    catch (err) { page.innerHTML = errorState(err); return; }
    page.innerHTML = `
      <div class="page-head">
        <div><h1>Notifications</h1><p>${d.unread ? `You have ${d.unread} unread notification${d.unread > 1 ? 's' : ''}.` : 'You\'re all caught up.'}</p></div>
        <div class="row"><a class="btn outline sm" href="/student/settings.html">${icon('settings', 16)} Preferences</a>${d.unread ? '<button class="btn primary sm" id="readAll">Mark all as read</button>' : ''}</div>
      </div>
      <div class="tabs">${[['', 'All'], ['unread', 'Unread'], ['new_match', 'Matches'], ['deadline', 'Deadlines'], ['update', 'Updates'], ['general', 'Open to all']]
        .map(([k, l]) => `<button class="tab ${filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div class="card" style="padding:6px 20px">
        ${d.items.length ? d.items.map((n) => {
          const [ic, bg, label] = ICONS[n.type] || ['🔔', 'var(--bg)', 'Notice'];
          return `<div class="notif-item ${n.read ? '' : 'unread'}" data-id="${esc(n.id)}" data-opp="${esc(n.opportunityId || '')}" style="cursor:pointer">
            <span class="ic" style="background:${bg}">${ic}</span>
            <span class="grow"><span class="t">${esc(n.title)}</span><span class="m" style="display:block">${esc(n.message)}</span>
              <span class="xs muted">${label} · ${timeAgo(n.createdAt)}</span></span>
            <button class="btn ghost sm" data-del="${esc(n.id)}" aria-label="Delete notification">✕</button></div>`;
        }).join('') : emptyState('🔔', 'No notifications', 'When a new opportunity matches your profile, you\'ll see it here.')}
      </div>`;

    $$('.tab', page).forEach((t) => t.onclick = () => { filter = t.dataset.f; load(); });
    if ($('#readAll')) $('#readAll').onclick = async () => { await api('/api/notifications/read-all', { method: 'POST' }); location.reload(); };
    $$('.notif-item', page).forEach((el) => el.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); await api(`/api/notifications/${del.dataset.del}`, { method: 'DELETE' }); load(); return; }
      await api(`/api/notifications/${el.dataset.id}/read`, { method: 'POST' });
      if (el.dataset.opp) location.href = `/student/opportunity.html?id=${encodeURIComponent(el.dataset.opp)}`;
      else load();
    }));
  }
  load();
})();
