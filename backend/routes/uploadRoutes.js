// =============================================================
// uploadRoutes.js — opportunity cover images (Admin §3.1).
//
// Images are stored as files in data/uploads/ (same local storage
// approach as the JSON database) and recorded in data/uploads.json.
// The browser sends the file as a base64 data URL in JSON, so no extra
// npm packages are needed for multipart parsing.
//
// Security: type is checked from the file's real bytes ("magic numbers"),
// not just its name; size is capped; filenames are generated server-side.
// =============================================================
const fs = require('fs');
const path = require('path');
const db = require('../services/db');
const { HttpError, readBody } = require('../lib/http');
const auth = require('../middleware/auth');

const UPLOAD_DIR = path.join(db.DATA_DIR, 'uploads');
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const URL_RE = /^\/uploads\/[a-z0-9_]+\.(jpg|png|webp)$/;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Detect the real image type from its first bytes. */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** True if `url` points to an image that really exists in data/uploads. */
function isValidUpload(url) {
  return typeof url === 'string' && URL_RE.test(url) && fs.existsSync(path.join(UPLOAD_DIR, path.basename(url)));
}

/** Delete an uploaded file if no opportunity uses it any more (called after replace/remove). */
function removeIfUnused(url) {
  if (!url || !URL_RE.test(url)) return false;
  if (db.read('opportunities').some((o) => o.imageUrl === url)) return false;
  try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(url))); } catch (_) { /* already gone */ }
  db.write('uploads', db.read('uploads').filter((u) => u.url !== url));
  return true;
}

function register(router) {
  router.post('/api/admin/uploads', auth.requireAdmin, async (req) => {
    const body = await readBody(req, Math.ceil(MAX_BYTES * 1.4) + 4096);
    const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(body.dataUrl || ''));
    if (!m) throw new HttpError(400, 'Please choose an image file (JPG, PNG or WEBP).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) throw new HttpError(400, `That image is ${(buf.length / 1048576).toFixed(1)} MB — the limit is 3 MB.`);
    const type = sniff(buf);
    if (!type) throw new HttpError(400, 'That file isn\'t a valid JPG, PNG or WEBP image.');

    const id = db.newId('img');
    const file = `${id}.${EXT[type]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    const record = {
      id, file, url: `/uploads/${file}`, type, size: buf.length,
      originalName: String(body.filename || '').slice(0, 120),
      uploadedBy: req.user.id, createdAt: new Date().toISOString(),
    };
    db.insert('uploads', record);
    return { url: record.url, size: record.size, type };
  });
}

module.exports = { register, isValidUpload, removeIfUnused, UPLOAD_DIR };
