// =============================================================
// Student homepage (Student Portal §4). Organised around four questions:
//   1. What's relevant to me?        → Recommended for you
//   2. What's coming up?             → Coming up (deadlines + events)
//   3. What should I do next?        → Your next steps
//   4. What else is available?       → Beyond your programme, New on campus
// =============================================================
const NOTIF_ICON = { new_match: ['🎯', 'var(--tint-green)'], general: ['📢', 'var(--tint-blue)'], deadline: ['⏳', 'var(--tint-yellow)'], update: ['📝', 'var(--tint-blue)'] };

function notifItem(n) {
  const [ic, bg] = NOTIF_ICON[n.type] || ['🔔', 'var(--bg)'];
  const href = n.opportunityId ? `/student/opportunity.html?id=${encodeURIComponent(n.opportunityId)}` : '/student/notifications.html';
  return `<a class="notif-item ${n.read ? '' : 'unread'}" href="${href}"><span class="ic" style="background:${bg}">${ic}</span>
    <span class="grow"><span class="t">${esc(n.title)}</span><span class="m">${timeAgo(n.createdAt)}</span></span></a>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Merge saved-deadlines and upcoming events into one dated timeline. */
function timeline(d) {
  const items = [];
  d.upcomingDeadlines.forEach((o) => items.push({ date: o.deadline, kind: 'deadline', o, note: `${daysLeftText(o.daysLeft)} · ${STATUS_LABEL[o.trackingStatus]}` }));
  d.upcomingEvents.forEach((o) => items.push({ date: o.eventDate, kind: 'event', o, note: o.eventDaysLeft === 0 ? 'Happening today' : `In ${o.eventDaysLeft} day${o.eventDaysLeft === 1 ? '' : 's'} · ${o.location || 'Location TBA'}` }));
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
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
  const rec = d.recommended.slice(0, 3);
  const upcoming = timeline(d);
  const complete = d.completion.percent >= 100;

  page.innerHTML = `
    ${isWelcome ? `<div class="alert success" style="margin-bottom:20px">🎉 Welcome to OPPORA, ${esc(first)}! We've already matched your profile against every open opportunity.</div>` : ''}

    <!-- Welcome -->
    <section class="home-hero">
      <div class="home-hero__text">
        <p class="home-hero__hello">${greeting()}, ${esc(first)}</p>
        <h1>${d.stats.recommended ? `<em>${d.stats.recommended} opportunities</em> match your profile` : 'Let\'s find your first opportunity'}</h1>
        <p class="home-hero__sub">${esc(p.programme || 'Programme not set')} · Year ${esc(p.year || '?')} · ${esc(p.university || '')}</p>
        <div class="home-hero__actions">
          <a class="btn yellow" href="/student/opportunities.html?view=recommended">${icon('compass', 18)} See my matches</a>
          <a class="btn hero-ghost" href="/student/opportunities.html">Browse everything</a>
        </div>
      </div>
      <dl class="home-hero__stats">
        <div><dt>Strong matches</dt><dd>${d.stats.strong}</dd></div>
        <div><dt>Saved</dt><dd>${d.stats.saved}</dd></div>
        <div><dt>Closing soon</dt><dd>${d.stats.closingSoon}</dd></div>
      </dl>
    </section>

    <!-- 1. Relevant to me -->
    <section class="home-section">
      <header class="home-head">
        <div><h2>Recommended for you</h2><p>Ranked by your skills, interests, programme and experience.</p></div>
        ${d.stats.recommended > 3 ? `<a class="btn outline sm" href="/student/opportunities.html?view=recommended">See all ${d.stats.recommended} →</a>` : ''}
      </header>
      <div class="grid cols-3" id="recGrid">
        ${rec.length ? rec.map((o) => oppCard(o)).join('') : `<div style="grid-column:1/-1" class="card">${
          d.completion.percent < 40
            ? emptyState('🧭', 'Complete your profile to receive personalised recommendations', 'Add your skills and interests so OPPORA can find opportunities that fit you.', '<a class="btn primary" href="/student/profile.html">Complete my profile</a>')
            : emptyState('🔍', 'No matching opportunities yet', 'Explore all campus opportunities or update your interests to discover more.', '<a class="btn primary" href="/student/opportunities.html">Explore all opportunities</a>')}</div>`}
      </div>
    </section>

    <!-- 2. Coming up  +  3. Next steps -->
    <section class="home-section home-split">
      <div class="card home-panel">
        <header class="home-panel__head"><h3>${icon('calendar', 18)} Coming up</h3><a class="small" href="/student/calendar.html">Calendar →</a></header>
        ${upcoming.length ? `<ul class="timeline">${upcoming.map((t) => {
          const dt = parseDay(t.date);
          const urgent = t.kind === 'deadline' && t.o.daysLeft <= 3;
          return `<li><a href="/student/opportunity.html?id=${encodeURIComponent(t.o.id)}">
            <span class="date-box ${urgent ? 'urgent' : ''}"><b>${dt.getDate()}</b><span>${MONTHS[dt.getMonth()]}</span></span>
            <span class="grow"><span class="timeline__title">${esc(t.o.title)}</span><span class="timeline__note">${esc(t.note)}</span></span>
            <span class="tag tag--${t.kind}">${t.kind === 'deadline' ? 'Deadline' : 'Event'}</span></a></li>`;
        }).join('')}</ul>`
          : `<p class="home-empty">Nothing scheduled yet. Save an opportunity with ♡ and its deadline will show up here.</p>`}
      </div>

      <div class="card home-panel">
        <header class="home-panel__head"><h3>${icon('check', 18)} Your next steps</h3></header>
        <div class="step-row">
          <div class="ring" style="--p:${d.completion.percent}"><span>${d.completion.percent}%</span></div>
          <div class="grow">
            <b class="strong">${complete ? 'Profile complete' : 'Finish your profile'}</b>
            <p class="small muted">${complete ? 'Your matches are as accurate as they can be.' : `Add ${esc(d.completion.missing.slice(0, 2).join(' and ').toLowerCase())} for sharper matches.`}</p>
          </div>
          <a class="btn ${complete ? 'outline' : 'primary'} sm" href="/student/profile.html">${complete ? 'Edit' : 'Complete'}</a>
        </div>
        <div class="matching-on">
          <span class="label">Matching on</span>
          <div class="chips">${[...(p.interests || []).map((i) => `<span class="chip">${esc(i)}</span>`), ...(p.skills || []).slice(0, 4).map((s) => `<span class="chip blue">${esc(s.name)}</span>`)].join('') || '<span class="small muted">No skills or interests yet</span>'}</div>
        </div>
        <div class="home-panel__sub">
          <div class="row between"><b class="strong small">Notifications ${d.unread ? `<span class="badge blue">${d.unread} new</span>` : ''}</b><a class="small" href="/student/notifications.html">All →</a></div>
          ${d.notifications.length ? d.notifications.slice(0, 3).map(notifItem).join('') : '<p class="home-empty">No notifications yet.</p>'}
        </div>
        <div class="quick-links">
          <a href="/student/saved.html">${icon('bookmark', 16)} My saved (${d.savedCount})</a>
          <a href="/student/settings.html">${icon('bell', 16)} Alert settings</a>
        </div>
      </div>
    </section>

    <!-- 4a. Beyond your programme -->
    ${d.crossDisciplinary.length ? `
    <section class="home-section">
      <header class="home-head"><div><h2>Beyond your programme</h2><p>Not aimed at ${esc(p.programme)} students — but your skills say you'd do well.</p></div></header>
      <div class="mini-cards">
        ${d.crossDisciplinary.map((o) => `<a class="mini-card" href="/student/opportunity.html?id=${encodeURIComponent(o.id)}">
          ${coverHtml(o, { extraClass: 'thumb' })}
          <span class="grow"><span class="mini-card__title">${esc(o.title)}</span><span class="small muted">${esc(o.organizer)}</span></span>
          ${matchBadge(o.match, { long: false })}</a>`).join('')}
      </div>
    </section>` : ''}

    <!-- 4b. What else is available -->
    <section class="home-section">
      <header class="home-head">
        <div><h2>New on campus</h2><p>Published across APU in the last two weeks.</p></div>
        <a class="btn outline sm" href="/student/opportunities.html?sort=newest">Browse all →</a>
      </header>
      <div class="grid cols-3" id="newGrid">${d.newOpportunities.length ? d.newOpportunities.slice(0, 3).map((o) => oppCard(o, { showReason: false })).join('') : '<p class="muted">Nothing new in the last two weeks.</p>'}</div>
    </section>`;

  bindOppCards($('#recGrid'));
  bindOppCards($('#newGrid'));
})();
