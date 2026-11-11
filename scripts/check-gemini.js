// =============================================================
// check-gemini.js — run before recording the demo:  npm run check-ai
// Confirms GEMINI_API_KEY in .env works and shows what Gemini
// suggests for the demo opportunity (the same call the
// "Analyse with AI" button makes).
// =============================================================
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (!process.env.GEMINI_API_KEY) {
  console.log('✗ No GEMINI_API_KEY found.\n  Open the .env file in the project folder and paste your key after GEMINI_API_KEY=');
  console.log('  Get a free key at https://aistudio.google.com/apikey');
  process.exit(1);
}

const { extract } = require('../backend/services/aiExtractor');
const title = 'Linux Systems Challenge';
const description = 'A beginner-friendly competition for all undergraduates. Teams solve hands-on Linux tasks: '
  + 'configuring servers, troubleshooting networking, writing shell scripts and basic system administration. '
  + 'Great for students interested in cybersecurity, cloud and infrastructure.';

console.log(`Testing Gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})…`);
extract(title, description).then((r) => {
  if (r.source === 'gemini') {
    console.log('✓ Gemini is working. Suggestions for the demo opportunity:\n');
    console.log(JSON.stringify(r.suggestions, null, 2));
  } else {
    console.log('✗ Gemini did not answer, so OPPORA fell back to the keyword engine.');
    console.log('  Check the key is correct, the model name is valid, and the computer is online.');
    process.exit(1);
  }
}).catch((e) => { console.log('✗ Error:', e.message); process.exit(1); });
