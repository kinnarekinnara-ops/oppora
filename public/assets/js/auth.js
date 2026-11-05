// =============================================================
// auth.js — login form + 4-step student registration.
// =============================================================

function initLogin() {
  const form = $('#loginForm');
  // If already logged in, skip straight to the right portal
  api('/api/auth/me', { redirectOn401: false })
    .then((me) => { location.href = me.user.role === 'student' ? '/student/dashboard.html' : '/admin/dashboard.html'; })
    .catch(() => {});

  $$('.demo-logins [data-e]').forEach((b) => b.addEventListener('click', () => {
    form.email.value = b.dataset.e;
    form.password.value = b.dataset.p;
    form.querySelector('[type=submit]').focus();
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Logging in…';
    $('#formAlert').innerHTML = '';
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { email: form.email.value, password: form.password.value }, redirectOn401: false });
      const next = new URLSearchParams(location.search).get('next');
      const allowed = next && next.startsWith('/') && !next.startsWith('//')
        && (res.user.role === 'student' ? next.startsWith('/student/') : next.startsWith('/admin/'));
      location.href = allowed ? next : res.redirect;
    } catch (err) {
      $('#formAlert').innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Log in';
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

  const draw = () => {
    $$('[data-step]', form).forEach((s) => s.classList.toggle('hidden', Number(s.dataset.step) !== step));
    $('#stepper').innerHTML = STEPS.map((s, i) => `<div class="st ${i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''}"><div class="bar"></div><div class="lbl">${i + 1}. ${s}</div></div>`).join('');
    $('#stepTitle').textContent = TITLES[step - 1];
    $('#backBtn').style.visibility = step === 1 ? 'hidden' : 'visible';
    $('#nextBtn').textContent = step === 4 ? 'Create account & find matches ✨' : 'Continue →';
    $('#formAlert').innerHTML = '';
    const first = $(`[data-step="${step}"] input, [data-step="${step}"] select`, form);
    if (first) first.focus();
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
    return !Object.keys(errors).length;
  };

  $('#backBtn').onclick = () => { if (step > 1) { step--; draw(); } };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (step < 4) { step++; draw(); return; }

    const btn = $('#nextBtn');
    btn.disabled = true; btn.textContent = 'Finding your matches…';
    try {
      const body = {
        name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value, university: form.university.value.trim(),
        programme: form.programme.value, year: form.year.value, studyLevel: form.studyLevel.value,
        skills: skills.get(), interests: $$('[name=interests]:checked', form).map((i) => i.value),
        careerGoals: form.careerGoals.value, experience: exp.get(),
      };
      const res = await api('/api/auth/register', { method: 'POST', body, redirectOn401: false });
      location.href = `${res.redirect}?welcome=1`;
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Create account & find matches ✨';
      if (err.fields) {
        // Jump back to the step that has the problem
        step = err.fields.name || err.fields.email || err.fields.password || err.fields.university ? 1 : step;
        draw();
        showFieldErrors(form, err.fields);
      }
      $('#formAlert').innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
    }
  });

  draw();
}
