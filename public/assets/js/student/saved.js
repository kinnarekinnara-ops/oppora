// =============================================================
// Saved & tracking (Student Portal §8–9): bookmarks with tracking
// status, deadline countdowns, and filters by status.
// =============================================================
(async function () {
  await studentPage('saved');
  const page = $('#page');
  let items = [];
  let filter = 'all';

  async function load() {
    try { items = (await api('/api/saved')).items; draw(); }
    catch (err) { page.innerHTML = errorState(err); }
  }

  function draw() {
    const open = items.filter((o) => ['open', 'closing_soon'].includes(o.availability));
    const counts = { all: items.length, upcoming: open.length, saved: 0, planning: 0, registered: 0, completed: 0, closed: items.length - open.length };
    items.forEach((o) => { counts[o.trackingStatus]++; });
    let list = items;
    if (filter === 'upcoming') list = open;
    else if (filter === 'closed') list = items.filter((o) => !open.includes(o));
    else if (filter !== 'all') list = items.filter((o) => o.trackingStatus === filter);

    page.innerHTML = `
      <div class="page-head"><div><h1>Saved & tracking</h1><p>Keep track of what you're applying for. We'll remind you ${3} days before each deadline.</p></div>
        <a class="btn outline" href="/student/calendar.html">${icon('calendar')} Calendar view</a></div>
      <div class="tabs" role="tablist">
        ${[['all', 'All'], ['upcoming', 'Open'], ['saved', 'Saved'], ['planning', 'Planning'], ['registered', 'Registered'], ['completed', 'Completed'], ['closed', 'Closed']]
          .map(([k, l]) => `<button class="tab ${filter === k ? 'active' : ''}" data-f="${k}">${l}<span class="count">${counts[k]}</span></button>`).join('')}
      </div>
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Opportunity</th><th>Match</th><th>Deadline</th><th>Status</th><th>My progress</th><th></th></tr></thead>
        <tbody>${list.map((o) => `
          <tr>
            <td><a class="title" href="/student/opportunity.html?id=${encodeURIComponent(o.id)}">${esc(o.title)}</a><div class="xs muted">${esc(o.organizer)} · ${esc(o.categoryNames.join(', '))}</div></td>
            <td>${matchBadge(o.match, { long: false })}</td>
            <td><b class="strong small">${fmtDate(o.deadline)}</b><div class="xs" style="color:${o.daysLeft !== null && o.daysLeft >= 0 && o.daysLeft <= 3 ? '#B45309' : 'var(--muted)'};font-weight:600">${daysLeftText(o.daysLeft)}</div></td>
            <td>${statusPill(o.availability)}</td>
            <td><select class="input" style="height:36px;min-width:170px" data-track="${esc(o.id)}" aria-label="Tracking status for ${esc(o.title)}">
              ${['saved', 'planning', 'registered', 'completed'].map((s) => `<option value="${s}" ${o.trackingStatus === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></td>
            <td style="white-space:nowrap">
              ${o.registrationLink && ['open', 'closing_soon'].includes(o.availability) ? `<button class="btn yellow sm" data-reg="${esc(o.id)}">Register</button>` : ''}
              <button class="btn danger sm" data-rm="${esc(o.id)}" aria-label="Remove ${esc(o.title)}">Remove</button></td>
          </tr>`).join('')}</tbody></table></div>`
        : `<div class="card">${emptyState('🔖', filter === 'all' ? 'No saved opportunities yet' : 'Nothing here', 'Tap ♡ on any opportunity to save it and track its deadline.', '<a class="btn primary" href="/student/opportunities.html">Explore opportunities</a>')}</div>`}`;

    $$('.tab', page).forEach((t) => t.onclick = () => { filter = t.dataset.f; draw(); });
    $$('[data-track]', page).forEach((s) => s.onchange = async () => {
      await api(`/api/saved/${encodeURIComponent(s.dataset.track)}`, { method: 'PUT', body: { trackingStatus: s.value } });
      items.find((o) => o.id === s.dataset.track).trackingStatus = s.value;
      toast('Progress updated', 'success'); draw();
    });
    $$('[data-rm]', page).forEach((b) => b.onclick = async () => {
      if (!(await confirmDialog('Remove from saved?', 'You will stop receiving deadline reminders for this opportunity.', 'Remove', true))) return;
      await api(`/api/saved/${encodeURIComponent(b.dataset.rm)}`, { method: 'DELETE' });
      items = items.filter((o) => o.id !== b.dataset.rm); toast('Removed'); draw();
    });
    $$('[data-reg]', page).forEach((b) => b.onclick = async () => {
      const { url } = await api(`/api/opportunities/${encodeURIComponent(b.dataset.reg)}/click`, { method: 'POST' });
      window.open(url, '_blank', 'noopener');
    });
  }
  load();
})();
