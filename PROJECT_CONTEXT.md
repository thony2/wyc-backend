# WYC — Project Context & Handover Document
**Version:** 1.0 | **Last updated:** May 2026 | **Status: ARCHIVED — see banner below**

---

> ## ⚠️ ARCHIVED DOCUMENT — most of this file describes a version of the project that no longer exists
>
> This document was written **27 May 2026** and has not been edited since. Everything technical in it
> — file paths, API routes, environment variable names, the known-issues list — describes the codebase
> as it was **before** SQLite was removed, before the admin API split was correctly understood, before
> the CSRF saga, before the auth-middleware consolidation, and before most of what `MASTER_CHECKLIST.md`
> now tracks even existed. An independent documentation audit (1 Aug 2026, cross-verified directly
> against the repository rather than taken on trust) found roughly 70% of this document's checkable
> technical content to be actively wrong, not just outdated.
>
> **For current technical fact, use these instead:**
> - **[`README.md`](./README.md)** — architecture, project structure, API reference, environment
>   variables, security posture, deployment.
> - **[`MASTER_CHECKLIST.md`](./MASTER_CHECKLIST.md)** — what's actually done, what's still open, the
>   project's own running engineering log.
>
> **What's still genuinely worth reading here:** §1 (business model) — this hasn't changed and isn't a
> technical claim that can go stale the way a file path can. The rest of this document is kept for
> historical record, not as a reference.

---

## 1. What This Project Is

A **flooring e-commerce and lead generation platform** built as a personal business venture.
The owner buys flooring from suppliers, rebrands it under their own name, sells it online,
and passes installation leads to local fitters in exchange for commission.

**Business model:**
- Source product from suppliers (Carpet Line Direct, Victoria, Cormar, etc.)
- Rebrand under own collection names — no supplier branding visible anywhere
- Sell online (future) or capture leads for free measure & quote
- Pass install leads to local fitter → earn commission on product + installation
- Core asset is SEO-ranked web presence, not physical stock

**Current state (as of May 2026 — see `MASTER_CHECKLIST.md` for the current state today):**
Functional prototype. Live in production. No real products yet.

**Not evaluated by the 1 Aug 2026 documentation audit, worth someone's attention separately:** the
scraper/import subsystem (`routes/scraper.js`, `routes/suppliers/`) exists specifically to pull content
— images, specifications, descriptions — from supplier websites and re-host it, rebranded, without
attribution. Nothing in this repository's documentation addresses whether this has been checked against
the relevant suppliers' terms of service, or the copyright status of re-hosted supplier photography.
That's a business/legal question, not a code question, and outside what any of these four documents can
answer — flagging it here since this is the one section of this archived document actually about the
business, not the implementation.

---

## 2. Tech Stack (mostly still accurate — verify anything version-specific against `package.json`)

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Vanilla HTML/CSS/JS | Vercel |
| Backend | Node.js + Express | Railway |
| Database | PostgreSQL | Railway (managed) |
| Image storage | Cloudinary | Cloudinary free tier |
| Email | Nodemailer (SMTP) | Disabled in dev |
| Auth | JWT (8h expiry) | — |
| Logging | Winston | — |

**Key versions — corrected 1 Aug 2026, this table was wrong:** this document previously said
`Node: ≥18.0.0`. The actual, current requirement in `package.json` is **`Node: ≥20.0.0`** — matching
`README.md`, which is correct. Don't trust exact dependency versions (Express, `pg`, etc.) from this
document at all; check `package.json` directly, since those drift on every `npm update` and this file
doesn't.

---

## 3. Repository Structure — RETIRED, see `README.md`

The structure described here (a `routes/admin.js`, `src/routes/admin.js`, `src/config/schema.sql`, and
a "PostgreSQL/SQLite abstraction layer") is stale. Some of it was stale on the day this document was
written — `routes/admin.js` had already been renamed to `routes/panel.js` before this file's own commit,
per `git log`. **`README.md`'s "Project Structure" section is accurate and actively maintained; use
that instead of anything below this line in this section.**

---

## 4. Active API Routes — RETIRED, see `README.md`

