// =============================================================
// Opportunity details (Student Portal §6–7): full info, eligibility
// status, and the personal match explanation with score breakdown.
// Eligibility is always shown SEPARATELY from compatibility.
// =============================================================
(async function () {
  await studentPage('opportunities');
  const page = $('#page');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { page.innerHTML = errorState('No opportunity selected.'); return; }

  let d;
  try { d = await api(`/api/opportunities/${encodeURIComponent(id)}`); }
  catch (err) { page.innerHTML = `${errorState(err)}<p style="margin-top:16px"><a href="/student/opportunities.html">← Back to explore</a></p>`; return; }

  const o = d.opportunity;
  const m = d.match;
  const st = catStyle(o.categories[0]);
  document.title = `${o.title} · OPPORA`;
  const isOpen = ['open', 'closing_soon'].includes(o.availability);

  const eligBlock = () => {
    if (!m) return '';
    const e = m.eligibilityDetails;
    if (e.status === 'not_eligible') {
      return `<div class="alert error" style="flex-direction:column;gap:6px"><b>✕ You don't meet a mandatory requirement</b><ul class="list-check bad">${e.failed.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
    }
    if (e.status === 'unconfirmed') {
      return `<div class="alert warn" style="flex-direction:column;gap:6px"><b>? Eligibility unconfirmed</b><ul class="list-check info">${e.unknown.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a href="/student/profile.html" class="small strong">Update my profile →</a></div>`;
    }
    return `<div class="alert success" style="flex-direction:column;gap:6px"><b>✓ You meet the listed eligibility requirements</b>
      ${e.selfConfirm.length ? `<span class="small">Please confirm these yourself:</span><ul class="list-check info">${e.selfConfirm.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</div>`;
  };

  const matchPanel = () => {
    if (!m) return '';
    if (m.eligibility === 'not_eligible') {
      return `<div class="card"><h3>Your match</h3><p class="small muted" style="margin-top:6px">Because a mandatory requirement isn't met, this isn't shown as a recommendation. You can still explore it.</p>
        ${m.score !== null ? `<p class="small" style="margin-top:10px">For reference, your skills & interests alignment is <b>${m.score}%</b>.</p>` : ''}</div>`;
    }
    if (m.score === null) {
      return `<div class="card">${emptyState('🧭', 'Complete your profile to see your match', 'Add your skills and interests to get a personalised compatibility score.', '<a class="btn primary" href="/student/profile.html">Complete profile</a>')}</div>`;
    }
    const dims = [['Skills', 'skills', '50%'], ['Interests', 'interests', '25%'], ['Academic', 'academic', '15%'], ['Experience', 'experience', '10%']];
    return `
      <div class="card">
        <div class="score-big">
          <div class="score-ring" style="--p:${m.score};--c:${scoreColor(m.score)}"><span>${m.score}%</span></div>
          <div><span class="match ${m.tone}" style="padding:4px 12px">${esc(m.label)}</span>
            <p class="small muted" style="margin-top:6px">Compatibility with your profile${m.provisional ? ' <b>(provisional)</b>' : ''}</p>
            ${m.crossDisciplinary ? '<span class="badge yellow" style="margin-top:6px">✦ Beyond your programme</span>' : ''}</div>
        </div>
        <h3 style="margin-top:20px">Why this matches you</h3>
        <ul class="list-check" style="margin-top:10px">${m.reasons.map((r) => `<li>${esc(r)}</li>`).join('') || '<li>General opportunity open to you.</li>'}</ul>
        ${m.improve.length ? `<h3 style="margin-top:18px">Areas to grow</h3><p class="xs muted">Not required to join — great skills to develop along the way.</p>
          <ul class="list-check warn" style="margin-top:8px">${m.improve.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${m.notes.map((n) => `<div class="alert info small" style="margin-top:14px">${esc(n)} <a href="/student/profile.html">Update profile</a></div>`).join('')}
        <details style="margin-top:16px"><summary class="small strong" style="cursor:pointer;color:var(--blue)">How is this calculated?</summary>
          <div class="breakdown" style="margin-top:8px">
            ${dims.map(([label, k, w]) => {
              const v = m.breakdown[k];
              return `<div class="bar-row"><span class="small">${label} <span class="muted">${w}</span></span><div class="progress blue"><span style="width:${v ?? 0}%"></span></div><span class="small strong">${v === null ? '—' : v}</span></div>`;
            }).join('')}
          </div>
        </details>
        <p class="xs muted" style="margin-top:14px">${esc(m.disclaimer)}</p>
      </div>`;
  };

  page.innerHTML = `
    <a href="/student/opportunities.html" class="small strong">← Back to explore</a>
    <section class="detail-hero" style="background:${st.bg};margin-top:12px">
      <span class="emoji" aria-hidden="true">${st.emoji}</span>
      <div class="row wrap" style="gap:6px">${categoryBadges(o).replace(/class="badge cat" style="background:[^"]+"/g, 'class="badge" style="background:rgba(255,255,255,.92)"')} ${statusPill(o.availability)}</div>
      <h1>${esc(o.title)}</h1>
      <div class="meta">
        <span>🏛 ${esc(o.organizer)}</span>
        <span>📅 ${fmtDate(o.eventDate, true)}${o.eventEndDate ? ` – ${fmtDate(o.eventEndDate)}` : ''}</span>
        <span>📍 ${esc(o.location || 'TBA')} · ${esc(o.deliveryMode)}</span>
        <span>⏳ Register by ${fmtDate(o.deadline)} (${daysLeftText(o.daysLeft)})</span>
      </div>
      <div class="row wrap" style="margin-top:20px">
        ${isOpen ? `<button class="btn yellow" id="regBtn">Register / Apply ${icon('external', 16)}</button>` : '<span class="badge gray">Registration closed</span>'}
        <button class="btn outline" id="saveBtn" style="background:rgba(255,255,255,.95)"></button>
      </div>
    </section>

    <div class="detail-grid">
      <div class="stack" style="--gap:20px">
        ${eligBlock()}
        <div class="card"><h2>About this opportunity</h2><p class="desc" style="margin-top:10px">${esc(o.description)}</p></div>
        <div class="card">
          <h2>Details</h2>
          <dl class="kv" style="margin-top:14px">
            <dt>Organizer</dt><dd>${esc(o.organizer)}${d.organization && d.organization.email ? ` · <a href="mailto:${esc(d.organization.email)}">${esc(d.organization.email)}</a>` : ''}</dd>
            <dt>Experience level</dt><dd>${esc(o.experienceLevel)}</dd>
            <dt>Required skills</dt><dd><div class="chips">${o.requiredSkills.map((s) => `<span class="chip ${m && m.matchedSkills.includes(s) ? '' : 'gray'}">${m && m.matchedSkills.includes(s) ? '✓ ' : ''}${esc(s)}</span>`).join('') || '—'}</div></dd>
            ${o.preferredSkills.length ? `<dt>Nice to have</dt><dd><div class="chips">${o.preferredSkills.map((s) => `<span class="chip ${m && m.matchedSkills.includes(s) ? '' : 'gray'}">${esc(s)}</span>`).join('')}</div></dd>` : ''}
            <dt>Who it's for</dt><dd>${o.openToAll ? 'Open to all students' : `${esc(o.targetProgrammes.join(', '))}${o.restrictToProgrammes ? ' <b>(only)</b>' : ' (others welcome)'}`}</dd>
            ${o.eligibleYears.length ? `<dt>Eligible years</dt><dd>Year ${o.eligibleYears.join(', ')}</dd>` : ''}
            ${o.studyLevels.length ? `<dt>Study level</dt><dd>${esc(o.studyLevels.join(', '))}</dd>` : ''}
            ${o.mandatoryRequirements.length ? `<dt>Mandatory</dt><dd>${o.mandatoryRequirements.map((r) => esc(r.type === 'skill' ? `${r.value}${r.minLevel ? ` (${r.minLevel}+)` : ''}` : r.value)).join('<br>')}</dd>` : ''}
            ${o.maxParticipants ? `<dt>Capacity</dt><dd>${o.maxParticipants} participants</dd>` : ''}
            ${o.applicationInstructions ? `<dt>How to apply</dt><dd>${esc(o.applicationInstructions)}</dd>` : ''}
            ${o.attachments.length ? `<dt>Documents</dt><dd>${o.attachments.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)}</a>`).join('<br>')}</dd>` : ''}
          </dl>
        </div>
        ${d.similar.length ? `<div><h2 style="margin:8px 0 14px">Similar opportunities</h2><div class="grid cols-3" id="similar">${d.similar.map((s) => oppCard(s, { showReason: false })).join('')}</div></div>` : ''}
      </div>
      <aside class="match-panel">
        ${matchPanel()}
        ${d.saved ? `<div class="card" style="margin-top:16px"><h3>My tracking</h3>
          <select class="input" id="trackSel" style="margin-top:10px" aria-label="Tracking status">${['saved', 'planning', 'registered', 'completed'].map((s) => `<option value="${s}" ${d.saved.trackingStatus === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>` : ''}
      </aside>
    </div>`;

  // Save toggle
  let saved = !!d.saved;
  const drawSave = () => { $('#saveBtn').innerHTML = saved ? '♥ Saved' : '♡ Save'; $('#saveBtn').setAttribute('aria-pressed', saved); };
  drawSave();
  $('#saveBtn').onclick = async () => {
    try {
      await api(`/api/saved/${encodeURIComponent(o.id)}`, { method: saved ? 'DELETE' : 'POST' });
      saved = !saved; drawSave();
      toast(saved ? 'Saved! You\'ll get a reminder before the deadline.' : 'Removed from saved', saved ? 'success' : '');
    } catch (err) { toast(err.message, 'error'); }
  };
  if ($('#regBtn')) $('#regBtn').onclick = async () => {
    const { url } = await api(`/api/opportunities/${encodeURIComponent(o.id)}/click`, { method: 'POST' });
    if (url) window.open(url, '_blank', 'noopener');
    else toast('See "How to apply" in the details below.');
  };
  if ($('#trackSel')) $('#trackSel').onchange = async (e) => {
    await api(`/api/saved/${encodeURIComponent(o.id)}`, { method: 'PUT', body: { trackingStatus: e.target.value } });
    toast('Tracking status updated', 'success');
  };
  if ($('#similar')) bindOppCards($('#similar'));
})();
