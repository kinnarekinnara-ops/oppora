// =============================================================
//  OPPORA — "Opportunities find their people"
//  Main server. Run with:   node server.js
//  Then open:               http://localhost:3000
//
//  No npm install needed — uses only Node.js built-in modules.
// =============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- 1. Load settings from .env (simple built-in parser) ----------
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
const PORT = Number(process.env.PORT) || 3000;

const { Router, sendJson } = require('./backend/lib/http');
const db = require('./backend/services/db');

// ---------- 2. First run? Create the demo database ----------
if (!db.exists('users')) {
  console.log('No database found — creating demo data...');
  require('./scripts/seed').seed();
  db.clearCache();
}

// ---------- 3. Register all API routes ----------
const router = new Router();
require('./backend/routes/authRoutes').register(router);
require('./backend/routes/metaRoutes').register(router);
require('./backend/routes/studentRoutes').register(router);
require('./backend/routes/opportunityRoutes').register(router);
require('./backend/routes/savedRoutes').register(router);
require('./backend/routes/notificationRoutes').register(router);
require('./backend/routes/adminRoutes').register(router);

// ---------- 4. Static file serving for /public ----------
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.pathname);
  if (rel === '/') rel = '/index.html';
  if (rel === '/student' || rel === '/student/') rel = '/student/dashboard.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin/dashboard.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); } // block ../ tricks

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1><p>Page not found. <a href="/">Go home</a></p>');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------- 5. The server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.pathname = url.pathname;
  req.query = Object.fromEntries(url.searchParams);

  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.pathname.startsWith('/api/')) {
    const handled = await router.handle(req, res);
    if (!handled) sendJson(res, 404, { error: 'API endpoint not found.' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
});

// ---------- 6. Background jobs: auto-close + deadline reminders ----------
require('./backend/services/statusScheduler').start();

server.listen(PORT, () => {
  console.log(`\n  ✦ OPPORA is running →  http://localhost:${PORT}`);
  console.log(`  ✦ AI extraction: ${process.env.GEMINI_API_KEY ? 'Google Gemini' : 'built-in rule engine (add GEMINI_API_KEY to .env for Gemini)'}`);
  console.log('  ✦ Demo logins are listed in README.md\n');
});