The table this document used to have here was both wrong (it listed `GET /api/leads (JWT)`, a route
that has never existed — `src/routes/leads.js` only ever defined `POST /leads`) and badly incomplete
(it omitted the entire `/api/admin/*` tree, offers, audit log, change-password, and likes — roughly
two-thirds of the app's real routes). **`README.md`'s "API Reference" section lists every route
currently confirmed to exist; use that instead.**

---

## 5. Environment Variables — RETIRED, see `README.md`

The email variable names this document used to list here (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`,
`MAIL_PASS`) are wrong and always were — the actual code has only ever read `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (confirmed directly in `src/services/emailService.js`). Anyone
configuring email from this section alone would set variables the code never reads. **`README.md`'s
"Environment Variables Reference" table is accurate and matches `.env.example`; use that instead.**

---

## 6. Known Critical Issues — RETIRED, see `MASTER_CHECKLIST.md`

Of the 19 items originally listed in this section (5 critical, 7 high, 7 medium), an independent audit
(1 Aug 2026) confirmed 13–14 are now fixed, 2 are now described backwards relative to current reality
(CSRF was characterized as "an empty stub" — it was fully implemented, tested, and deliberately reverted
for a documented reason; the "dual routing architecture" is real but is now a correctly-diagnosed,
intentionally-tracked situation with its own remediation plan, not an unexplained problem), and only
4–5 are both still open and still accurately described. **This section is no longer a reliable action
list. `MASTER_CHECKLIST.md` is the current, actively-maintained one — use that instead.**

---

## 7. Architecture Decisions Already Made

Still true, and worth keeping as-is — these are stable decisions, not implementation details that drift:
- **Frontend on Vercel, backend on Railway** — correct, keep this split
- **SSR product pages** at /flooring/:category/:slug — correct for SEO
- **JWT auth, no sessions** — correct for stateless API
- **Cloudinary for images** — correct, keep

**One correction:** this document used to also claim *"PostgreSQL in production, SQLite option for
local — abstraction in database.js."* That's wrong — SQLite was fully removed 10 Jul 2026, by deliberate
design. `src/config/database.js` now throws a startup error if `DB_TYPE=sqlite` is ever set. See
`README.md`'s architecture section.

---

## 8. Deployment Flow

```
Developer pushes to GitHub main branch
    ↓
Railway auto-deploys wyc-backend
    ↓
Vercel auto-deploys frontend static files
    ↓
vercel.json proxies /flooring/* → Railway backend
```

**Caveat, not a correction — this needs checking against the live dashboards, not this file:**
`MASTER_CHECKLIST.md`'s `0.5-I` entry documents that the live frontend (`easyflooring.vercel.app`) was
at one point **not** connected to this GitHub repo at all, and was later reconnected and verified
(11–26 Jul 2026). Whether the simple diagram above is currently accurate depends on live Vercel/Railway
dashboard state, which no static document — including this correction — can confirm. Check
`MASTER_CHECKLIST.md` `0.5-I` for the most recent verification, and the dashboards themselves for
anything more recent than that.

**Local dev:**
- Backend: npm run dev → http://localhost:3001
- Frontend: VS Code Live Server → http://127.0.0.1:5500
- Database: connects to Railway PostgreSQL via public URL in .env

---

## 9. Supplier Scrapers

Still accurate — this subsystem's file layout hasn't moved:

| Supplier | File | URL pattern |
|----------|------|------------|
| Carpet Line Direct | routes/suppliers/cld.js | carpetlinedirect.co.uk |
| Cormar Carpets | routes/suppliers/cormar.js | cormarcarpets.co.uk |
| Victoria Carpets | routes/suppliers/victoria.js | victoriaplc.com |
| Woodpecker Flooring | routes/suppliers/woodpecker.js | woodpeckerflooring.co.uk |
| Karndean | routes/suppliers/karndean.js | karndean.com |
| Quick-Step | routes/suppliers/quickstep.js | quick-step.com |

**⚠️ Important:** These are web scrapers against live supplier sites.
They will break whenever suppliers update their website structure.
They must be monitored and verified regularly.

**Business rule:** ALL supplier names must be stripped before saving to the database.
The customer must never see "Carpet Line Direct", "Cormar", etc.
Only the owner's brand name is visible. **Update, 1 Aug 2026:** this is no longer just a stated rule —
`routes/scraper.js`'s `/import-family` endpoint enforces it in code, rejecting any colour whose name
still matches the supplier's original name at import time. See `MASTER_CHECKLIST.md` `1A`.

---

## 10. For the Next Developer / Chat Session — see `MASTER_CHECKLIST.md`'s "How to Resume" instead

This section used to tell the reader to start by reading this document in full. Don't — see the banner
at the top. **`MASTER_CHECKLIST.md`'s "How to Resume in a New Chat" section (bottom of that file) is the
current, correct version of this instruction.**

The one thing worth keeping from this section is still true and still worth following:

### Git commit conventions:

```
feat: add new feature
fix: bug fix
refactor: code restructure, no behaviour change
chore: cleanup, deps, config
docs: documentation only
```

---

## 11. Contact & Access

| Resource | Details |
|----------|---------|
| Frontend (live) | https://www.westyorkshirecarpets.com |
| Backend (live) | https://wyc-backend-production-ed78.up.railway.app |
| Admin panel | https://wyc-backend-production-ed78.up.railway.app/admin |
| Railway dashboard | https://railway.app |
| Vercel dashboard | https://vercel.com |
| Cloudinary | https://cloudinary.com |
| GitHub repo | https://github.com/thony2/wyc-backend |

**Corrected 1 Aug 2026:** this table previously listed the frontend Vercel URL as
`project-rho-nine-19.vercel.app`. `MASTER_CHECKLIST.md`'s `0.5-I` entry — based on directly inspecting
the Vercel dashboard, not assumed — identifies `easyflooring.vercel.app` as the actual live, currently-
relevant deployment. `project-rho-nine-19.vercel.app` is either an old, superseded project or was simply
wrong; either way, don't use it. The `GitHub repo` row previously contained a literal unfilled
`[your repo URL]` placeholder, left in since this document's creation — filled in above.
