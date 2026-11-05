// =============================================================
// My calendar (UI spec §15): month view of deadlines and event dates
// for saved opportunities (plus top recommendations if toggled).
// =============================================================
(async function () {
  await studentPage('calendar');
  const page = $('#page');
  const [saved, recs] = await Promise.all([api('/api/saved'), api('/api/student/recommendations')]);
  let showRecs = false;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  function entries() {
    const list = [...saved.items];
    if (showRecs) recs.items.forEach((r) => { if (!list.some((s) => s.id === r.id)) list.push(r); });
    const out = [];
    list.forEach((o) => {
      if (o.deadline) out.push({ date: o.deadline, type: 'deadline', o });
      if (o.eventDate) out.push({ date: o.eventDate, type: 'event', o });
    });
    return out;
  }

  function draw() {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // weeks start on Monday
    const ev = entries();
    const todayKey = now.toDateString();
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const items = ev.filter((e) => e.date === key(d));
      cells += `<div class="day ${d.getMonth() !== month ? 'other' : ''} ${d.toDateString() === todayKey ? 'today' : ''}">
        <span class="n">${d.getDate()}</span>
        ${items.map((e) => `<a class="ev ${e.type}" href="/student/opportunity.html?id=${encodeURIComponent(e.o.id)}" title="${esc(e.o.title)}">${e.type === 'deadline' ? '⏳' : '📅'} ${esc(e.o.title)}</a>`).join('')}
      </div>`;
    }
    page.innerHTML = `
      <div class="page-head">
        <div><h1>My calendar</h1><p>Deadlines and event dates for opportunities you've saved.</p></div>
        <label class="check"><input type="checkbox" id="recToggle" ${showRecs ? 'checked' : ''}> Also show my recommendations</label>
      </div>
      <div class="row between" style="margin-bottom:14px">
        <button class="btn outline sm" id="prev" aria-label="Previous month">←</button>
        <h2>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <button class="btn outline sm" id="next" aria-label="Next month">→</button>
      </div>
      <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="legend" style="margin-top:12px"><span><i style="background:var(--tint-yellow)"></i>Registration deadline</span><span><i style="background:var(--tint-blue)"></i>Event date</span></div>`;
    $('#prev').onclick = () => { month--; if (month < 0) { month = 11; year--; } draw(); };
    $('#next').onclick = () => { month++; if (month > 11) { month = 0; year++; } draw(); };
    $('#recToggle').onchange = (e) => { showRecs = e.target.checked; draw(); };
  }
  draw();
})();
