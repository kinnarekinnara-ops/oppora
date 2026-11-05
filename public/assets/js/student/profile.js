// =============================================================
// Student profile (Student Portal §3): academic background, skills
// with proficiency, interests, experience, goals. Saving re-runs the
// matching engine and reports any NEW matches.
// =============================================================
(async function () {
  await studentPage('profile');
  const page = $('#page');
  const [meta, d] = await Promise.all([getMeta(), api('/api/student/profile')]);
  const p = d.profile;

  page.innerHTML = `
    <div class="page-head">
      <div><h1>My profile</h1><p>The more OPPORA knows, the better your matches. Only you and authorised staff can see this.</p></div>
      <div class="card green row" style="padding:12px 18px;gap:14px">
        <div class="ring" id="ring" style="--p:${d.completion.percent}"><span>${d.completion.percent}%</span></div>
        <div class="small"><b class="strong">Profile completion</b><div class="muted" id="missing">${d.completion.missing.length ? `Missing: ${esc(d.completion.missing.slice(0, 3).join(', '))}` : 'Complete!'}</div></div>
      </div>
    </div>
    <div id="formAlert"></div>
    <form id="profileForm" class="stack" novalidate>
      <div class="card">
        <h2>🎓 Academic background</h2>
        <div class="form-grid" style="margin-top:16px">
          <div class="field"><label>Name</label><input class="input" value="${esc(d.user.name)}" disabled><span class="hint">Change your name in <a href="/student/settings.html">Settings</a>.</span></div>
          <div class="field"><label>Email</label><input class="input" value="${esc(d.user.email)}" disabled><span class="hint">Verified email can't be changed here.</span></div>
          <div class="field"><label for="university">University</label><input class="input" id="university" name="university" value="${esc(p.university || '')}"></div>
          <div class="field"><label for="programme">Academic programme</label><select class="input" id="programme" name="programme">${meta.programmes.map((x) => `<option ${x.name === p.programme ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="faculty">Faculty</label><input class="input" id="faculty" name="faculty" value="${esc(p.faculty || '')}"></div>
          <div class="field"><label for="year">Year of study</label><select class="input" id="year" name="year">${[1, 2, 3, 4, 5].map((y) => `<option value="${y}" ${Number(p.year) === y ? 'selected' : ''}>Year ${y}${y === 5 ? '+' : ''}</option>`).join('')}</select></div>
          <div class="field"><label for="studyLevel">Study level</label><select class="input" id="studyLevel" name="studyLevel">${meta.studyLevels.map((l) => `<option ${l === p.studyLevel ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
      </div>

      <div class="card">
        <h2>🛠 Skills</h2>
        <p class="small muted" style="margin-top:4px">Technical and non-technical. Click the level on a skill to change it — beginners are welcome on many opportunities!</p>
        <div id="skillsInput" style="margin-top:14px"></div>
      </div>

      <div class="card">
        <h2>💚 Interests</h2>
        <p class="small muted" style="margin-top:4px">Interests help us find opportunities that fit your goals, even before you have every skill.</p>
        <div class="interest-grid" style="margin-top:14px">${meta.interests.map((i) => `<label><input type="checkbox" name="interests" value="${esc(i)}" ${(p.interests || []).includes(i) ? 'checked' : ''}>${esc(i)}</label>`).join('')}</div>
      </div>

      <div class="card">
        <h2>🏆 Experience & achievements</h2>
        <p class="small muted" style="margin-top:4px">Hackathons, competitions, projects, research, internships, clubs, volunteering…</p>
        <div id="expList" class="stack" style="margin-top:14px"></div>
        <button type="button" class="btn outline sm" id="addExp" style="margin-top:12px">+ Add experience</button>
        <div class="field" style="margin-top:20px"><label>Certifications</label><div id="certInput"></div></div>
      </div>

      <div class="card">
        <h2>🚀 Career goals</h2>
        <textarea class="input" name="careerGoals" rows="3" style="margin-top:14px" placeholder="What do you want to achieve?">${esc(p.careerGoals || '')}</textarea>
      </div>

      <div class="sticky-actions" style="position:sticky;bottom:0;background:rgba(246,249,253,.95);padding:14px 0;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border)">
        <a class="btn outline" href="/student/dashboard.html">Cancel</a>
        <button class="btn green" type="submit">Save & update my matches</button>
      </div>
    </form>`;

  const skills = createSkillInput($('#skillsInput'), meta.skills.map((s) => s.name), p.skills || []);
  const exp = createExperienceEditor($('#expList'), $('#addExp'), p.experience || []);
  const certs = createTagInput($('#certInput'), { values: p.certifications || [], placeholder: 'e.g. AWS Cloud Practitioner — press Enter' });
  const form = $('#profileForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving & re-matching…';
    try {
      const res = await api('/api/student/profile', {
        method: 'PUT',
        body: {
          university: form.university.value, programme: form.programme.value, faculty: form.faculty.value,
          year: form.year.value, studyLevel: form.studyLevel.value, skills: skills.get(),
          interests: $$('[name=interests]:checked', form).map((i) => i.value),
          experience: exp.get(), certifications: certs.get(), careerGoals: form.careerGoals.value,
        },
      });
      $('#ring').style.setProperty('--p', res.completion.percent);
      $('#ring span').textContent = `${res.completion.percent}%`;
      $('#missing').textContent = res.completion.missing.length ? `Missing: ${res.completion.missing.slice(0, 3).join(', ')}` : 'Complete!';
      const r = res.matchResult;
      $('#formAlert').innerHTML = `<div class="alert success" style="margin-bottom:16px">✓ Profile saved. You now have <b>${r.recommended}</b> recommended opportunities${r.newMatches ? ` — including <b>${r.newMatches} new match${r.newMatches > 1 ? 'es' : ''}</b>! <a href="/student/notifications.html">See them →</a>` : '.'}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Profile saved — matches updated', 'success');
    } catch (err) {
      showFieldErrors(form, err.fields);
      $('#formAlert').innerHTML = `<div class="alert error" style="margin-bottom:16px">${esc(err.message)}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Save & update my matches'; }
  });
})();
