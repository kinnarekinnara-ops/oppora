// =============================================================
// Manage opportunities (Admin Portal §4.5): tabs per status,
// search, and status actions (pause / close / archive / publish).
// =============================================================
(async function () {
  const me = await adminPage('opportunities', { title: 'Manage opportunities' });
  const page = $('#page');
  const params = new URLSearchParams(location.search);
  let status = params.get('status') || 'all';
  let q = '';

  const ACTIONS = {
    draft: [['edit', 'Edit'], ['delete', 'Delete']],
    pending_approval: [['edit', 'Edit']],
    published: [['matches', 'Matches'], ['edit', 'Edit'], ['paused', 'Pause'], ['closed', 'Close']],
    paused: [['published', 'Resume'], ['edit', 'Edit'], ['closed', 'Close']],
    closed: [['matches', 'Results'], ['published', 'Re-open'], ['archived', 'Archive']],
    archived: [['draft', 'Restore as draft']],
  };

  async function load() {
    let d;
    try { d = await api(`/api/admin/opportunities?status=${status}&q=${encodeURIComponent(q)}`); }
    catch (err) { page.innerHTML = errorState(err); return; }
    const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
    page.innerHTML = `
      <div class="page-head">
        <div><h1>Opportunities</h1><p>${me.staff ? 'All opportunities across campus.' : `Opportunities from ${esc(me.organization)}.`}</p></div>
        <a class="btn green" href="/admin/opportunity-form.html">${icon('plus')} New opportunity</a>
      </div>
      <div class="tabs">${[['all', 'All', total], ...['published', 'pending_approval', 'draft', 'paused', 'closed', 'archived'].map((s) => [s, STATUS_LABEL[s], d.counts[s]])]
        .map(([k, l, c]) => `<button class="tab ${status === k ? 'active' : ''}" data-s="${k}">${l}<span class="count">${c}</span></button>`).join('')}</div>
      <div class="search-box" style="max-width:420px;margin-bottom:16px">${icon('search', 18)}<input class="input" id="q" placeholder="Search title or organizer…" value="${esc(q)}"></div>
      ${d.items.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Opportunity</th><th>Status</th><th>Deadline</th><th>Matched</th><th>Notified</th><th>Saved</th><th>Actions</th></tr></thead>
        <tbody>${d.items.map((o) => `
          <tr>
            <td><div class="row" style="gap:12px;align-items:flex-start">${coverHtml(o, { extraClass: 'thumb' })}<div><div class="title">${esc(o.title)}</div><div class="xs muted">${esc(o.organizer)} · ${esc(o.categoryNames.join(', ') || 'No category')}${o.aiAssisted ? ' · ✨ AI-assisted' : ''}${o.imageUrl ? '' : ' · <span title="No cover image uploaded">no image</span>'}</div>
              ${o.rejectionReason && o.status === 'draft' ? `<div class="xs" style="color:var(--red)">Returned: ${esc(o.rejectionReason)}</div>` : ''}</div></div></td>
            <td>${statusPill(o.status)}</td>
            <td class="small">${o.deadline ? `${fmtDate(o.deadline)}<div class="xs muted">${daysLeftText(o.daysLeft)}</div>` : '—'}</td>
            <td><b class="strong">${o.stats.recommended}</b>${o.stats.crossDisciplinary ? `<div class="xs muted">${o.stats.crossDisciplinary} cross-discipline</div>` : ''}</td>
            <td>${o.stats.notified}</td>
            <td>${o.stats.saved}</td>
            <td><div class="row wrap" style="gap:6px">${(ACTIONS[o.status] || []).map(([a, l]) => `<button class="btn ${a === 'delete' ? 'danger' : 'outline'} sm" data-a="${a}" data-id="${esc(o.id)}" data-t="${esc(o.title)}">${l}</button>`).join('')}</div></td>
          </tr>`).join('')}</tbody></table></div>`
        : `<div class="card">${emptyState('📭', 'No opportunities here', 'Create one to start matching students.', '<a class="btn primary" href="/admin/opportunity-form.html">Create opportunity</a>')}</div>`}`;

    $$('.tab', page).forEach((t) => t.onclick = () => { status = t.dataset.s; load(); });
    let timer;
    $('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; load().then(() => { const i = $('#q'); i.focus(); i.setSelectionRange(q.length, q.length); }); }, 300); };
    $$('[data-a]', page).forEach((b) => b.onclick = () => act(b.dataset.a, b.dataset.id, b.dataset.t));
  }

  async function act(action, id, title) {
    if (action === 'edit') { location.href = `/admin/opportunity-form.html?id=${encodeURIComponent(id)}`; return; }
    if (action === 'matches') { location.href = `/admin/matching.html?id=${encodeURIComponent(id)}`; return; }
    try {
      if (action === 'delete') {
        if (!(await confirmDialog('Delete this draft?', `"${title}" will be permanently deleted.`, 'Delete', true))) return;
        const r = await api(`/api/admin/opportunities/${id}`, { method: 'DELETE' });
        toast(r.message, 'success');
      } else {
        const msgs = { paused: 'Students will no longer see it until you resume.', closed: 'Registration will be closed for students.', archived: 'It will be hidden from all lists.', published: 'It will be visible to students and matching will run again.', draft: 'It will become an editable draft.' };
        if (!(await confirmDialog(`Change status of "${title}"?`, msgs[action] || '', 'Confirm'))) return;
        const r = await api(`/api/admin/opportunities/${id}/status`, { method: 'POST', body: { status: action } });
        toast(r.matchStats ? `${r.message} ${r.matchStats.recommended} students matched, ${r.matchStats.notified} notified.` : r.message, 'success');
      }
      load();
    } catch (err) { toast(err.message, 'error'); }
  }
  load();
})();
