// =============================================================
// Student dashboard (Student Portal §4): welcome, recommendations,
// cross-disciplinary picks, new opportunities, deadlines, notifications.
// =============================================================
const NOTIF_ICON = { new_match: ['🎯', 'var(--tint-green)'], general: ['📢', 'var(--tint-blue)'], deadline: ['⏳', 'var(--tint-yellow)'], update: ['📝', 'var(--tint-blue)'] };

function notifItem(n) {
  const [ic, bg] = NOTIF_ICON[n.type] || ['🔔', 'var(--bg)'];
  const href = n.opportunityId ? `/student/opportunity.html?id=${encodeURIComponent(n.opportunityId)}` : '/student/notifications.html';
  return `<a class="notif-item ${n.read ? '' : 'unread'}" href="${href}"><span class="ic" style="background:${bg}">${ic}</span>
    <span class="grow"><span class="t">${esc(n.title)}</span><span class="m" style="display:block">${timeAgo(n.createdAt)}</span></span></a>`;
}

(async function () {
  await studentPage('dashboard');
  const page = $('#page');
  let d;
  try {
    d = await api('/api/student/dashboard');
  } catch (err) { page.innerHTML = errorState(err); return; }

  const first = d.user.name.split(' ')[0];
  const isWelcome = new URLSearchParams(location.search).has('welcome');
  const p = d.profile;

  page.innerHTML = `
    ${isWelcome ? `<div class="alert success" style="margin-bottom:16px">🎉 Welcome to OPPORA, ${esc(first)}! We've already matched your profile against every open opportunity.</div>` : ''}
    <section class="welcome">
      <div>
        <h1>Hi ${esc(first)}, <em>${d.stats.recommended ? `${d.stats.recommended} opportunities` : 'new opportunities'}</em> ${d.stats.recommended ? 'match you.' : 'are waiting.'}</h1>
        <p>${esc(p.programme || 'Programme not set')} · Year ${esc(p.year || '?')} · ${esc(p.university || '')}</p>
      </div>
      <div class="mini-stats">
        <div><b>${d.stats.strong}</b><span>Strong matches</span></div>
        <div><b>${d.stats.saved}</b><span>Saved</span></div>
        <div><b>${d.stats.closingSoon}</b><span>Closing soon</span></div>
      </div>
    </section>

    <div class="dash">
      <div>
        <div class="section-head">
          <div><h2>✨ Recommended for you</h2><p>Ranked by how well each opportunity fits your skills, interests, programme and experience.</p></div>
          <a href="/student/opportunities.html" class="small strong" style="color:var(--blue)">View all →</a>
        </div>
        <div class="grid cols-3" id="recGrid">
          ${d.recommended.length ? d.recommended.map((o) => oppCard(o)).join('') : `<div style="grid-column:1/-1" class="card">${
            d.completion.percent < 40
              ? emptyState('🧭', 'Complete your profile to receive personalised recommendations', 'Add your skills and interests so OPPORA can find opportunities that fit you.', '<a class="btn primary" href="/student/profile.html">Complete my profile</a>')
              : emptyState('🔍', 'No matching opportunities yet', 'Explore all campus opportunities or update your interests to discover more.', '<a class="btn primary" href="/student/opportunities.html">Explore all opportunities</a>')}</div>`}
        </div>

        ${d.crossDisciplinary.length ? `
        <section class="section">
          <div class="cross-banner">
            <h3>🔭 Beyond your programme</h3>
            <p class="small" style="margin-top:4px">These aren't aimed at ${esc(p.programme)} students — but your skills say you'd do well.</p>
            <div class="stack" style="margin-top:12px">
              ${d.crossDisciplinary.map((o) => `<a class="row" href="/student/opportunity.html?id=${encodeURIComponent(o.id)}" style="background:#fff;padding:10px 14px;border-radius:12px;text-decoration:none">
                ${matchBadge(o.match, { long: false })}<span class="strong grow">${esc(o.title)}</span><span class="small muted">${esc(o.organizer)}</span></a>`).join('')}
            </div>
          </div>
        </section>` : ''}

        <section class="section">
          <div class="section-head"><div><h2>🆕 New this fortnight</h2><p>Recently published across campus.</p></div></div>
          <div class="grid cols-3" id="newGrid">${d.newOpportunities.length ? d.newOpportunities.map((o) => oppCard(o, { showReason: false })).join('') : '<p class="muted">Nothing new in the last two weeks.</p>'}</div>
        </section>
      </div>

      <aside class="side-stack">
        <div class="card green profile-card">
          <div class="top">
            <span class="avatar lg">${esc(initials(d.user.name))}</span>
            <div class="grow"><h3>My Student Profile</h3><p class="small muted">${esc(p.programme || '')}</p></div>
            <a href="/student/profile.html" class="icon-btn" aria-label="Edit profile">✏️</a>
          </div>
          <div class="row" style="gap:14px">
            <div class="ring" style="--p:${d.completion.percent}"><span>${d.completion.percent}%</span></div>
            <div class="small">${d.completion.percent >= 100 ? '<b class="strong">Profile complete!</b> Your matches are as accurate as they can be.' : `<b class="strong">Profile completion</b><br>Add ${esc(d.completion.missing.slice(0, 2).join(' and ').toLowerCase())} to improve your matches.`}</div>
          </div>
          <div class="divider" style="margin:14px 0"></div>
          <div class="label" style="margin-bottom:6px">Interests</div>
          <div class="chips">${(p.interests || []).map((i) => `<span class="chip">${esc(i)}</span>`).join('') || '<span class="small muted">None yet</span>'}</div>
          <div class="label" style="margin:12px 0 6px">Top skills</div>
          <div class="chips">${(p.skills || []).slice(0, 6).map((s) => `<span class="chip blue">${esc(s.name)}</span>`).join('') || '<span class="small muted">None yet</span>'}</div>
        </div>

        <div class="card">
          <div class="row between"><h3>⏳ Upcoming deadlines</h3><a href="/student/saved.html" class="small">Saved →</a></div>
          <div style="margin-top:8px">
            ${d.upcomingDeadlines.length ? d.upcomingDeadlines.map((o) => {
              const dt = parseDay(o.deadline);
              return `<a class="deadline-item" href="/student/opportunity.html?id=${encodeURIComponent(o.id)}" style="text-decoration:none">
                <span class="date-box ${o.daysLeft <= 3 ? 'urgent' : ''}"><b>${dt.getDate()}</b><span>${MONTHS[dt.getMonth()]}</span></span>
                <span class="grow"><span class="strong small" style="display:block;line-height:1.35">${esc(o.title)}</span><span class="xs muted">${daysLeftText(o.daysLeft)} · ${esc(STATUS_LABEL[o.trackingStatus])}</span></span></a>`;
            }).join('') : '<p class="small muted" style="padding:8px 0">Save opportunities with ♡ to track their deadlines here.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="row between"><h3>🔔 Notifications ${d.unread ? `<span class="badge blue">${d.unread} new</span>` : ''}</h3><a href="/student/notifications.html" class="small">All →</a></div>
          <div style="margin-top:4px">${d.notifications.length ? d.notifications.map(notifItem).join('') : '<p class="small muted" style="padding:8px 0">No notifications yet.</p>'}</div>
        </div>

        <div class="card blue">
          <h3>Quick actions</h3>
          <div class="stack" style="margin-top:10px">
            <a class="btn primary block" href="/student/opportunities.html">${icon('compass')} Explore opportunities</a>
            <a class="btn outline block" href="/student/profile.html">${icon('user')} Edit my profile</a>
            <a class="btn outline block" href="/student/settings.html">${icon('bell')} Manage notifications</a>
          </div>
        </div>
      </aside>
    </div>`;

  bindOppCards($('#recGrid'));
  bindOppCards($('#newGrid'));
})();
