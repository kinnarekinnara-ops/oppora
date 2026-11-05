// =============================================================
// Students (Admin §8): staff-only list with profile completion,
// recommendations count, and a profile detail modal.
// =============================================================
(async function () {
  const me = await adminPage('students', { title: 'Students', allow: ['super_admin', 'opportunity_admin'] });
  const meta = await getMeta();
  const page = $('#page');
  let q = '';
  let programme = '';

  page.innerHTML = `
    <div class="page-head"><div><h1>Students</h1><p>Registered students and how well their profiles feed the matching engine.</p></div></div>
    <div class="filters" style="margin-bottom:16px">
      <div class="search-box" style="max-width:380px">${icon('search', 18)}<input class="input" id="q" placeholder="Search name, email, skill…"></div>
      <select class="input" id="prog"><option value="">All programmes</option>${meta.programmes.map((p) => `<option>${esc(p.name)}</option>`).join('')}</select>
    </div>
    <div id="list"></div>`;

  async function load() {
    const d = await api(`/api/admin/students?q=${encodeURIComponent(q)}&programme=${encodeURIComponent(programme)}`);
    $('#list').innerHTML = d.items.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Student</th><th>Programme</th><th>Skills</th><th>Profile</th><th>Recommendations</th><th>Saved</th><th>Status</th></tr></thead>
      <tbody>${d.items.map((s) => `
        <tr class="clickable" data-id="${esc(s.id)}">
          <td><div class="row"><span class="avatar">${esc(initials(s.name))}</span><div><div class="title">${esc(s.name)}</div><div class="xs muted">${esc(s.email)}</div></div></div></td>
          <td class="small">${esc(s.programme || '—')}<div class="xs muted">Year ${esc(s.year || '?')}</div></td>
          <td><div class="chips">${s.skills.slice(0, 3).map((k) => `<span class="chip blue">${esc(k)}</span>`).join('')}${s.skills.length > 3 ? `<span class="chip gray">+${s.skills.length - 3}</span>` : ''}${!s.skills.length ? '<span class="xs muted">None</span>' : ''}</div></td>
          <td style="min-width:120px"><div class="progress" style="height:8px"><span style="width:${s.completion}%;background:${s.completion < 50 ? 'var(--amber)' : 'var(--green)'}"></span></div><span class="xs muted">${s.completion}%</span></td>
          <td><b class="strong">${s.recommendations}</b></td>
          <td>${s.saved}</td>
          <td>${statusPill(s.status)}</td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="card">${emptyState('🎓', 'No students found', 'Try a different search.')}</div>`;
    $$('tr[data-id]').forEach((tr) => tr.onclick = () => openStudent(tr.dataset.id));
  }

  async function openStudent(sid) {
    const d = await api(`/api/admin/students/${encodeURIComponent(sid)}`);
    const p = d.profile;
    const m = openModal(`
      <div class="modal-head"><div class="row"><span class="avatar lg">${esc(initials(d.user.name))}</span><div><h2>${esc(d.user.name)}</h2><p class="small muted">${esc(d.user.email)}</p></div></div><button class="btn ghost sm" data-close>✕</button></div>
      <dl class="kv"><dt>Programme</dt><dd>${esc(p.programme)} · Year ${esc(p.year)} · ${esc(p.studyLevel)}</dd><dt>University</dt><dd>${esc(p.university)}</dd><dt>Profile</dt><dd>${d.completion.percent}% complete</dd>
        <dt>Skills</dt><dd><div class="chips">${(p.skills || []).map((s) => `<span class="chip blue">${esc(s.name)} · ${esc(s.level)}</span>`).join('') || '—'}</div></dd>
        <dt>Interests</dt><dd><div class="chips">${(p.interests || []).map((i) => `<span class="chip">${esc(i)}</span>`).join('') || '—'}</div></dd>
        <dt>Experience</dt><dd>${(p.experience || []).map((e) => `${esc(e.title)} <span class="muted">(${esc(e.type)})</span>`).join('<br>') || '—'}</dd></dl>
      <h3 style="margin-top:18px">Top matches</h3>
      <div class="stack" style="margin-top:8px">${d.topMatches.map((t) => `<div class="row"><span class="match ${t.tone}"><span class="pct">${t.score}%</span></span><span class="small">${esc(t.title)}</span></div>`).join('') || '<p class="small muted">No recommendations.</p>'}</div>
      ${me.user.role === 'super_admin' ? `<div class="modal-foot"><button class="btn ${d.user.status === 'active' ? 'danger' : 'green'}" id="toggle">${d.user.status === 'active' ? 'Suspend account' : 'Reactivate account'}</button></div>` : ''}`, { wide: true });
    const t = m.el.querySelector('#toggle');
    if (t) t.onclick = async () => {
      const r = await api(`/api/admin/students/${encodeURIComponent(sid)}/status`, { method: 'PUT', body: { status: d.user.status === 'active' ? 'suspended' : 'active' } });
      toast(r.message, 'success'); m.close(); load();
    };
  }

  let timer;
  $('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value; load(); }, 250); };
  $('#prog').onchange = (e) => { programme = e.target.value; load(); };
  load();
})();
