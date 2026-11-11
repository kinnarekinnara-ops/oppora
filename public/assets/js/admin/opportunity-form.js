// =============================================================
// Create / edit opportunity (Admin Portal §4–5).
// Flow: write description → "Analyse with AI" → review suggestions
// (accept / remove / add) → confirm eligibility → publish → the
// matching engine runs and the result is shown immediately.
// =============================================================
(async function () {
  const editId = new URLSearchParams(location.search).get('id');
  const me = await adminPage(editId ? 'opportunities' : 'create', { title: editId ? 'Edit opportunity' : 'Create opportunity' });
  const meta = await getMeta();
  const page = $('#page');
  const isRep = me.user.role === 'org_rep';
  let opp = null;
  if (editId) {
    try { opp = (await api(`/api/admin/opportunities/${encodeURIComponent(editId)}`)).opportunity; }
    catch (err) { page.innerHTML = errorState(err); return; }
  }
  const v = (k, dflt = '') => (opp && opp[k] !== undefined && opp[k] !== null ? opp[k] : dflt);
  const isPublished = opp && opp.status === 'published';
  const programmeNames = meta.programmes.map((p) => p.name);
  const skillNames = meta.skills.map((s) => s.name);
  const myOrgId = me.user.organizationId;

  page.innerHTML = `
    <div class="page-head">
      <div><h1>${opp ? 'Edit opportunity' : isRep ? 'Submit an opportunity' : 'Create an opportunity'}</h1>
        <p>${opp ? `${statusPill(opp.status)} ${isPublished ? '· Saving will recalculate matches and notify students who saved it about important changes.' : ''}` : 'Describe it once — OPPORA finds the right students automatically.'}</p></div>
      ${!opp ? '<button type="button" class="btn outline" id="exampleBtn">✨ Fill with a demo example</button>' : ''}
    </div>
    ${opp && opp.rejectionReason && opp.status === 'draft' ? `<div class="alert error" style="margin-bottom:16px">Returned by an administrator: ${esc(opp.rejectionReason)}</div>` : ''}
    <div id="formAlert"></div>
    <form id="oppForm" novalidate>
      <div class="form-layout">
        <div>
          <section class="form-section">
            <h2><span class="num">1</span>Describe the opportunity</h2>
            <p class="sub">Write it the way you'd announce it. The AI reads this to suggest skills and categories.</p>
            <div class="field"><label for="title">Opportunity title *</label><input class="input" id="title" name="title" maxlength="150" value="${esc(v('title'))}"></div>
            <div class="field" style="margin-top:14px"><label for="description">Description *</label>
              <textarea class="input" id="description" name="description" rows="7" placeholder="What is it, who is it for, what will participants do, what do they need to know?">${esc(v('description'))}</textarea></div>
            <button type="button" class="btn primary" id="aiBtn" style="margin-top:14px">✨ Analyse with AI</button>
          </section>

          <section class="form-section">
            <h2><span class="num">2</span>Cover image</h2>
            <p class="sub">Shown on student cards and the event page. JPG, PNG or WEBP, up to 3 MB — a landscape (16:9) image works best.</p>
            <div class="uploader" id="uploader" data-field="imageUrl">
              <div class="uploader__preview" id="upPreview"></div>
              <div class="uploader__body">
                <p class="uploader__title" id="upTitle"></p>
                <p class="small muted" id="upStatus"></p>
                <div class="row wrap" style="margin-top:12px">
                  <button type="button" class="btn primary sm" id="upPick">${icon('plus', 16)} <span id="upPickLabel">Upload image</span></button>
                  <button type="button" class="btn danger sm" id="upRemove">Remove</button>
                </div>
                <p class="xs muted" style="margin-top:10px">…or drag & drop an image onto this box.</p>
                <p class="up-error" id="upError" role="alert"></p>
                <input type="file" id="upFile" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden>
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2><span class="num">3</span>Category & organizer</h2>
            <p class="sub">An opportunity can belong to more than one category.</p>
            <div class="field" data-field="categories"><span class="label">Categories *</span>
              <div class="toggle-group" id="catGroup">${meta.categories.map((c) => `<label><input type="checkbox" name="categories" value="${c.id}" ${v('categories', []).includes(c.id) ? 'checked' : ''}><span>${c.icon} ${esc(c.name)}</span></label>`).join('')}</div></div>
            <div class="form-grid" style="margin-top:16px">
              <div class="field"><label for="organizationId">Organizing department / club *</label>
                <select class="input" id="organizationId" name="organizationId" ${isRep ? 'disabled' : ''}>
                  <option value="">Choose…</option>${meta.organizations.map((o) => `<option value="${o.id}" ${(v('organizationId') || (isRep ? myOrgId : '')) === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
              <div class="field"><label for="experienceLevel">Experience level</label>
                <select class="input" id="experienceLevel" name="experienceLevel">${meta.experienceLevels.map((l) => `<option ${v('experienceLevel', 'Any') === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            </div>
          </section>

          <section class="form-section">
            <h2><span class="num">4</span>Skills & knowledge</h2>
            <p class="sub">Used for matching. Missing skills never disqualify students — only mandatory requirements (step 6) do.</p>
            <div class="field"><span class="label">Required / core skills</span><div id="reqSkills"></div></div>
            <div class="field" style="margin-top:14px"><span class="label">Preferred (nice-to-have) skills</span><div id="prefSkills"></div></div>
            <div class="form-grid" style="margin-top:14px">
              <div class="field"><span class="label">Relevant academic fields</span><div id="fields"></div><span class="hint">Helps rank relevance — not a restriction.</span></div>
              <div class="field"><span class="label">Knowledge areas</span><div id="areas"></div></div>
            </div>
          </section>

          <section class="form-section">
            <h2><span class="num">5</span>Dates & registration</h2>
            <p class="sub">Opportunities close automatically after the registration deadline.</p>
            <div class="form-grid">
              <div class="field"><label for="eventDate">Event / start date *</label><input class="input" type="date" id="eventDate" name="eventDate" value="${esc(v('eventDate'))}"></div>
              <div class="field"><label for="eventEndDate">End date <span class="muted">(optional)</span></label><input class="input" type="date" id="eventEndDate" name="eventEndDate" value="${esc(v('eventEndDate'))}"></div>
              <div class="field"><label for="deadline">Registration deadline *</label><input class="input" type="date" id="deadline" name="deadline" value="${esc(v('deadline'))}"></div>
              <div class="field"><label for="maxParticipants">Maximum participants</label><input class="input" type="number" min="0" id="maxParticipants" name="maxParticipants" value="${esc(v('maxParticipants', ''))}"></div>
              <div class="field full"><label for="registrationLink">Registration link</label><input class="input" type="url" id="registrationLink" name="registrationLink" placeholder="https://…" value="${esc(v('registrationLink'))}"></div>
              <div class="field full"><label for="applicationInstructions">Application instructions <span class="muted">(if no link)</span></label><input class="input" id="applicationInstructions" name="applicationInstructions" value="${esc(v('applicationInstructions'))}"></div>
              <div class="field"><label for="location">Location</label><input class="input" id="location" name="location" value="${esc(v('location'))}"></div>
              <div class="field"><label for="deliveryMode">Delivery</label><select class="input" id="deliveryMode" name="deliveryMode">${['In-person', 'Online', 'Hybrid'].map((m) => `<option ${v('deliveryMode', 'In-person') === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
            </div>
          </section>

          <section class="form-section">
            <h2><span class="num">6</span>Audience & eligibility</h2>
            <p class="sub">Target programmes guide recommendations. Only rules you mark as <b>mandatory</b> can exclude a student.</p>
            <label class="check"><input type="checkbox" name="openToAll" id="openToAll" ${v('openToAll', false) ? 'checked' : ''}> <span><b class="strong">Open to all students</b><br><span class="small muted">No programme targeting.</span></span></label>
            <div id="targetBox" style="margin-top:14px">
              <div class="field" data-field="targetProgrammes"><span class="label">Target programmes *</span><div id="targets"></div></div>
              <label class="check" style="margin-top:10px"><input type="checkbox" name="restrictToProgrammes" ${v('restrictToProgrammes', false) ? 'checked' : ''}> <span>Only these programmes may join <span class="badge red">Mandatory</span><br><span class="small muted">Leave unticked to let OPPORA recommend it to students from other programmes with relevant skills.</span></span></label>
            </div>
            <div class="form-grid" style="margin-top:16px">
              <div class="field"><span class="label">Eligible years <span class="muted">(none = all)</span></span><div class="toggle-group">${[1, 2, 3, 4, 5].map((y) => `<label><input type="checkbox" name="eligibleYears" value="${y}" ${v('eligibleYears', []).includes(y) ? 'checked' : ''}><span>Year ${y}</span></label>`).join('')}</div></div>
              <div class="field"><span class="label">Study levels <span class="muted">(none = all)</span></span><div class="toggle-group">${meta.studyLevels.map((l) => `<label><input type="checkbox" name="studyLevels" value="${l}" ${v('studyLevels', []).includes(l) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
            </div>
            <div class="field" style="margin-top:16px"><span class="label">Mandatory requirements</span>
              <div id="reqRows"></div>
              <button type="button" class="btn outline sm" id="addReq" style="margin-top:10px;align-self:flex-start">+ Add requirement</button>
              <span class="hint">"Skill" requirements are checked automatically against student profiles. "Other" conditions are shown for students to confirm themselves.</span></div>
          </section>

          <section class="form-section">
            <h2><span class="num">7</span>Supporting documents <span class="muted small">(optional)</span></h2>
            <p class="sub">Links to posters, rulebooks or briefs.</p>
            <div id="docRows"></div>
            <button type="button" class="btn outline sm" id="addDoc" style="margin-top:10px">+ Add document link</button>
          </section>

          <div class="sticky-actions">
            <a class="btn outline" href="/admin/opportunities.html">Cancel</a>
            ${!isPublished ? '<button type="button" class="btn outline" id="draftBtn">Save draft</button>' : ''}
            <button type="submit" class="btn green" id="publishBtn">${isPublished ? 'Save changes & re-match' : isRep ? 'Submit for approval →' : 'Review & publish →'}</button>
          </div>
        </div>

        <aside class="ai-panel" id="aiPanel" aria-live="polite">
          <h3>✨ AI suggestions</h3>
          <p class="small muted" style="margin-top:6px">Write a title and description, then click <b>Analyse with AI</b>. ${meta.aiEnabled ? 'Powered by Google Gemini.' : 'Using OPPORA\'s built-in keyword engine (add a Gemini key to .env for full AI).'}</p>
          <div id="aiBody"><div class="empty" style="padding:24px 8px"><div class="big">🤖</div><p class="small">Suggestions will appear here. You stay in control — nothing is applied until you accept it.</p></div></div>
        </aside>
      </div>
    </form>`;

  const form = $('#oppForm');
  const reqSkills = createTagInput($('#reqSkills'), { options: skillNames, values: v('requiredSkills', []), placeholder: 'e.g. Linux, Networking…' });
  const prefSkills = createTagInput($('#prefSkills'), { options: skillNames, values: v('preferredSkills', []), placeholder: 'e.g. Teamwork…' });
  const fields = createTagInput($('#fields'), { options: programmeNames, values: v('academicFields', []), allowCustom: false, placeholder: 'e.g. Cybersecurity' });
  const areas = createTagInput($('#areas'), { values: v('knowledgeAreas', []), placeholder: 'e.g. Server troubleshooting' });
  const targets = createTagInput($('#targets'), { options: programmeNames, values: v('targetProgrammes', []), allowCustom: false, placeholder: 'Choose programmes…' });

  // ---- Mandatory requirement rows ----
  const addReqRow = (r = { type: 'skill', value: '', minLevel: '' }) => {
    const row = document.createElement('div');
    row.className = 'req-row';
    row.innerHTML = `
      <select class="input" aria-label="Requirement type"><option value="skill" ${r.type === 'skill' ? 'selected' : ''}>Skill</option><option value="text" ${r.type === 'text' ? 'selected' : ''}>Other condition</option></select>
      <input class="input" list="skillList" placeholder="${r.type === 'skill' ? 'e.g. Python' : 'e.g. Available on 14 Nov'}" value="${esc(r.value)}" aria-label="Requirement">
      <select class="input" aria-label="Minimum level"><option value="">Any level</option>${meta.proficiency.map((l) => `<option value="${l}" ${r.minLevel === l ? 'selected' : ''}>${l}+</option>`).join('')}</select>
      <button type="button" class="btn danger sm" aria-label="Remove">×</button>`;
    const [typeSel, , lvl] = row.querySelectorAll('select, input');
    const sync = () => { lvl.style.visibility = typeSel.value === 'skill' ? 'visible' : 'hidden'; };
    typeSel.onchange = sync; sync();
    row.querySelector('button').onclick = () => row.remove();
    $('#reqRows').appendChild(row);
  };
  document.body.insertAdjacentHTML('beforeend', `<datalist id="skillList">${skillNames.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`);
  v('mandatoryRequirements', []).forEach(addReqRow);
  $('#addReq').onclick = () => addReqRow();

  // ---- Document rows ----
  const addDocRow = (a = { label: '', url: '' }) => {
    const row = document.createElement('div');
    row.className = 'row'; row.style.marginTop = '8px';
    row.innerHTML = `<input class="input" style="max-width:220px" placeholder="Label (e.g. Rulebook)" value="${esc(a.label)}"><input class="input grow" placeholder="https://…" value="${esc(a.url)}"><button type="button" class="btn danger sm">×</button>`;
    row.querySelector('button').onclick = () => row.remove();
    $('#docRows').appendChild(row);
  };
  v('attachments', []).forEach(addDocRow);
  $('#addDoc').onclick = () => addDocRow();

  // ---- Open-to-all toggles the targeting box ----
  const syncAudience = () => { $('#targetBox').style.display = $('#openToAll').checked ? 'none' : ''; };
  $('#openToAll').onchange = syncAudience; syncAudience();

  // ---- Demo example ----
  if ($('#exampleBtn')) $('#exampleBtn').onclick = () => {
    const d = new Date(); const fmt = (n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    form.title.value = 'Cloud & DevOps Weekend Bootcamp';
    form.description.value = 'A beginner-friendly two-day bootcamp where you will deploy a web application to the cloud. Learn Linux commands, Docker containers, basic networking and AWS fundamentals with mentors from the industry. Ideal for students curious about DevOps careers — no prior cloud experience needed, but some programming knowledge in Python or JavaScript helps.';
    form.eventDate.value = fmt(14); form.eventEndDate.value = fmt(15); form.deadline.value = fmt(10);
    form.registrationLink.value = 'https://forms.example.com/cloud-bootcamp';
    form.location.value = 'Innovation Hub'; form.maxParticipants.value = 50;
    if (!isRep) form.organizationId.value = 'org_fcs';
    toast('Example filled in — now click "Analyse with AI"');
    $('#aiBtn').focus();
  };

  // ================= Cover image upload =================
  const UP_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const UP_MAX = 3 * 1024 * 1024;
  let imageUrl = v('imageUrl', '');
  let localPreview = null; // shown instantly while the upload runs
  let uploading = false;

  function previewOpp() {
    const cats = $$('[name=categories]:checked', form).map((c) => c.value);
    return {
      imageUrl: localPreview || imageUrl,
      categories: cats.length ? cats : ['general'],
      categoryNames: cats.map((c) => (meta.categories.find((x) => x.id === c) || {}).name),
    };
  }
  function drawUploader(status) {
    $('#upPreview').innerHTML = coverHtml(previewOpp());
    const has = !!(localPreview || imageUrl);
    $('#upTitle').textContent = uploading ? 'Uploading…' : has ? 'Cover image ready' : 'No image yet';
    $('#upStatus').textContent = status || (has
      ? 'This image will appear on student cards and the event page.'
      : 'Students will see the default placeholder for this category (shown on the left).');
    $('#upPickLabel').textContent = has ? 'Replace image' : 'Upload image';
    $('#upRemove').hidden = !has || uploading;
    $('#upPick').disabled = uploading;
    $('#uploader').classList.toggle('has-image', has);
  }
  function upError(msg) {
    $('#upError').textContent = msg || '';
    $('#uploader').classList.toggle('invalid', !!msg);
  }
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Could not read that file.')); r.readAsDataURL(file); });
  }
  async function handleFile(file) {
    upError('');
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!UP_TYPES.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { upError('Please choose a JPG, PNG or WEBP image.'); return; }
    if (file.size > UP_MAX) { upError(`That image is ${(file.size / 1048576).toFixed(1)} MB. Please use one under 3 MB.`); return; }
    try {
      const dataUrl = await readAsDataUrl(file);
      localPreview = dataUrl; uploading = true; drawUploader();
      const res = await api('/api/admin/uploads', { method: 'POST', body: { dataUrl, filename: file.name } });
      imageUrl = res.url; localPreview = null; uploading = false;
      drawUploader(`Uploaded ${file.name} (${Math.round(res.size / 1024)} KB). It's saved with the opportunity when you save or publish.`);
    } catch (err) {
      localPreview = null; uploading = false; drawUploader(); upError(err.message);
    }
  }
  $('#upPick').onclick = () => $('#upFile').click();
  $('#upFile').onchange = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };
  $('#upRemove').onclick = () => { imageUrl = ''; localPreview = null; upError(''); drawUploader('Image removed — the default placeholder will be shown. Save to apply.'); };
  const up = $('#uploader');
  ['dragenter', 'dragover'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.remove('drag'); }));
  up.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
  $('#catGroup').addEventListener('change', () => drawUploader());
  drawUploader();

  // ================= AI suggestions =================
  let aiState = null; // { source, suggestions }
  $('#aiBtn').onclick = async () => {
    const btn = $('#aiBtn');
    btn.disabled = true; btn.textContent = '✨ Analysing…';
    $('#aiBody').innerHTML = `<div class="skeleton" style="height:60px;margin-top:12px"></div><div class="skeleton" style="height:90px;margin-top:10px"></div><div class="skeleton" style="height:60px;margin-top:10px"></div>`;
    try {
      const r = await api('/api/ai/extract', { method: 'POST', body: { title: form.title.value, description: form.description.value } });
      if (!r.ok) { $('#aiBody').innerHTML = `<div class="alert warn" style="margin-top:12px">${esc(r.error)}</div>`; return; }
      aiState = r;
      drawAi();
    } catch (err) {
      // Admin §5.5: AI failure never blocks publishing
      $('#aiBody').innerHTML = `<div class="alert error" style="margin-top:12px">AI is unavailable: ${esc(err.message)}. You can still fill in the fields manually — your form data is safe.</div>`;
    } finally { btn.disabled = false; btn.textContent = '✨ Analyse again'; }
  };

  function drawAi() {
    const s = aiState.suggestions;
    const catName = (id) => (meta.categories.find((c) => c.id === id) || {}).name || id;
    const has = (list, x) => list.get().some((t) => t.toLowerCase() === x.toLowerCase());
    const chipList = (items, target, kind) => items.length ? items.map((x) => {
      const added = target ? has(target, x) : (kind === 'cat' ? $(`[name=categories][value="${x}"]`).checked : form.experienceLevel.value === x);
      return `<span class="ai-chip ${added ? 'added' : ''}">${esc(kind === 'cat' ? catName(x) : x)}<button type="button" data-kind="${kind}" data-val="${esc(x)}" aria-label="${added ? 'Remove' : 'Add'} ${esc(x)}">${added ? '✓' : '+'}</button></span>`;
    }).join('') : '<span class="xs muted">None found</span>';

    $('#aiBody').innerHTML = `
      <div class="row between" style="margin-top:12px"><span class="badge ${aiState.source === 'gemini' ? 'green' : 'blue'}">${aiState.source === 'gemini' ? '🤖 Google Gemini' : '⚙️ Keyword engine'}</span>
        <button type="button" class="btn green sm" id="acceptAll">Accept all</button></div>
      ${aiState.warning ? `<div class="alert warn small" style="margin-top:10px">${esc(aiState.warning)}</div>` : ''}
      <div class="ai-suggestion"><div class="k">Category</div>${chipList(s.categories, null, 'cat')}</div>
      <div class="ai-suggestion"><div class="k">Technical skills → required</div>${chipList(s.requiredSkills, reqSkills, 'req')}</div>
      <div class="ai-suggestion"><div class="k">Soft skills → preferred</div>${chipList(s.softSkills, prefSkills, 'pref')}</div>
      <div class="ai-suggestion"><div class="k">Experience level</div>${chipList([s.experienceLevel], null, 'level')}</div>
      <div class="ai-suggestion"><div class="k">Academic fields</div>${chipList(s.academicFields, fields, 'field')}</div>
      <div class="ai-suggestion"><div class="k">Knowledge areas</div>${chipList(s.knowledgeAreas, areas, 'area')}</div>
      ${s.audienceHint ? `<div class="ai-suggestion"><div class="k">Audience hint</div><p class="small">${esc(s.audienceHint)}</p><p class="xs muted" style="margin-top:4px">Set eligibility yourself in step 6 — AI never decides eligibility.</p></div>` : ''}
      <p class="xs muted" style="margin-top:12px">AI suggestions may be wrong. Review everything before publishing.</p>`;

    $('#acceptAll').onclick = () => {
      s.categories.forEach((c) => { $(`[name=categories][value="${c}"]`).checked = true; });
      s.requiredSkills.forEach((x) => reqSkills.add(x));
      s.softSkills.forEach((x) => prefSkills.add(x));
      s.academicFields.forEach((x) => fields.add(x));
      s.knowledgeAreas.forEach((x) => areas.add(x));
      form.experienceLevel.value = s.experienceLevel;
      toast('All suggestions applied — please review them', 'success');
      drawAi();
    };
    $$('[data-kind]', $('#aiBody')).forEach((b) => b.onclick = () => {
      const { kind, val } = b.dataset;
      const map = { req: reqSkills, pref: prefSkills, field: fields, area: areas };
      if (kind === 'cat') { const c = $(`[name=categories][value="${val}"]`); c.checked = !c.checked; }
      else if (kind === 'level') form.experienceLevel.value = val;
      else {
        const list = map[kind];
        const i = list.get().findIndex((t) => t.toLowerCase() === val.toLowerCase());
        if (i >= 0) list.remove(i); else list.add(val);
      }
      drawAi();
    });
  }

  // ================= Collect + submit =================
  function collect() {
    return {
      title: form.title.value, description: form.description.value,
      categories: $$('[name=categories]:checked', form).map((c) => c.value),
      organizationId: isRep ? myOrgId : form.organizationId.value,
      experienceLevel: form.experienceLevel.value,
      requiredSkills: reqSkills.get(), preferredSkills: prefSkills.get(), academicFields: fields.get(), knowledgeAreas: areas.get(),
      eventDate: form.eventDate.value, eventEndDate: form.eventEndDate.value, deadline: form.deadline.value,
      registrationLink: form.registrationLink.value, applicationInstructions: form.applicationInstructions.value,
      location: form.location.value, deliveryMode: form.deliveryMode.value, maxParticipants: form.maxParticipants.value,
      openToAll: $('#openToAll').checked, targetProgrammes: targets.get(), restrictToProgrammes: form.restrictToProgrammes.checked,
      eligibleYears: $$('[name=eligibleYears]:checked', form).map((c) => Number(c.value)),
      studyLevels: $$('[name=studyLevels]:checked', form).map((c) => c.value),
      mandatoryRequirements: $$('.req-row', form).map((r) => {
        const [type, value, minLevel] = [...r.querySelectorAll('select, input')].map((x) => x.value);
        return { type, value, minLevel: type === 'skill' ? minLevel : '' };
      }).filter((r) => r.value.trim()),
      imageUrl,
      attachments: $$('#docRows .row').map((r) => { const [label, url] = $$('input', r).map((i) => i.value.trim()); return { label, url }; }).filter((a) => a.url),
      aiAssisted: !!aiState || v('aiAssisted', false),
      aiSource: aiState ? aiState.source : v('aiSource', null),
    };
  }

  async function save(action) {
    if (uploading) throw new Error('Please wait for the image to finish uploading.');
    const body = { ...collect(), action };
    $('#formAlert').innerHTML = '';
    showFieldErrors(form, null);
    const url = opp ? `/api/admin/opportunities/${encodeURIComponent(opp.id)}` : '/api/admin/opportunities';
    const res = await api(url, { method: opp ? 'PUT' : 'POST', body });
    return res;
  }

  // Review step: admin must explicitly confirm eligibility rules (Matching §3.3)
  function reviewModal(data) {
    return new Promise((resolve) => {
      const cats = data.categories.map((c) => (meta.categories.find((x) => x.id === c) || {}).name).join(', ');
      const m = openModal(`
        <div class="modal-head"><h2>Review before ${isRep ? 'submitting' : 'publishing'}</h2><button class="btn ghost sm" data-close aria-label="Close">✕</button></div>
        <dl class="kv">
          <dt>Title</dt><dd>${esc(data.title)}</dd>
          <dt>Category</dt><dd>${esc(cats || '—')}</dd>
          <dt>Dates</dt><dd>Event ${fmtDate(data.eventDate)} · Deadline ${fmtDate(data.deadline)}</dd>
          <dt>Skills</dt><dd>${esc(data.requiredSkills.join(', ') || '—')}</dd>
          <dt>Audience</dt><dd>${data.openToAll ? 'All students' : esc(data.targetProgrammes.join(', ') || '—')}${data.restrictToProgrammes ? ' <b>(restricted)</b>' : ''}</dd>
          <dt>Mandatory rules</dt><dd>${[
            data.restrictToProgrammes ? 'Programme restriction' : '',
            data.eligibleYears.length ? `Year ${data.eligibleYears.join(', ')}` : '',
            data.studyLevels.length ? data.studyLevels.join('/') : '',
            ...data.mandatoryRequirements.map((r) => r.value),
          ].filter(Boolean).map(esc).join('<br>') || 'None — open to everyone matching the audience'}</dd>
        </dl>
        <label class="check" style="margin-top:18px"><input type="checkbox" id="confirmElig"> <span>I confirm the eligibility requirements above are correct${data.aiAssisted ? ' and I have reviewed the AI suggestions' : ''}.</span></label>
        <div class="modal-foot"><button class="btn outline" data-close>Back to editing</button><button class="btn green" id="goBtn" disabled>${isRep ? 'Submit for approval' : 'Publish & match students'}</button></div>`);
      const cb = m.el.querySelector('#confirmElig');
      cb.onchange = () => { m.el.querySelector('#goBtn').disabled = !cb.checked; };
      m.el.querySelector('#goBtn').onclick = () => { m.close(); resolve(true); };
      m.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
    });
  }

  function resultModal(res) {
    const s = res.matchStats;
    const m = openModal(`
      <div class="publish-result">
        <div class="big">🎉</div>
        <h2>${esc(res.message)}</h2>
        ${s ? `<p class="muted" style="margin-top:6px">The matching engine evaluated <b>${s.evaluated}</b> student profiles.</p>
        <div class="nums">
          <div><b>${s.recommended}</b><span class="small muted">students matched</span></div>
          <div><b>${s.notified}</b><span class="small muted">notified</span></div>
          <div><b>${s.crossDisciplinary}</b><span class="small muted">beyond target programmes</span></div>
        </div>
        ${s.notEligible ? `<p class="small muted" style="margin-top:12px">${s.notEligible} students were excluded by your mandatory requirements.</p>` : ''}` : ''}
        <div class="modal-foot" style="justify-content:center">
          <a class="btn outline" href="/admin/opportunities.html">Back to list</a>
          ${s ? `<a class="btn primary" href="/admin/matching.html?id=${encodeURIComponent(res.opportunity.id)}">See who matched →</a>` : ''}
        </div>
      </div>`);
    return m;
  }

  if ($('#draftBtn')) $('#draftBtn').onclick = async () => {
    try {
      const res = await save('draft');
      toast(res.message, 'success');
      if (!opp) location.href = `/admin/opportunity-form.html?id=${encodeURIComponent(res.opportunity.id)}`;
    } catch (err) { handleErr(err); }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collect();
    if (!isPublished && !(await reviewModal(data))) return;
    const btn = $('#publishBtn');
    btn.disabled = true; btn.textContent = 'Working…';
    try {
      const res = await save('publish');
      if (res.matchStats) resultModal(res);
      else { toast(res.message, 'success'); setTimeout(() => { location.href = isRep ? '/admin/approvals.html' : '/admin/opportunities.html'; }, 900); }
      opp = res.opportunity;
    } catch (err) { handleErr(err); }
    finally { btn.disabled = false; btn.textContent = isPublished ? 'Save changes & re-match' : isRep ? 'Submit for approval →' : 'Review & publish →'; }
  });

  function handleErr(err) {
    $('#formAlert').innerHTML = `<div class="alert error" style="margin-bottom:16px">${esc(err.message)}</div>`;
    showFieldErrors(form, err.fields);
    if (!err.fields) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
