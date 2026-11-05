// landing.js — public home page: categories + live stats.
(async function () {
  $('#heroSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    location.href = `/student/opportunities.html${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  });

  try {
    const data = await api('/api/meta/landing', { redirectOn401: false });
    $('#catGrid').innerHTML = data.categories.map((c) => `
      <a class="cat-card" href="/student/opportunities.html?category=${encodeURIComponent(c.id)}" style="background:${c.bg}">
        <span class="ico" aria-hidden="true">${c.icon}</span>
        <span><span class="t">${esc(c.name)}</span><br><span class="n">${c.count} open</span></span>
        <span class="arrow" style="color:${c.color}" aria-hidden="true">→</span>
      </a>`).join('');
    $('#statGrid').innerHTML = `
      <div class="stat"><div class="ico" style="background:var(--tint-blue)">📌</div><div class="label">Open opportunities</div><div class="value">${data.opportunities}</div></div>
      <div class="stat"><div class="ico" style="background:var(--tint-green)">🎓</div><div class="label">Students matched</div><div class="value">${data.students}</div></div>
      <div class="stat"><div class="ico" style="background:var(--tint-yellow)">🏛</div><div class="label">Clubs & departments</div><div class="value">${data.organizations}</div></div>`;
  } catch (err) {
    $('#catGrid').innerHTML = errorState(err);
  }
})();
