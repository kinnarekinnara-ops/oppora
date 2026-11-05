// =============================================================
// db.js — the "database" layer.
// Every collection is a JSON file in /data. Data is cached in
// memory and written back to disk safely (write to .tmp, then rename)
// so a crash mid-write never corrupts a file.
// =============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const cache = {};

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/** Read a whole collection (array or object). Missing file → empty array. */
function read(name) {
  if (!(name in cache)) {
    try {
      cache[name] = JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
    } catch (err) {
      cache[name] = [];
    }
  }
  return cache[name];
}

/** Replace a whole collection and save it to disk. */
function write(name, data) {
  cache[name] = data;
  const tmp = filePath(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath(name));
}

/** Small helpers so routes read naturally. */
function findById(name, id) {
  return read(name).find((r) => r.id === id) || null;
}

function insert(name, record) {
  const rows = read(name);
  rows.push(record);
  write(name, rows);
  return record;
}

function update(name, id, changes) {
  const rows = read(name);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...changes };
  write(name, rows);
  return rows[idx];
}

function remove(name, predicate) {
  const rows = read(name);
  const kept = rows.filter((r) => !predicate(r));
  write(name, kept);
  return rows.length - kept.length;
}

/** Short, readable unique IDs, e.g. "opp_lq2k9x3a7f". */
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function exists(name) {
  return fs.existsSync(filePath(name));
}

function clearCache() {
  for (const k of Object.keys(cache)) delete cache[k];
}

module.exports = { read, write, findById, insert, update, remove, newId, exists, clearCache, DATA_DIR };
