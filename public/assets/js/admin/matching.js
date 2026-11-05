// =============================================================
// Matching review (Admin §6): how the engine distributed an
// opportunity — score distribution, programmes reached, and
// per-student results (anonymised for organization reps).
// =============================================================
(async function () {
  const me = await adminPage('matching', { title: 'Matching review' });
  const page = $('#page');
  const id = new URLSearchParams(location.search).get('id');

  const list = await api('/api/admin/opportunities?status=published');
  const closed = await api('/api/admin/opportunities?status=closed');
  const options = [...list.items, ...closed.items];
  if (!options.length) { page.innerHTML = `<div class="card">${emptyState('🎯', 'No published opportunities yet', 'Publish an opportunity to see matching results.', '<a class="btn primary" href="/admin/opportunity-form.html">Create opportunity</a>')}</div>`; return; }
  const current = id || options[0].id;

  let d;
  try { d = await api(`/api/admin/opportunities/${encodeURIComponent(current)}/matches`); }
  catch (err) { page.innerHTML = errorState(err); return; }
  const o = d.opportunity;
  const b = d.buckets;
  const total = d.rows.length || 1;
  const seg = (n, color) => n ? `<span style="width:${(n / total) * 100}%;background:${color}" title="${n}"></span>` : '';
  const progs = Object.entries(d.byProgramme).sort((a, c) => c[1] - a[1]);
  const maxProg = Math.max(1, ...progs.map((p) => p[1]));

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Matching review</h1><p>See how OPPORA distributed this opportunity to students.</p></div>
      <div class="row">
        <select class="input" id="pick" style="min-width:280px" aria-label="Choose opportunity">${options.map((x) => `<option value="${x.id}" ${x.id === current ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
        ${o.status === 'published' ? '<button class="btn outline" id="rematch">↻ Re-run matching</button>' : ''}
      </div>
    </div>
    <div class="card" style="margin-bottom:20px"><div class="row between wrap">
      <div><div class="row wrap" style="gap:6px">${categoryBadges(o)} ${statusPill(o.status)}</div><h2 style="margin-top:8px">${esc(o.title)}</h2>
      <p class="small muted">${esc(o.organizer)} · ${o.openToAll ? 'Open to all' : `Targets ${esc(o.targetProgrammes.join(', '))}${o.restrictToProgrammes ? ' (restricted)' : ''}`} · Skills: ${esc(o.requiredSkills.join(', ') || '—')}</p></div>
      <a class="btn outline sm" href="/admin/opportunity-form.html?id=${encodeURIComponent(o.id)}">Edit</a></div></div>

    <div class="grid cols-4">
      <div class="stat"><div class="label">Profiles evaluated</div><div class="value">${d.stats.evaluated}</div></div>
      <div class="stat"><div class="label">Recommended to</div><div class="value">${d.stats.recommended}</div><div class="hint">${d.stats.strong} strong matches</div></div>
      <div class="stat"><div class="label">Beyond target programmes</div><div class="value">${d.stats.crossDisciplinary}</div><div class="hint">Cross-disciplinary discoveries</div></div>
      <div class="stat"><div class="label">Engagement</div><div class="value">${d.stats.saved}</div><div class="hint">saved · ${d.stats.views} views · ${d.stats.clicks} link clicks · ${d.stats.notified} notified</div></div>
    </div>

    <div class="grid cols-2" style="margin-top:20px">
      <div class="card"><h3>Score distribution</h3>
        <div class="dist" style="margin-top:14px">${seg(b.strong, 'var(--green)')}${seg(b.good, 'var(--blue-bright)')}${seg(b.potential, 'var(--amber)')}${seg(b.low, '#94A3B8')}${seg(b.notEligible, '#F5C2C2')}${seg(b.insufficient, '#E2EAF3')}</div>
        <div class="legend"><span><i style="background:var(--green)"></i>Strong ${b.strong}</span><span><i style="background:var(--blue-bright)"></i>Good ${b.good}</span><span><i style="background:var(--amber)"></i>Potential ${b.potential}</span><span><i style="background:#94A3B8"></i>Lower ${b.low}</span><span><i style="background:#F5C2C2"></i>Not eligible ${b.notEligible}</span><span><i style="background:#E2EAF3"></i>Incomplete profile ${b.insufficient}</span></div></div>
      <div class="card"><h3>Programmes reached</h3>
        ${progs.length ? progs.map(([p, n]) => `<div class="hbar"><span class="small">${esc(p)}${o.targetProgrammes.includes(p) ? ' 🎯' : ''}</span><div class="track"><span style="width:${(n / maxProg) * 100}%;background:${o.targetProgrammes.includes(p) || o.openToAll ? 'var(--blue)' : 'var(--amber)'}"></span></div><b class="small">${n}</b></div>`).join('')
          : '<p class="small muted" style="margin-top:10px">No recommended students yet.</p>'}
        <p class="xs muted" style="margin-top:10px">🎯 = target programme · amber bars = students reached through skills & interests</p></div>
    </div>

    <h2 style="margin:28px 0 12px">Student results</h2>
    ${d.anonymised ? '<div class="alert info" style="margin-bottom:12px">🔒 Student identities are hidden for organization representatives to protect student privacy.</div>' : ''}
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Student</th><th>Programme</th><th>Match</th><th>Eligibility</th><th>Matched skills</th><th>Skill gaps</th><th>Status</th></tr></thead>
      <tbody>${d.rows.map((r) => `
        <tr>
          <td><b class="strong">${esc(r.student)}</b>${r.crossDisciplinary ? '<div><span class="badge yellow" style="margin-top:4px">✦ Cross-discipline</span></div>' : ''}</td>
          <td class="small">${esc(r.programme || '—')}<div class="xs muted">Year ${esc(r.year || '?')}</div></td>
          <td>${r.score === null ? '<span class="badge gray">Insufficient profile</span>' : `<span class="match ${r.tone}"><span class="pct">${r.score}%</span>${esc(r.label)}${r.provisional ? '*' : ''}</span>`}</td>
          <td>${statusPill(r.eligibility)}${r.eligibilityReasons.length ? `<div class="xs muted" style="max-width:220px;margin-top:3px">${esc(r.eligibilityReasons[0])}</div>` : ''}</td>
          <td><div class="chips">${r.matchedSkills.map((s) => `<span class="chip">${esc(s)}</span>`).join('') || '—'}</div></td>
          <td><div class="chips">${r.missingSkills.map((s) => `<span class="chip yellow">${esc(s)}</span>`).join('') || '—'}</div></td>
          <td class="small">${r.notified ? '🔔 Notified' : ''}${r.saved ? '<br>♥ Saved' : ''}</td>
        </tr>`).join('')}</tbody></table></div>
    <p class="xs muted" style="margin-top:8px">* Provisional score — the student's profile is missing some information.</p>`;

  $('#pick').onchange = (e) => { location.href = `/admin/matching.html?id=${encodeURIComponent(e.target.value)}`; };
  if ($('#rematch')) $('#rematch').onclick = async () => {
    const r = await api(`/api/admin/opportunities/${encodeURIComponent(o.id)}/rematch`, { method: 'POST' });
    toast(r.message, 'success');
    setTimeout(() => location.reload(), 700);
  };
})();
