// =============================================================
// skillNormalizer.js — maps different words for the same skill to
// one standard name, e.g. "Linux Administration" → "Linux",
// "Penetration Testing" → "Ethical Hacking" (Matching doc 4.2).
// =============================================================
const db = require('./db');

let index = null;

function build() {
  const catalog = db.read('skills_catalog');
  const bySynonym = new Map();
  const byName = new Map();
  for (const s of catalog.skills || []) {
    byName.set(s.name.toLowerCase(), s);
    bySynonym.set(s.name.toLowerCase(), s.name);
    for (const syn of s.synonyms) bySynonym.set(syn.toLowerCase(), s.name);
  }
  index = { bySynonym, byName, catalog };
  return index;
}

function idx() {
  return index || build();
}

function clean(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

/** Returns the standard skill name, or the cleaned original if unknown. */
function normalize(name) {
  const c = clean(name);
  if (!c) return '';
  const hit = idx().bySynonym.get(c.toLowerCase());
  if (hit) return hit;
  // Title-case unknown skills so "react native" and "React Native" match
  return c.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeList(list) {
  const out = [];
  for (const item of list || []) {
    const n = normalize(typeof item === 'string' ? item : item.name);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function info(name) {
  return idx().byName.get(String(name).toLowerCase()) || null;
}

/** Skills defined as related in the catalog (both directions). */
function relatedTo(name) {
  const own = info(name);
  const set = new Set(own ? own.related : []);
  for (const s of idx().catalog.skills || []) {
    if (s.related.includes(name)) set.add(s.name);
  }
  set.delete(name);
  return [...set];
}

/** Academic fields a skill is relevant to (used for AI fallback + academic score). */
function fieldsFor(name) {
  const own = info(name);
  return own ? own.fields : [];
}

/**
 * Scan free text for known skills (used by the rule-based AI fallback).
 * Matches whole words/phrases only.
 */
function findSkillsInText(text) {
  const lower = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9+/#.\- ]/g, ' ') + ' ';
  const found = [];
  for (const [syn, canonical] of idx().bySynonym.entries()) {
    if (syn.length < 2) continue;
    const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    if (re.test(lower) && !found.includes(canonical)) found.push(canonical);
  }
  return found;
}

function allSkills() {
  return (idx().catalog.skills || []).map((s) => ({ name: s.name, type: s.type }));
}

function allInterests() {
  return idx().catalog.interests || [];
}

function reload() {
  index = null;
}

module.exports = { normalize, normalizeList, relatedTo, fieldsFor, findSkillsInText, allSkills, allInterests, info, reload };
