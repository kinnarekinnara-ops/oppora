# OPPORA — *Opportunities find their people*

A campus opportunity discovery platform. Admins publish an opportunity once, AI extracts the skills and category, and a matching engine finds the right students — including ones **outside** the target programme — and explains *why* each opportunity fits them.

---

## ▶ Run it (2 minutes)

You only need **Node.js 18 or newer** ([nodejs.org](https://nodejs.org)). There is **no `npm install`** — OPPORA uses only Node's built-in modules.

```bash
cd oppora
node server.js
```

Open **http://localhost:3000**

The first run creates the demo database automatically.

| Command | What it does |
|---|---|
| `node server.js` (or `npm start`) | Start the app |
| `npm run seed` | Reset all demo data (do this before presenting!) |
| `npm test` | Run 36 automated end-to-end checks |

### Optional: real AI with Google Gemini
Without a key, OPPORA uses its built-in keyword engine (works offline). For Gemini:
1. Copy `.env.example` to `.env`
2. Paste your free key from https://aistudio.google.com/apikey into `GEMINI_API_KEY=`
3. Restart the server

If Gemini fails during the demo, OPPORA automatically falls back to the keyword engine — publishing never breaks.

---

## 🎨 Design: "Campus After Dark"

Open **http://localhost:3000/brand.html** for the brand board (palette, fonts, the three logo directions, house rules).

- **Palette** (from the APU campus at dusk): Night `#0E1A3A` · Cobalt `#2D5BE3` · Coral `#FF5A3C` · Amber `#FFB81C` · Leaf `#22B573` · Lagoon `#12B5CB` · Blush `#FFD3C4` · Cream `#FFF7EC` · Ink `#161A2E`
- **Fonts** (Google Fonts): Bricolage Grotesque (headings), Figtree (body), Caveat (handwritten notes)
- **Drone show + starfield**: `public/assets/js/sky.js`. It's one canvas with no libraries, it pauses when it's off-screen, and it respects reduced-motion settings
- **Login → dashboard warp**: `public/assets/js/transition.js` + the arrival CSS at the bottom of `main.css`
- To change what the drones draw, edit the `shapes` list where `OpporaSky.mount(...)` is called. It accepts `'logo'`, `'star'`, `'heart'`, `'rocket'`, or any text like `'text:GDG 2026'`

### Images and backgrounds (v3)
- **Login and registration** use the APU building photo (`public/assets/images/backgrounds/apu-campus.*`). The 3D effect is a blurred depth layer behind the photo, a light sweep in front, and a pointer tilt (`public/assets/js/campus.js`).
- **Portal backgrounds** use the network artwork on a separate fixed layer (`.portal-bg` in `main.css`, mounted by `navbar.js`):
  - Students: original colours, drift, glow and pointer parallax.
  - Admins: muted slate with a slower drift.
  - Only this background layer is transparent; page content keeps full opacity.
- **Cover images:** admins upload them in the Create/Edit Opportunity form (JPG, PNG or WEBP, up to 3 MB).
  - They're saved to `data/uploads/`, recorded in `data/uploads.json`, and served at `/uploads/<file>`.
  - The server checks the real file type from the file's contents, not its name.
  - Replacing or removing an image deletes the old file.
  - Opportunities without an image show a placeholder based on their category.

---

## 🔑 Demo accounts

| Role | Email | Password | Shows |
|---|---|---|---|
| 🎓 Student — Cybersecurity | `alex@student.oppora.edu` | `student123` | The hero story (cross-disciplinary match) |
| 🎓 Student — AI | `priya@student.oppora.edu` | `student123` | Strong AI matches |
| 🎓 Student — new profile | `mei@student.oppora.edu` | `student123` | Provisional scores, "complete your profile" |
| 🛡 Super Admin | `admin@oppora.edu` | `admin123` | Everything |
| 🗂 Opportunity Admin | `staff@oppora.edu` | `staff123` | Publish, approve |
| 🏛 Club Representative | `club@oppora.edu` | `club123` | Submit for approval, anonymised data |

The login page has one-click buttons for each account.

---

## 🎤 5-minute demo script

1. **The problem** — open the landing page.
2. **Student view** — log in as **Alex** (Cybersecurity). The **Linux Systems Challenge** is promoted to *Software Engineering* students, yet Alex sees it as an **84% Strong Match ✦ Beyond your programme**. Open it: *"Why this matches you"*, *"Areas to grow"*, and the score breakdown.
3. **Eligibility is separate** — open *Research Assistant — Smart Campus IoT Lab*: "Not eligible — open only to Computer Science, Computer Engineering students." A high score never overrides a mandatory rule.
4. **Admin publishes** — log out, log in as **staff**. *Create Opportunity → Fill with a demo example → Analyse with AI → Accept all*. Tick *Open to all students*. *Review & publish* → confirm eligibility → see "**X students matched, Y notified**" instantly.
5. **See who matched** — click *See who matched →* for the score distribution and the programmes reached.
6. **Closing loop** — log back in as a student and show the new notification 🔔.

Run `npm run seed` afterwards to reset.

---

## 🧠 How matching works

Implements the *Matching Engine & AI Logic* document:

1. **Eligibility (rule-based)** — only rules the admin marks as mandatory can exclude a student: programme restriction, year, study level, required skills (with minimum level). Free-text conditions are shown for the student to confirm themselves.
2. **Compatibility score**
   `Skills × 50% + Interests × 25% + Academic × 15% + Experience × 10%`
   - Related skills get partial credit through the skill map (e.g. "Linux" helps with "System Administration").
   - Synonyms are normalised ("sysadmin" → System Administration, "pentesting" → Ethical Hacking).
   - Beginners are never scored zero on beginner-friendly opportunities.
   - Missing profile sections are **not** treated as zero — the score is marked *provisional*.
3. **Labels** — 80%+ Strong · 60%+ Good · 40%+ Potential · below 40% Lower Relevance.
4. **Explanation** — template sentences built only from real profile data.
5. **Notifications** — students who are eligible and score 60%+ are notified once (no duplicates). Students who saved an opportunity are told when its deadline, date, location or eligibility changes. Reminders go out 3 days before a saved deadline.
6. **Lifecycle** — re-matches on publish, edit, profile update and approval. Opportunities auto-close when the deadline passes (checked every minute).

Weights and thresholds live in `backend/config/constants.js`.

---

## 💾 Where the data is stored

The "database" is a set of **JSON text files in `data/`** on your laptop. That's what "stored on a local server" means here: no cloud and no database software to install. You can open any file and read it.

| File | Contents |
|---|---|
| `users.json` | Logins and roles (passwords are hashed with scrypt, never stored in plain text) |
| `students.json` | Student profiles |
| `opportunities.json` | Opportunities |
| `matches.json` | Match results: score, eligibility, reasons, gaps |
| `saved.json` | Bookmarks and tracking status |
| `notifications.json` | Student notifications |
| `organizations.json` | Clubs and departments |
| `activity_logs.json` | Admin audit trail |
| `sessions.json` | Login sessions |
| `skills_catalog.json` | Skills, synonyms, related skills, interests *(reference data — edit to tune matching)* |
| `categories.json`, `programmes.json` | Reference lists |

Writes are safe: each file is written to a `.tmp` copy first and then renamed into place. To move to SQLite or MySQL later, only `backend/services/db.js` needs to change.

---

## 📁 Project structure

```
oppora/
├── server.js                  Starts the app: static files + API + background jobs
├── package.json  .env.example  README.md
├── scripts/
│   ├── seed.js                Demo data (dates are relative to today)
│   └── test-api.js            End-to-end tests
├── data/                      JSON database (see above)
├── backend/
│   ├── config/constants.js    Weights, thresholds, roles, statuses
│   ├── lib/http.js            Tiny router + JSON/cookie helpers
│   ├── lib/dates.js           Deadline maths
│   ├── middleware/auth.js     Password hashing, sessions, role guards
│   ├── routes/                authRoutes · studentRoutes · opportunityRoutes · savedRoutes
│   │                          notificationRoutes · metaRoutes (+AI) · adminRoutes
│   └── services/
│       ├── db.js              JSON file read/write
│       ├── skillNormalizer.js Synonyms + related skills
│       ├── eligibility.js     Mandatory rule checks
│       ├── scoring.js         Weighted 50/25/15/10 score
│       ├── explainer.js       "Why this matches you" text
│       ├── matchingEngine.js  The full pipeline
│       ├── aiExtractor.js     Gemini + keyword fallback
│       ├── notificationService.js  Notifications, dedupe, deadline reminders
│       ├── statusScheduler.js Auto-close + reminders every minute
│       ├── activityLogger.js  Audit log
│       └── present.js         Formats records for the browser
└── public/
    ├── index.html  login.html  register.html
    ├── student/   dashboard · opportunities · opportunity · saved · notifications · profile · settings · calendar
    ├── admin/     dashboard · opportunities · opportunity-form · approvals · matching · students
    │              organizations · analytics · activity-logs · admin-users
    └── assets/
        ├── css/   tokens.css (colours/fonts) · main.css · student.css · admin.css
        ├── js/    api.js · components.js · navbar.js · auth.js · landing.js
        │          student/*.js · admin/*.js   (one script per page)
        └── images/logo.svg
```

---

## 👥 Splitting the work

| Person | Owns |
|---|---|
| A — Matching | `backend/services/` (scoring, eligibility, explainer), `skills_catalog.json` |
| B — Backend/AI | `server.js`, `backend/routes/`, `aiExtractor.js`, Gemini setup |
| C — Student Portal | `public/student/`, `public/assets/js/student/`, `student.css` |
| D — Admin Portal + pitch | `public/admin/`, `public/assets/js/admin/`, `admin.css`, demo script |

---

## 🔒 Security notes (prototype level)
- Passwords are hashed with scrypt. Sessions use HttpOnly cookies.
- Every admin action is checked **on the server** by role, not just hidden in the UI.
- Organization reps can only manage their own organization and see **anonymised** match data.
- The AI key stays on the server (in `.env`) and is never sent to the browser.
- All user text is HTML-escaped before display.

Out of scope for the hackathon version: email delivery, password reset emails, HTTPS, rate limiting.
