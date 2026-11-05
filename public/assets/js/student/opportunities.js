// =============================================================
// Explore page (Student Portal §5): full catalogue + search,
// live suggestions, filters, sorting, and a "recommended" view.
// =============================================================
(async function () {
  const me = await studentPage('opportunities');
  const meta = await getMeta();
  const params = new URLSearchParams(location.search);
  const page = $('#page');

  page.innerHTML = `
    <div class="page-head">
      <div><h1>Explore opportunities</h1><p>Everything happening across campus — sorted by how well it fits you.</p></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab active" data-view="all" role="tab">All opportunities</button>
      <button class="tab" data-view="recommended" role="tab">✨ Recommended for me</button>
    </div>
    <div class="card flat" style="padding:14px">
      <form class="filters" id="filters" role="search">
        <div class="search-box" style="position:relative">
          ${icon('search', 18)}
          <input class="input" name="q" type="search" placeholder="Search by title, skill, organizer…" aria-label="Search" value="${esc(params.get('q') || '')}" autocomplete="off">
          <div class="suggest-list hidden" id="suggest"></div>
        </div>
        <select class="input" name="category" aria-label="Category"><option value="">All categories</option>${meta.categories.map((c) => `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
        <select class="input" name="level" aria-label="Experience level"><option value="">Any level</option>${['Beginner', 'Intermediate', 'Advanced'].map((l) => `<option>${l}</option>`).join('')}</select>
        <select class="input" name="programme" aria-label="Programme"><option value="">Any programme</option>${meta.programmes.map((p) => `<option>${esc(p.name)}</option>`).join('')}</select>
        <select class="input" name="skill" aria-label="Skill"><option value="">Any skill</option>${meta.skills.map((s) => `<option>${esc(s.name)}</option>`).join('')}</select>
        <select class="input" name="deadlineWithin" aria-label="Deadline"><option value="">Any deadline</option><option value="3">Within 3 days</option><option value="7">Within a week</option><option value="30">Within a month</option></select>
        <select class="input" name="status" aria-label="Status"><option value="open">Open now</option><option value="closing_soon">Closing soon</option><option value="closed">Closed</option><option value="all">All statuses</option></select>
        <select class="input" name="sort" aria-label="Sort"><option value="match">Best match</option><option value="deadline">Deadline (soonest)</option><option value="newest">Newest</option></select>
        <button type="button" class="link-btn" id="clearBtn">Clear</button>
      </form>
    </div>
    <p class="small muted" id="resultCount" style="margin:16px 2px"></p>
    <div class="grid cols-3" id="results"></div>`;

  const form = $('#filters');
  for (const [k, v] of params.entries()) if (form[k]) form[k].value = v;
  let view = params.get('view') === 'recommended' ? 'recommended' : 'all';
  const results = $('#results');
  bindOppCards(results);

  const setTab = () => $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));

  async function load() {
    results.innerHTML = skeletons(6, 320);
    const q = new URLSearchParams();
    for (const el of form.elements) if (el.name && el.value) q.set(el.name, el.value);
    history.replaceState(null, '', `?${q.toString()}${view === 'recommended' ? '&view=recommended' : ''}`);
    try {
      let items;
      if (view === 'recommended') {
        items = (await api('/api/student/recommendations')).items;
        const text = (form.q.value || '').toLowerCase();
        if (text) items = items.filter((o) => `${o.title} ${o.organizer} ${(o.requiredSkills || []).join(' ')}`.toLowerCase().includes(text));
        if (form.category.value) items = items.filter((o) => o.categories.includes(form.category.value));
      } else {
        items = (await api(`/api/opportunities?${q.toString()}`)).items;
      }
      $('#resultCount').textContent = `${items.length} ${items.length === 1 ? 'opportunity' : 'opportunities'}${view === 'recommended' ? ' recommended for you' : ''}`;
      results.innerHTML = items.length ? items.map((o) => oppCard(o)).join('')
        : `<div style="grid-column:1/-1" class="card">${emptyState('🔍', 'No opportunities match these filters', 'Try clearing some filters, or update your interests to discover more.', '<button class="btn primary" onclick="document.getElementById(\'clearBtn\').click()">Clear filters</button>')}</div>`;
    } catch (err) { results.innerHTML = `<div style="grid-column:1/-1">${errorState(err)}</div>`; }
  }

  // Live search suggestions (UI spec §6)
  let timer;
  form.q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const v = form.q.value.trim();
      const box = $('#suggest');
      if (v.length < 2) { box.classList.add('hidden'); load(); return; }
      const { items } = await api(`/api/opportunities/suggest?q=${encodeURIComponent(v)}`);
      box.innerHTML = items.map((i) => `<button type="button" data-id="${esc(i.id)}"><b>${esc(i.title)}</b><br><span class="xs muted">${esc(i.organizer)}</span></button>`).join('');
      box.classList.toggle('hidden', !items.length);
      load();
    }, 250);
  });
  form.q.addEventListener('blur', () => setTimeout(() => $('#suggest').classList.add('hidden'), 150));
  $('#suggest').addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) location.href = `/student/opportunity.html?id=${encodeURIComponent(b.dataset.id)}`;
  });

  form.addEventListener('change', load);
  form.addEventListener('submit', (e) => { e.preventDefault(); $('#suggest').classList.add('hidden'); load(); });
  $('#clearBtn').onclick = () => { form.reset(); form.q.value = ''; load(); };
  $$('.tab').forEach((t) => t.onclick = () => { view = t.dataset.view; setTab(); load(); });

  setTab();
  load();
})();
