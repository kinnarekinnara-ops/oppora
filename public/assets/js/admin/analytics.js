// =============================================================
// Analytics (Admin §10): opportunity performance, category mix,
// skill demand vs. student supply, students by programme.
// =============================================================
(async function () {
  await adminPage('analytics', { title: 'Analytics' });
  const page = $('#page');
  let d;
  try { d = await api('/api/admin/analytics'); } catch (err) { page.innerHTML = errorState(err); return; }
  const t = d.totals;
  const maxCat = Math.max(1, ...d.categories.map((c) => c.count));
  const maxGap = Math.max(1, ...d.skillGap.map((s) => Math.max(s.opportunities, s.students)));
  const progs = Object.entries(d.programmes).sort((a, b) => b[1] - a[1]);
  const maxProg = Math.max(1, ...progs.map((p) => p[1]));
  const ctr = t.views ? Math.round((t.clicks / t.views) * 100) : 0;

  page.innerHTML = `
    <div class="page-head"><div><h1>Analytics</h1><p>How opportunities are reaching and engaging students.</p></div></div>
    <div class="grid cols-4">
      <div class="stat"><div class="label">Students reached</div><div class="value">${t.recommended || 0}</div><div class="hint">Total recommendations</div></div>
      <div class="stat"><div class="label">Cross-disciplinary</div><div class="value">${t.crossDisciplinary || 0}</div><div class="hint">Matches beyond target programmes</div></div>
      <div class="stat"><div class="label">Notifications</div><div class="value">${t.notified || 0}</div><div class="hint">${t.saved || 0} saves</div></div>
      <div class="stat"><div class="label">Views → link clicks</div><div class="value">${ctr}%</div><div class="hint">${t.views || 0} views · ${t.clicks || 0} clicks</div></div>
    </div>
    <div class="grid cols-3" style="margin-top:20px;align-items:start">
      <div class="card"><h3>Opportunities by category</h3>
        ${d.categories.map((c) => `<div class="hbar" style="grid-template-columns:150px 1fr 30px"><span class="small">${esc(c.name)}</span><div class="track"><span style="width:${(c.count / maxCat) * 100}%;background:${c.color}"></span></div><b class="small">${c.count}</b></div>`).join('')}</div>
      <div class="card"><h3>Skill demand vs. supply</h3><p class="xs muted">Opportunities asking for a skill vs. students who have it.</p>
        ${d.skillGap.map((s) => `<div class="hbar" style="grid-template-columns:120px 1fr 44px"><span class="small">${esc(s.skill)}</span>
          <div><div class="track" style="height:7px"><span style="width:${(s.opportunities / maxGap) * 100}%;background:var(--blue)"></span></div><div class="track" style="height:7px;margin-top:3px"><span style="width:${(s.students / maxGap) * 100}%;background:var(--green)"></span></div></div>
          <b class="xs">${s.opportunities}/${s.students}</b></div>`).join('')}
        <div class="legend"><span><i style="background:var(--blue)"></i>Opportunities</span><span><i style="background:var(--green)"></i>Students</span></div></div>
      <div class="card"><h3>Students by programme</h3>
        ${progs.map(([p, n]) => `<div class="hbar" style="grid-template-columns:150px 1fr 30px"><span class="small">${esc(p)}</span><div class="track"><span style="width:${(n / maxProg) * 100}%;background:var(--blue-bright)"></span></div><b class="small">${n}</b></div>`).join('')}</div>
    </div>
    <h2 style="margin:28px 0 12px">Opportunity performance</h2>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Opportunity</th><th>Status</th><th>Matched</th><th>Strong</th><th>Cross-disc.</th><th>Notified</th><th>Views</th><th>Saved</th><th>Clicks</th></tr></thead>
      <tbody>${d.rows.map((r) => `<tr class="clickable" onclick="location.href='/admin/matching.html?id=${encodeURIComponent(r.id)}'">
        <td><div class="title">${esc(r.title)}</div><div class="xs muted">${esc(r.categories.join(', '))}</div></td><td>${statusPill(r.status)}</td>
        <td><b class="strong">${r.recommended}</b></td><td>${r.strong}</td><td>${r.crossDisciplinary}</td><td>${r.notified}</td><td>${r.views}</td><td>${r.saved}</td><td>${r.clicks}</td></tr>`).join('')}</tbody>
    </table></div>`;
})();
