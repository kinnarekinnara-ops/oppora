// =============================================================
// api.js — one helper for every call to the OPPORA server.
//   const data = await api('/api/student/dashboard');
//   await api('/api/saved/opp_1', { method: 'POST' });
// Throws an Error with .status and .fields (form errors) on failure.
// A 401 sends the user to the login page.
// =============================================================
async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    const err = new Error('Cannot reach the OPPORA server. Is it running?');
    err.status = 0;
    throw err;
  }
  let data = {};
  try { data = await res.json(); } catch (_) { /* empty body */ }

  if (res.status === 401 && redirectOn401) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `/login.html?next=${next}`;
    return new Promise(() => {}); // stop the caller while we navigate
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.fields = data.fields || null;
    throw err;
  }
  return data;
}

/** Cached reference data (categories, programmes, skills...). */
let _metaPromise = null;
function getMeta() {
  if (!_metaPromise) _metaPromise = api('/api/meta', { redirectOn401: false });
  return _metaPromise;
}
