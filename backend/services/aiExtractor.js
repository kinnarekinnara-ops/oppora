// =============================================================
// aiExtractor.js — AI-assisted opportunity processing (Admin §5).
//
// If GEMINI_API_KEY is set in .env, the description is sent to Google
// Gemini. If there is no key, or the AI call fails, a rule-based
// extractor (keyword + skill catalog) is used instead, so publishing
// NEVER depends on the AI being available (Admin §5.5).
//
// Everything returned here is a SUGGESTION. The admin reviews it before
// publishing, and the AI is never asked about eligibility (Matching §3.3).
// =============================================================
const db = require('./db');
const { findSkillsInText, normalize, info, fieldsFor } = require('./skillNormalizer');
const { EXPERIENCE_LEVELS } = require('../config/constants');

// ---------------- Rule-based extractor (always available) ----------------
function ruleBasedExtract(title, description) {
  const text = `${title || ''}. ${description || ''}`;
  const lower = text.toLowerCase();

  const skills = findSkillsInText(text);
  const requiredSkills = skills.filter((s) => (info(s) || {}).type !== 'soft');
  const softSkills = skills.filter((s) => (info(s) || {}).type === 'soft');

  // Categories: count keyword hits per category
  const categories = db.read('categories')
    .map((c) => ({ id: c.id, hits: c.keywords.filter((k) => lower.includes(k)).length }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((c) => c.id);
  if (!categories.length) categories.push('general');

  let experienceLevel = 'Any';
  if (/\b(advanced|expert|experienced|senior|proficient)\b/.test(lower)) experienceLevel = 'Advanced';
  else if (/\bintermediate\b|some experience|prior experience required/.test(lower)) experienceLevel = 'Intermediate';
  else if (/beginner|no (prior )?experience|first[- ]timer|newcomer|introduct|basic|fundamental|entry[- ]level/.test(lower)) experienceLevel = 'Beginner';

  // Academic fields: the fields most associated with the detected skills
  const tally = {};
  for (const s of skills) for (const f of fieldsFor(s)) tally[f] = (tally[f] || 0) + 1;
  const academicFields = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);

  // Knowledge areas: interest areas the text touches
  const knowledgeAreas = (db.read('skills_catalog').interests || [])
    .filter((i) => i.keywords.some((k) => (' ' + lower + ' ').includes(k)))
    .map((i) => i.name)
    .slice(0, 5);

  let audienceHint = '';
  if (/all students|everyone|open to all|university-wide/.test(lower)) audienceHint = 'Appears to be open to all students';
  else if (/postgraduate/.test(lower)) audienceHint = 'Mentions postgraduate students';
  else if (/undergraduate/.test(lower)) audienceHint = 'Mentions undergraduate students';
  const yearMatch = lower.match(/year\s*(\d)(?:\s*(?:and|&|,|-|to)\s*(?:year\s*)?(\d))?/);
  if (yearMatch) audienceHint += `${audienceHint ? '; ' : ''}mentions Year ${yearMatch[1]}${yearMatch[2] ? ` and ${yearMatch[2]}` : ''}`;

  return { categories, requiredSkills, softSkills, experienceLevel, academicFields, knowledgeAreas, audienceHint };
}

// ---------------- Gemini extractor (optional) ----------------
async function geminiExtract(title, description) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const categories = db.read('categories');
  const programmes = db.read('programmes').map((p) => p.name);
  const knownSkills = (db.read('skills_catalog').skills || []).map((s) => s.name);

  const prompt = `You help a university publish student opportunities. Extract structured information from the opportunity below.
Return ONLY JSON with this shape:
{
  "categories": [category ids, 1-2 items, from: ${categories.map((c) => `"${c.id}" (${c.name})`).join(', ')}],
  "requiredSkills": [technical skills needed or clearly useful, max 6. Prefer these names when they fit: ${knownSkills.join(', ')}],
  "softSkills": [non-technical skills, max 4],
  "experienceLevel": one of ${EXPERIENCE_LEVELS.map((l) => `"${l}"`).join(', ')},
  "academicFields": [relevant academic programmes, max 4, from: ${programmes.join(', ')}],
  "knowledgeAreas": [short topic phrases, max 5],
  "audienceHint": "one short sentence describing who it seems aimed at, or empty string"
}
Rules: only use information stated or strongly implied in the text. Do NOT invent eligibility rules, dates or requirements.

Title: ${title}
Description: ${description}`;

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`Gemini returned HTTP ${resp.status}`);
  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini returned an empty response');
  const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, ''));

  // Sanitize everything the model returns — never trust it blindly
  const catIds = categories.map((c) => c.id);
  const toCat = (v) => {
    const s = String(v).toLowerCase();
    const hit = categories.find((c) => c.id === s || c.name.toLowerCase() === s);
    return hit ? hit.id : null;
  };
  const uniq = (arr) => [...new Set(arr)];
  return {
    categories: uniq((parsed.categories || []).map(toCat).filter((c) => catIds.includes(c))).slice(0, 2),
    requiredSkills: uniq((parsed.requiredSkills || []).map(normalize).filter(Boolean)).slice(0, 6),
    softSkills: uniq((parsed.softSkills || []).map(normalize).filter(Boolean)).slice(0, 4),
    experienceLevel: EXPERIENCE_LEVELS.includes(parsed.experienceLevel) ? parsed.experienceLevel : 'Any',
    academicFields: (parsed.academicFields || []).filter((f) => programmes.includes(f)).slice(0, 4),
    knowledgeAreas: (parsed.knowledgeAreas || []).map(String).slice(0, 5),
    audienceHint: String(parsed.audienceHint || ''),
  };
}

/** Main entry point used by the /api/ai/extract route. */
async function extract(title, description) {
  if (!description || description.trim().length < 20) {
    return { ok: false, error: 'Write a longer description (at least 20 characters) so the AI has something to analyse.' };
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await geminiExtract(title, description);
      if (!result.categories.length) result.categories = ruleBasedExtract(title, description).categories;
      return { ok: true, source: 'gemini', suggestions: result };
    } catch (err) {
      console.warn('[AI] Gemini failed, using rule-based extraction:', err.message);
      return {
        ok: true,
        source: 'rules',
        warning: 'The AI service is unavailable right now, so these suggestions come from OPPORA\'s built-in keyword engine. Please review them carefully.',
        suggestions: ruleBasedExtract(title, description),
      };
    }
  }
  return { ok: true, source: 'rules', suggestions: ruleBasedExtract(title, description) };
}

module.exports = { extract, ruleBasedExtract };
