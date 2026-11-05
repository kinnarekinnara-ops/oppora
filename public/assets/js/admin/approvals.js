// =============================================================
// Approvals (Admin §2.3): staff approve/reject submissions from
// organization representatives. Org reps see their own submissions.
// =============================================================
(async function () {
  const me = await adminPage('approvals', { title: 'Approvals' });
  const page = $('#page');

  async function load() {
    const [pending, drafts] = await Promise.all([
      api('/api/admin/opportunities?status=pending_approval'),
      me.staff ? Promise.resolve({ items: [] }) : api('/api/admin/opportunities?status=draft'),
    ]);
    page.innerHTML = `
      <div class="page-head"><div><h1>${me.staff ? 'Approval queue' : 'My submissions'}</h1>
        <p>${me.staff ? 'Opportunities submitted by clubs and organizations. Approving publishes them and runs matching immediately.' : 'Opportunities you submitted for approval, and drafts returned with feedback.'}</p></div></div>
      ${pending.items.length ? `<div class="stack">${pending.items.map((o) => `
        <div class="card">
          <div class="row between wrap">
            <div><div class="row wrap" style="gap:6px">${categoryBadges(o)} ${statusPill(o.status)}</div>
              <h2 style="margin-top:8px">${esc(o.title)}</h2>
              <p class="small muted">${esc(o.organizer)} · submitted ${o.submittedAt ? timeAgo(o.submittedAt) : ''} · Event ${fmtDate(o.eventDate)} · Deadline ${fmtDate(o.deadline)}</p></div>
            ${me.staff ? `<div class="row"><button class="btn danger sm" data-reject="${esc(o.id)}">Return with feedback</button><a class="btn outline sm" href="/admin/opportunity-form.html?id=${encodeURIComponent(o.id)}">Edit</a><button class="btn green sm" data-approve="${esc(o.id)}">✓ Approve & publish</button></div>`
              : `<a class="btn outline sm" href="/admin/opportunity-form.html?id=${encodeURIComponent(o.id)}">Edit</a>`}
          </div>
          <p style="margin-top:12px">${esc(o.description)}</p>
          <div class="row wrap" style="margin-top:12px;gap:6px">${o.requiredSkills.map((s) => `<span class="chip blue">${esc(s)}</span>`).join('')}
            <span class="badge gray">${o.openToAll ? 'Open to all' : esc(o.targetProgrammes.join(', '))}</span><span class="badge gray">${esc(o.experienceLevel)}</span></div>
        </div>`).join('')}</div>`
        : `<div class="card">${emptyState('✅', 'Nothing awaiting approval', me.staff ? 'Submissions from organization representatives will appear here.' : 'Submit an opportunity and it will appear here while it is reviewed.')}</div>`}
      ${drafts.items.filter((o) => o.rejectionReason).length ? `<h2 style="margin:28px 0 12px">Returned with feedback</h2><div class="stack">${drafts.items.filter((o) => o.rejectionReason).map((o) => `
        <div class="card row between"><div><b class="strong">${esc(o.title)}</b><div class="small" style="color:var(--red)">${esc(o.rejectionReason)}</div></div>
        <a class="btn primary sm" href="/admin/opportunity-form.html?id=${encodeURIComponent(o.id)}">Fix & resubmit</a></div>`).join('')}</div>` : ''}`;

    $$('[data-approve]', page).forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api(`/api/admin/opportunities/${b.dataset.approve}/approve`, { method: 'POST' });
        toast(`${r.message} ${r.matchStats.recommended} students matched, ${r.matchStats.notified} notified.`, 'success');
        load();
      } catch (err) { toast(err.message, 'error'); b.disabled = false; }
    });
    $$('[data-reject]', page).forEach((b) => b.onclick = () => {
      const m = openModal(`<div class="modal-head"><h2>Return with feedback</h2></div>
        <div class="field"><label for="reason">What needs to change?</label><textarea class="input" id="reason" rows="4" placeholder="e.g. Please add a registration link and the event date."></textarea></div>
        <div class="modal-foot"><button class="btn outline" data-close>Cancel</button><button class="btn danger" id="send">Return to organization</button></div>`);
      m.el.querySelector('#send').onclick = async () => {
        const r = await api(`/api/admin/opportunities/${b.dataset.reject}/reject`, { method: 'POST', body: { reason: m.el.querySelector('#reason').value } });
        m.close(); toast(r.message, 'success'); load();
      };
    });
  }
  load();
})();
