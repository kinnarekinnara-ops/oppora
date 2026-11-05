// =============================================================
// Organizations (Admin §9): clubs, departments and societies that
// publish opportunities. Staff can add, edit and suspend them.
// =============================================================
(async function () {
  const me = await adminPage('organizations', { title: 'Organizations' });
  const page = $('#page');
  const TYPES = ['Department', 'Club', 'Society', 'Faculty', 'Office', 'External Partner'];

  async function load() {
    const d = await api('/api/admin/organizations');
    page.innerHTML = `
      <div class="page-head"><div><h1>Organizations</h1><p>Departments, clubs and societies that publish opportunities on OPPORA.</p></div>
        ${me.staff ? '<button class="btn green" id="addBtn">+ Add organization</button>' : ''}</div>
      <div class="grid auto">${d.items.map((o) => `
        <div class="card">
          <div class="row between"><span class="badge blue">${esc(o.type)}</span>${statusPill(o.status)}</div>
          <h3 style="margin-top:10px">${esc(o.name)}</h3>
          <p class="small muted">${esc(o.email || 'No contact email')}</p>
          <div class="row" style="margin-top:12px;gap:18px">
            <div><b class="strong" style="font-size:20px">${o.published}</b><div class="xs muted">live</div></div>
            <div><b class="strong" style="font-size:20px">${o.opportunities}</b><div class="xs muted">total</div></div>
          </div>
          <p class="xs muted" style="margin-top:10px">Representatives: ${esc(o.representatives.join(', ') || 'none')}</p>
          ${me.staff ? `<div class="row" style="margin-top:12px"><button class="btn outline sm" data-edit="${esc(o.id)}">Edit</button>
            <button class="btn ${o.status === 'active' ? 'danger' : 'green'} sm" data-toggle="${esc(o.id)}" data-status="${o.status === 'active' ? 'suspended' : 'active'}">${o.status === 'active' ? 'Suspend' : 'Reactivate'}</button></div>` : ''}
        </div>`).join('')}</div>`;

    if ($('#addBtn')) $('#addBtn').onclick = () => edit();
    $$('[data-edit]', page).forEach((b) => b.onclick = () => edit(d.items.find((o) => o.id === b.dataset.edit)));
    $$('[data-toggle]', page).forEach((b) => b.onclick = async () => {
      const r = await api(`/api/admin/organizations/${b.dataset.toggle}`, { method: 'PUT', body: { status: b.dataset.status } });
      toast(r.message, 'success'); load();
    });
  }

  function edit(o = null) {
    const m = openModal(`
      <div class="modal-head"><h2>${o ? 'Edit organization' : 'Add organization'}</h2><button class="btn ghost sm" data-close>✕</button></div>
      <form id="orgForm" class="stack">
        <div class="field"><label for="n">Name</label><input class="input" id="n" name="name" value="${esc(o ? o.name : '')}" required></div>
        <div class="field"><label for="t">Type</label><select class="input" id="t" name="type">${TYPES.map((t) => `<option ${o && o.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label for="e">Contact email</label><input class="input" id="e" name="email" type="email" value="${esc(o ? o.email : '')}"></div>
        <div class="field"><label for="d">Description</label><textarea class="input" id="d" name="description" rows="3">${esc(o ? o.description : '')}</textarea></div>
        <div class="modal-foot"><button type="button" class="btn outline" data-close>Cancel</button><button class="btn primary">Save</button></div>
      </form>`);
    m.el.querySelector('#orgForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = { name: f.name.value, type: f.type.value, email: f.email.value, description: f.description.value };
      try {
        const r = await api(o ? `/api/admin/organizations/${o.id}` : '/api/admin/organizations', { method: o ? 'PUT' : 'POST', body });
        toast(r.message, 'success'); m.close(); load();
      } catch (err) { toast(err.message, 'error'); }
    };
  }
  load();
})();
