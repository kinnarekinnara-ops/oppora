// =============================================================
// auth.js — login form + 4-step student registration.
// =============================================================

function initLogin() {
  const form = $('#loginForm');
  const ticket = $('#ticket');
  const btn = form.querySelector('[type=submit]');
  const label = btn.querySelector('.label');

  // If already logged in, skip straight to the right portal
  api('/api/auth/me', { redirectOn401: false })
    .then((me) => { location.href = me.user.role === 'student' ? '/student/dashboard.html' : '/admin/dashboard.html'; })
    .catch(() => {});

  // Demo stickers: fill the form with a little "stamp"
  $$('.demo-logins [data-e]').forEach((b) => b.addEventListener('click', () => {
    form.email.value = b.dataset.e;
    form.password.value = b.dataset.p;
    $$('.sticker.picked').forEach((s) => s.classList.remove('picked'));
    b.classList.add('picked');
    btn.focus();
  }));

  // Show / hide password
  $('#peek').addEventListener('click', (e) => {
    const show = form.password.type === 'password';
    form.password.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'hide' : 'show';
    e.currentTarget.setAttribute('aria-pressed', String(show));
    e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  const fail = (msg) => {
    $('#formAlert').innerHTML = `<div class="t-alert">😬 ${esc(msg)}</div>`;
    ticket.classList.remove('shake'); void ticket.offsetWidth; ticket.classList.add('shake');
    btn.disabled = false; btn.classList.remove('is-loading'); label.textContent = 'Take off';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#formAlert').innerHTML = '';
    if (!form.email.value.trim() || !form.password.value) { fail('Pop in your email and password first.'); return; }
    btn.disabled = true; btn.classList.add('is-loading'); label.textContent = 'Fuelling up…';
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { email: form.email.value, password: form.password.value }, redirectOn401: false });
      const next = new URLSearchParams(location.search).get('next');
      const allowed = next && next.startsWith('/') && !next.startsWith('//')
        && (res.user.role === 'student' ? next.startsWith('/student/') : next.startsWith('/admin/'));
      label.textContent = 'Lift-off!';
      // The fun part: 3D launch + hyperspace into the next page
      OpporaTransition.leave(allowed ? next : res.redirect, { sky: window.__sky, card: ticket });
    } catch (err) {
      fail(err.message);
    }
  });
}

async function initRegister() {
  const form = $('#regForm');
  const STEPS = ['Account', 'Academic profile', 'Skills & interests', 'Goals'];
  const TITLES = ['Create your account', 'Your academic background', 'What you know & love', 'Where you\'re heading'];
  let step = 1;

  const meta = await getMeta();
  form.programme.innerHTML = '<option value="">Choose your programme…</option>' + meta.programmes.map((p) => `<option>${esc(p.name)}</option>`).join('');
  form.studyLevel.innerHTML = meta.studyLevels.map((l) => `<option ${l === 'Undergraduate' ? 'selected' : ''}>${esc(l)}</option>`).join('');
  $('#interestGrid').innerHTML = meta.interests.map((i) => `<label><input type="checkbox" name="interests" value="${esc(i)}">${esc(i)}</label>`).join('');
  const skills = createSkillInput($('#skillsInput'), meta.skills.map((s) => s.name));
  const exp = createExperienceEditor($('#expList'), $('#addExp'));

  const SHORT = ['Account', 'Studies', 'Skills', 'Goals'];
  const label = () => $('#nextBtn .label');
  const draw = () => {
    $$('[data-step]', form).forEach((s) => s.classList.toggle('hidden', Number(s.dataset.step) !== step));
    // Stepper drawn as a little flight path: stops joined by dashed lines
    $('#stepper').innerHTML = SHORT.map((s, i) => `${i ? '<span class="path"></span>' : ''}
      <span class="stop ${i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}"><span class="dot">${i + 1 < step ? '✓' : i + 1}</span><span class="lbl">${s}</span></span>`).join('');
    $('#stepTitle').textContent = TITLES[step - 1];
    $('#stepCount').textContent = `Step ${step} of 4`;
    $('#backBtn').style.visibility = step === 1 ? 'hidden' : 'visible';
    label().textContent = step === 4 ? 'Launch my matches' : 'Next stop';
    $('#nextBtn .rocket').textContent = step === 4 ? '🚀' : '✈️';
    $('#formAlert').innerHTML = '';
    const first = $(`[data-step="${step}"] input, [data-step="${step}"] select`, form);
    if (first) first.focus({ preventScroll: true });
  };

  // Client-side checks per step (the server validates again)
  const validateStep = () => {
    const errors = {};
    if (step === 1) {
      if (form.name.value.trim().length < 2) errors.name = 'Please enter your full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) errors.email = 'Please enter a valid email.';
      if (form.password.value.length < 6) errors.password = 'At least 6 characters.';
      if (!form.university.value.trim()) errors.university = 'Required.';
    }
    if (step === 2 && !form.programme.value) errors.programme = 'Please choose your programme.';
    if (step === 3) {
      if (!skills.get().length) errors.skills = 'Add at least one skill — even a beginner one counts!';
      if (!$$('[name=interests]:checked', form).length) errors.interests = 'Pick at least one interest.';
    }
    showFieldErrors(form, Object.keys(errors).length ? errors : null);
    if (Object.keys(errors).length) { const t = $('#ticket'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
    return !Object.keys(errors).length;
  };

  $('#backBtn').onclick = () => { if (step > 1) { step--; draw(); } };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (step < 4) { step++; draw(); return; }

    const btn = $('#nextBtn');
    btn.disabled = true; btn.classList.add('is-loading'); label().textContent = 'Matching you…';
    try {
      const body = {
        name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value, university: form.university.value.trim(),
        programme: form.programme.value, year: form.year.value, studyLevel: form.studyLevel.value,
        skills: skills.get(), interests: $$('[name=interests]:checked', form).map((i) => i.value),
        careerGoals: form.careerGoals.value, experience: exp.get(),
      };
      const res = await api('/api/auth/register', { method: 'POST', body, redirectOn401: false });
      label().textContent = 'Lift-off!';
      OpporaTransition.leave(`${res.redirect}?welcome=1`, { sky: window.__sky, card: $('#ticket') });
    } catch (err) {
      btn.disabled = false; btn.classList.remove('is-loading'); label().textContent = 'Launch my matches';
      if (err.fields) {
        // Jump back to the step that has the problem
        step = err.fields.name || err.fields.email || err.fields.password || err.fields.university ? 1 : step;
        draw();
        showFieldErrors(form, err.fields);
      }
      $('#formAlert').innerHTML = `<div class="t-alert">😬 ${esc(err.message)}</div>`;
    }
  });

  draw();
}
