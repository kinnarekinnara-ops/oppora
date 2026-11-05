// =============================================================
// Admin users (Admin §2.1): Super Admin creates admin accounts,
// assigns roles, links org reps to organizations, suspends access.
// =============================================================
(async function () {
  const me = await adminPage('users', { title: 'Admin users', allow: ['super_admin'] });
  const meta = await getMeta();
  const page = $('#page');
  const ROLES = [['super_admin', 'Super Administrator'], ['opportunity_admin', 'Opportunity Administrator'], ['org_rep', 'Organization Representative']];

  async function load() {
    const d = await api('/api/admin/users');
    page.innerHTML = `
      <div class="page-head"><div><h1>Admin users</h1><p>Who can publish and manage opportunities, and what they're allowed to do.</p></div><button class="btn green" id="addBtn">+ Add admin</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Name</th><th>Role</th><th>Organization</th><th>Last login</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.items.map((u) => `<tr>
          <td><div class="row"><span class="avatar">${esc(initials(u.name))}</span><div><div class="title">${esc(u.name)}</div><div class="xs muted">${esc(u.email)}</div></div></div></td>
          <td><select class="input" style="height:36px" data-role="${esc(u.id)}" ${u.id === me.user.id ? 'disabled' : ''}>${ROLES.map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td class="small">${esc(u.organization || '—')}</td>
          <td class="small muted">${u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
          <td>${statusPill(u.status)}</td>
          <td>${u.id !== me.user.id ? `<button class="btn ${u.status === 'active' ? 'danger' : 'green'} sm" data-toggle="${esc(u.id)}" data-s="${u.status === 'active' ? 'suspended' : 'active'}">${u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>` : '<span class="xs muted">You</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="card blue" style="margin-top:20px"><h3>Role permissions</h3>
        <dl class="kv" style="margin-top:10px"><dt>Super Administrator</dt><dd>Everything, including admin accounts, students and platform settings.</dd>
        <dt>Opportunity Administrator</dt><dd>Create, edit, publish and approve all opportunities; view students and analytics.</dd>
        <dt>Organization Representative</dt><dd>Create and manage their own organization's opportunities. New ones need approval. Sees anonymised match data only.</dd></dl></div>`;

    $('#addBtn').onclick = add;
    $$('[data-role]', page).forEach((s) => s.onchange = async () => {
      try { const r = await api(`/api/admin/users/${s.dataset.role}`, { method: 'PUT', body: { role: s.value } }); toast(r.message, 'success'); } catch (err) { toast(err.message, 'error'); }
    });
    $$('[data-toggle]', page).forEach((b) => b.onclick = async () => {
      const r = await api(`/api/admin/users/${b.dataset.toggle}`, { method: 'PUT', body: { status: b.dataset.s } });
      toast(r.message, 'success'); load();
    });
  }

  function add() {
    const m = openModal(`
      <div class="modal-head"><h2>Add administrator</h2><button class="btn ghost sm" data-close>✕</button></div>
      <form id="uForm" class="stack">
        <div class="field"><label for="un">Full name</label><input class="input" id="un" name="name" required></div>
        <div class="field"><label for="ue">Email</label><input class="input" id="ue" name="email" type="email" required></div>
        <div class="field"><label for="ur">Role</label><select class="input" id="ur" name="role">${ROLES.map(([k, l]) => `<option value="${k}" ${k === 'opportunity_admin' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field hidden" id="orgField"><label for="uo">Organization</label><select class="input" id="uo" name="organizationId">${meta.organizations.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="up">Temporary password</label><input class="input" id="up" name="password" value="changeme123"><span class="hint">Share it securely; they can change it after logging in.</span></div>
        <div class="modal-foot"><button type="button" class="btn outline" data-close>Cancel</button><button class="btn primary">Create account</button></div>
      </form>`);
    const f = m.el.querySelector('#uForm');
    f.role.onchange = () => m.el.querySelector('#orgField').classList.toggle('hidden', f.role.value !== 'org_rep');
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('/api/admin/users', { method: 'POST', body: { name: f.name.value, email: f.email.value, role: f.role.value, organizationId: f.organizationId.value, password: f.password.value } });
        toast(r.message, 'success'); m.close(); load();
      } catch (err) { toast(err.message, 'error'); }
    };
  }
  load();
})();
