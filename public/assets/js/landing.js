// landing.js — public home page: drone-show hero, category bento, live stats.
(async function () {
  // Drones in the open sky: top-right on desktop, above the headline on phones
  OpporaSky.mount($('#sky'), {
    shapes: ['logo', 'OPPORA', 'APU', 'rocket', 'star'],
    area: (w, h) => w > 1100
      ? { x: w * 0.55, y: h * 0.13, w: w * 0.4, h: h * 0.4 }
      : { x: w * 0.06, y: 86, w: w * 0.88, h: Math.min(200, h * 0.24) },
  });


  try {
    const data = await api('/api/meta/landing', { redirectOn401: false });
    $('#catGrid').innerHTML = data.categories.map((c) => {
      const st = catStyle(c.id);
      return `
      <a class="cat-card ${st.dark ? 'dark' : 'light'}" href="/student/opportunities.html?category=${encodeURIComponent(c.id)}" style="background-color:${st.color}">
        <span class="ico" aria-hidden="true">${c.icon}</span>
        <span><span class="t">${esc(c.name)}</span><span class="n">${c.count} open now</span></span>
        <span class="arrow" aria-hidden="true">→</span>
      </a>`;
    }).join('');
    $('#statGrid').innerHTML = `
      <div class="sticker-stat"><b>${data.opportunities}</b><span>opportunities open</span></div>
      <div class="sticker-stat"><b>${data.students}</b><span>students matched</span></div>
      <div class="sticker-stat"><b>${data.organizations}</b><span>clubs & departments</span></div>`;
  } catch (err) {
    $('#catGrid').innerHTML = errorState(err);
  }
})();
