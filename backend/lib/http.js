// =============================================================
// http.js — a tiny router + request helpers built on Node's
// built-in http module (no Express needed, so no npm install).
// =============================================================

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handlers) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; }) + '/?$'
    );
    this.routes.push({ method, regex, keys, handlers });
  }

  get(p, ...h) { this.add('GET', p, h); }
  post(p, ...h) { this.add('POST', p, h); }
  put(p, ...h) { this.add('PUT', p, h); }
  delete(p, ...h) { this.add('DELETE', p, h); }

  /** Mount another router's routes under a prefix. */
  use(prefix, router) {
    for (const r of router.routes) {
      const src = r.regex.source.slice(1); // drop leading ^
      this.routes.push({ ...r, regex: new RegExp('^' + prefix.replace(/\//g, '\\/') + src) });
    }
  }

  /** Returns true if a route matched (and the response was sent). */
  async handle(req, res) {
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const m = route.regex.exec(req.pathname);
      if (!m) continue;
      req.params = {};
      route.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); });
      try {
        let result;
        for (const handler of route.handlers) {
          result = await handler(req, res);
          if (res.writableEnded) return true;
        }
        sendJson(res, 200, result === undefined ? { ok: true } : result);
      } catch (err) {
        if (err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message, ...(err.extra || {}) });
        } else {
          console.error('[server error]', err);
          sendJson(res, 500, { error: 'Something went wrong on the server.' });
        }
      }
      return true;
    }
    return false;
  }
}

function sendJson(res, status, data, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new HttpError(400, 'Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

module.exports = { Router, HttpError, sendJson, parseCookies, readBody };
