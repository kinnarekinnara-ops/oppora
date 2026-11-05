// Activity logs (Admin §11): every administrative action, newest first.
(async function () {
  await adminPage('logs', { title: 'Activity logs' });
  const page = $('#page');
  let action = '';

  async function load() {
    const d = await api(`/api/admin/logs${action ? `?action=${action}` : ''}`);
    page.innerHTML = `
      <div class="page-head"><div><h1>Activity logs</h1><p>A record of administrative actions for accountability.</p></div>
        <select class="input" id="filter" style="width:220px"><option value="">All actions</option><option value="opportunity" ${action === 'opportunity' ? 'selected' : ''}>Opportunities</option><option value="organization" ${action === 'organization' ? 'selected' : ''}>Organizations</option><option value="admin_user" ${action === 'admin_user' ? 'selected' : ''}>Admin users</option><option value="student" ${action === 'student' ? 'selected' : ''}>Students</option></select></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>${d.items.map((l) => `<tr>
          <td class="small" style="white-space:nowrap">${new Date(l.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
          <td><b class="strong small">${esc(l.actorName)}</b><div class="xs muted">${esc(ROLE_LABELS[l.actorRole] || l.actorRole)}</div></td>
          <td><span class="badge ${l.action.includes('published') || l.action.includes('approved') ? 'green' : l.action.includes('submitted') ? 'yellow' : 'blue'}">${esc(l.action.replace('.', ' · ').replace(/_/g, ' '))}</span></td>
          <td class="small">${esc(l.targetName || '—')}</td><td class="small muted">${esc(l.details || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No activity.</td></tr>'}</tbody>
      </table></div>`;
    $('#filter').onchange = (e) => { action = e.target.value; load(); };
  }
  load();
})();
