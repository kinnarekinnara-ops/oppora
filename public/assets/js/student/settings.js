// =============================================================
// Settings (Student Portal §2.4, §10.4): name, password,
// notification preferences, account deletion request.
// =============================================================
(async function () {
  await studentPage('');
  const page = $('#page');
  const d = await api('/api/student/profile');
  const prefs = d.profile.notificationPrefs || {};
  const pref = (key, title, desc) => `
    <label class="row between" style="padding:14px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <span><b class="strong">${title}</b><br><span class="small muted">${desc}</span></span>
      <span class="switch"><input type="checkbox" name="${key}" ${prefs[key] !== false ? 'checked' : ''}><span></span></span>
    </label>`;

  page.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>Manage your account and how OPPORA contacts you.</p></div></div>
    <div class="grid cols-2" style="align-items:start">
      <div class="stack">
        <form class="card" id="accountForm">
          <h2>Account</h2>
          <div class="field" style="margin-top:14px"><label for="name">Display name</label><input class="input" id="name" name="name" value="${esc(d.user.name)}"></div>
          <div class="field" style="margin-top:12px"><label>Email</label><input class="input" value="${esc(d.user.email)}" disabled></div>
          <button class="btn primary" style="margin-top:16px">Save name</button>
        </form>
        <form class="card" id="pwForm">
          <h2>Change password</h2>
          <div class="field" style="margin-top:14px"><label for="cur">Current password</label><input class="input" id="cur" name="currentPassword" type="password" autocomplete="current-password"></div>
          <div class="field" style="margin-top:12px"><label for="np">New password</label><input class="input" id="np" name="newPassword" type="password" autocomplete="new-password"></div>
          <button class="btn primary" style="margin-top:16px">Update password</button>
        </form>
      </div>
      <div class="stack">
        <form class="card" id="prefForm">
          <h2>🔔 Notification preferences</h2>
          ${pref('newMatches', 'New matches', 'When a newly published opportunity matches your profile (60%+).')}
          ${pref('general', 'Open-to-all opportunities', 'University-wide talks, seminars and events.')}
          ${pref('deadlines', 'Deadline reminders', '3 days before a saved opportunity closes.')}
          ${pref('updates', 'Opportunity updates', 'When a saved opportunity changes its date, location or requirements.')}
          <button class="btn green" style="margin-top:16px">Save preferences</button>
        </form>
        <div class="card">
          <h2>Privacy</h2>
          <p class="small muted" style="margin-top:6px">Your profile is used only to calculate matches. Other students never see it. Club representatives see anonymised match statistics only.</p>
          <button class="btn danger" id="delBtn" style="margin-top:14px">Request account deletion</button>
        </div>
      </div>
    </div>`;

  const run = (sel, fn) => $(sel).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await fn(e.target); toast(r.message || 'Saved', 'success'); } catch (err) { toast(err.message, 'error'); }
  });
  run('#accountForm', (f) => api('/api/student/settings', { method: 'PUT', body: { name: f.name.value } }));
  run('#pwForm', async (f) => {
    const r = await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
    f.reset(); return r;
  });
  run('#prefForm', (f) => api('/api/student/settings', { method: 'PUT', body: { notificationPrefs: Object.fromEntries(['newMatches', 'general', 'deadlines', 'updates'].map((k) => [k, f[k].checked])) } }));
  $('#delBtn').onclick = async () => {
    if (!(await confirmDialog('Request account deletion?', 'An administrator will review and delete your account and profile data.', 'Send request', true))) return;
    const r = await api('/api/student/account/delete-request', { method: 'POST' });
    toast(r.message, 'success');
  };
})();
