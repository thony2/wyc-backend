# WYC Flooring Platform — Backend & Site
*(working name — no business name has been finalized yet, see note below)*

A GDPR-conscious lead-capture API, admin panel, and supplier-catalogue importer for a flooring
e-commerce/lead-generation business that's still being built, plus the static marketing site it serves
alongside.

> **Honesty note (1 Aug 2026):** this README was substantially rewritten after the project owner
> confirmed the business itself doesn't exist yet — no finalized name, no domain, no real customers or
> leads — which the previous version didn't reflect accurately. It builds on a 29 Jul 2026 full rewrite
> (after five audits over July found the version before *that* describing an architecture that no longer
> existed), so this is the second time this file has needed correcting for reasons beyond normal code
> drift. `MASTER_CHECKLIST.md` is the living, actively-maintained source of truth — trust that over this
> file if they ever disagree.
>
> **Current status, stated plainly:** the app is fully built and technically deployed — both URLs below
> are live and reachable — but this is **pre-launch**. There is no registered domain, no finalized
> business name (the repo and this doc use "WYC" only because that's the existing repo name, not because
> it's a confirmed brand), and no real customer leads have been captured yet. Everything under
> "Deployment" below is explicitly temporary infrastructure, not production infrastructure in the sense
> of serving real customers — treat it as a live staging environment, not a live business.

**Despite the repo name, this is not just a backend.** It contains three things in one place:
1. The **static marketing site** (`index.html`, `css/`, `js/`, `images/`) — hosted on **Vercel**
2. The **Express API** (`server.js`, `src/`) — lead capture, admin auth, product catalogue,
   a supplier-scraping/import tool — hosted on **Railway**
3. The **admin panel** (`admin/`) — a single-page app, served statically by the same Express app

---

## Project Structure

```
wyc-backend/
├── server.js                    # Express entry point — wires up every router below
├── migrate-auto.js              # Runs on every server boot — creates/updates the schema
├── package.json
├── .env.example                 # Copy to .env and configure — kept accurate, trust this file
│
├── src/                         # Everything — one unified route tree as of 1 Aug 2026 (5A
│   │                            # consolidation, all 5 steps complete). There used to be a
│   │                            # second, separate routes/ directory at the repo root, split by
│   │                            # feature not by age — see "Admin API" below for that history.
│   ├── config/
│   │   ├── database.js          # PostgreSQL only. Throws a deliberate startup error if
│   │   │                        # DB_TYPE=sqlite is ever set — SQLite was fully removed 10 Jul 2026.
│   │   └── initDb.js            # Read-only connection check. Does NOT create anything —
│   │                            # migrate-auto.js (above) is what actually builds the schema.
│   ├── controllers/
│   │   ├── leadController.js          # POST /api/leads
│   │   ├── adminController.js         # Leads/dashboard/calendar admin logic (see API Reference)
│   │   ├── productPublicController.js # Public product catalogue + likes
│   │   ├── adminAuthController.js     # Admin login, change-password
│   │   ├── productAdminController.js  # Product/offer CRUD, stats, audit log
│   │   └── importController.js        # Supplier scraping + Cloudinary import
│   ├── middleware/
│   │   ├── security.js          # Helmet, CORS, rate limiters
│   │   ├── validate.js          # express-validator chains for the public lead form
│   │   └── auth.js              # The one requireAuth/requireAdmin — used everywhere admin-only
│   ├── routes/
│   │   ├── leads.js             # Mounts leadController at /api
│   │   ├── authGuard.js         # JWT check + mounts adminController at /api/admin
│   │   ├── products.js          # Public product catalogue + likes — mounted at /api/products
│   │   ├── panel.js             # Admin auth + product/offer CRUD — mounted at /api/panel
│   │   ├── import.js            # Supplier scraping/import — mounted at /api/panel
│   │   └── products-seo.js      # Server-rendered product pages — mounted at /flooring
│   ├── services/
│   │   ├── emailService.js      # Admin notification + customer confirmation emails
│   │   ├── csvService.js        # CSV export helper
│   │   └── suppliers/           # One plugin per supported supplier site (see below)
│   ├── utils/
│   │   ├── logger.js            # Winston, console + file transports in production
│   │   ├── urlSafety.js         # SSRF guard for server-initiated fetches of user-supplied URLs
│   │   └── auditLog.js          # Shared audit_log writer for product/offer admin actions
│   └── tests/
│       ├── leads.test.js        # Real integration test (pg-mem), added PR #34 — not a placeholder,
│       │                        # see "Known Gaps" below for what test coverage still doesn't exist
│       └── urlSafety.test.js    # SSRF-guard unit tests for src/utils/urlSafety.js
│
├── admin/                       # The admin single-page app, served statically at /admin
│   ├── index.html               # Still large (~2,400 lines) — a partial split into css/js
│   │                            # already happened; the rest is deliberately deferred until
│   │                            # a planned redesign, not forgotten — see MASTER_CHECKLIST.md 1E
│   ├── css/admin.css
│   └── js/admin-import.js       # Single-URL and bulk-URL supplier import UI
│
├── index.html, css/, js/, images/   # The public marketing site (Vercel-hosted)
├── vercel.json                  # Only rule: proxies /flooring/* to the Railway API
│
└── PROJECT_CONTEXT.md, MASTER_CHECKLIST.md, WYC-Backend-Technical-Audit.md
                                  # PROJECT_CONTEXT.md is archived (see its own banner) — MASTER_CHECKLIST.md
                                  # is the actively-maintained task list. WYC-Backend-Technical-Audit.md is
                                  # a dated historical snapshot (7 Jul 2026), also archived.
                                  # Read MASTER_CHECKLIST.md before assuming anything below
                                  # is still accurate months from now.
```

---

## Admin API — two URL prefixes, one route tree

There are two admin-facing URL prefixes, kept separate for organizational reasons (they were
historically built at different times, by different sessions) rather than any technical requirement —
but as of 1 Aug 2026 (5A consolidation, all 5 steps complete) both live under `src/`, not split across
two different directory trees the way they used to be:

| Feature | Live route | File |
|---|---|---|
| Leads, dashboard, calendar, booking, CSV export | `/api/admin/*` | `src/routes/authGuard.js` → `src/controllers/adminController.js` |
| Login, products, offers | `/api/panel/*` | `src/routes/panel.js` → `src/controllers/adminAuthController.js` + `src/controllers/productAdminController.js` |
| Supplier scraping/import | `/api/panel/*` | `src/routes/import.js` → `src/controllers/importController.js` |

**Historical note, no longer a live risk:** until 1 Aug 2026, this section carried a strong warning —
these were genuinely two separate route trees, one under `routes/` and one under `src/`, both live, and
it was easy to mistake one for dead code. That risk is gone now that `routes/` doesn't exist. Along the
way, two real duplications were found and removed, not left for later:
- `routes/panel.js`'s own second, unused copy of the leads/dashboard/calendar endpoints (dead code
  the frontend never called) — removed 31 Jul 2026 (PR #32).
- A second, behaviourally-different `POST /products/:id/like` that lived in `routes/panel.js`
  (unauthenticated, always-increment, no unlike) alongside the real one (unauthenticated, like/unlike
  toggle) — removed 1 Aug 2026 as part of the products migration (5A step 2).

---

## Quick Start — Local Development

### Prerequisites
- Node.js 20+ (`node -v`) — `package.json`'s `engines.node` requires `>=20.0.0`
- npm 9+ (`npm -v`)
- A PostgreSQL database you can connect to — **this project requires Postgres, there is no other
  option.** For local dev, the simplest path is usually a Railway Postgres instance (even the same one
  your deployed app uses) rather than installing Postgres locally.

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Fill in .env — at minimum, you need:
#    PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD  — your Postgres connection
#    JWT_SECRET      — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#                       (the server will refuse to start without this — it's the admin login secret)
#    ALLOWED_ORIGIN  — the exact origin of your frontend, e.g. http://127.0.0.1:5500

# 4. Start the server
npm run dev
```

The API is now running at **http://localhost:3001**. The database schema is created/updated
automatically on this first boot — there's no separate manual "initialise the database" step. If you
just want to confirm your Postgres connection is working without starting the full server, use
`npm run db:init` (this only checks and lists existing tables — it doesn't create anything).

Open the frontend (`index.html`) via a local static server (e.g. VS Code's Live Server extension) and
submit the contact form to test the integration end to end.

**⚠️ Local dev currently talks to production by default.** `js/form-handler.js`, `js/catalogue.js`, and
`js/product-page.js` all hardcode the live Railway API URL rather than reading it from configuration —
a known, tracked issue (`MASTER_CHECKLIST.md` 3A). Until that's fixed, testing the frontend locally
means real form submissions go to the real production database unless you manually, temporarily edit
those files — and remember to revert before committing.

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |
| POST | `/api/leads` | Submit a new lead enquiry |
| GET | `/api/products` | Public product catalogue |
| GET | `/flooring/:category/:slug` | Server-rendered product page (SEO) |

#### POST /api/leads — Request Body

```json
{
  "name":             "Jane Smith",
  "email":            "jane@example.com",
  "phone":            "07700 900000",
  "postcode":         "LS1 1AA",
  "service_type":     "Carpet Fitting",
  "message":          "I need a quote for my living room and hallway.",
  "gdpr_consent":     true,
  "room_length_m":    4.5,
  "room_width_m":     3.2,
  "flooring_type":    "carpet_premium",
  "include_underlay": true,
  "include_fitting":  false,
  "estimated_cost":   144.00
}
```
`email` is optional; everything else marked in `src/middleware/validate.js` is required. UK phone
numbers and postcodes are validated with real format-specific regex, not just "is this a string."

#### POST /api/leads — Response (201 Created)

```json
{ "success": true, "message": "Thank you! We'll be in touch within 24 hours.", "reference": "A3B2C1D4" }
```

#### POST /api/leads — Validation Error (422)

```json
{
  "success": false,
  "error":   "Please check the highlighted fields and try again.",
  "fields":  [{ "field": "phone", "message": "Please enter a valid UK phone number." }]
}
```

---

### Admin Authentication

There is **no bearer-token auth** — admin access is JWT-based, obtained by logging in:

```bash
curl -X POST http://localhost:3001/api/panel/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'
```
Returns `{ "token": "...", "username": "...", "role": "..." }`. The token expires after 8 hours.
Use it on every subsequent admin request:
```
Authorization: Bearer <token>
```

### Admin Endpoints — `/api/admin/*` (leads, dashboard, calendar)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Summary stats |
| GET | `/api/admin/leads` | List leads (paginated) |
| GET | `/api/admin/leads/:id` | Single lead + audit log |
| GET | `/api/admin/leads/export.csv` | Download all leads as CSV |
| PATCH | `/api/admin/leads/:id/status` | Update lead status |
| PATCH | `/api/admin/leads/:id/booking` | Update booking details |
| GET | `/api/admin/calendar` | Calendar/booking view |
| DELETE | `/api/admin/leads/:id` | Anonymise lead (GDPR) |
| DELETE | `/api/admin/leads/:id?hard=true` | Permanently delete |

**Lead status lifecycle** (`src/controllers/adminController.js`):
```
new → contacted → quoted → won
                         → lost
         (any) → spam
```

### Admin Endpoints — `/api/panel/*` (login, products, offers, import)

| Method | Path | Description |
|---|---|---|
| POST | `/api/panel/login` | Get a JWT (see above) |
| GET/POST/PUT/PATCH/DELETE | `/api/panel/products` | Product CRUD |
| GET/POST/DELETE | `/api/panel/offers` | Offers/deals CRUD |
| POST | `/api/panel/scrape-family` | Scrape one supplier product URL |
| POST | `/api/panel/scrape-bulk` | Scrape up to 50 URLs, streamed results |
| POST | `/api/panel/import-family` | Import a reviewed product into the catalogue |

The import step refuses to save any colour whose name still exactly matches the scraped supplier's
original name — a deliberate safety check, not a bug, so a supplier's branding can never accidentally
reach a live customer-facing product.

**Supported suppliers for scraping** (`src/services/suppliers/`): Carpet Line Direct, Cormar, Victoria,
Woodpecker, Karndean, Quick-Step. Each is a small plugin implementing a common shape — adding a new
supplier means adding one new plugin file, not changing the scraping logic itself.

---

## Email Notifications

Two emails exist and are both wired up: an admin notification on every new lead, and a customer
confirmation (added 25 Jul 2026 — if you're reading an older summary that says this isn't hooked up,
that's now out of date).

```env
MAIL_ENABLED=true
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_login
SMTP_PASS=your_smtp_key
MAIL_FROM="West Yorkshire Carpets <your@verified-sender.com>"
MAIL_TO=where_you_want_new_lead_alerts@example.com
```

`MAIL_FROM` must be an address your email provider has verified you control — providers reject sending
"from" an address they haven't confirmed belongs to you.

**⚠️ If you're hosting on Railway's Free/Trial/Hobby plan, standard SMTP sending will not work at
all, regardless of host/port/credentials.** Railway blocks outbound SMTP entirely on those plans as an
anti-spam measure (their own documentation confirms this) — it isn't a configuration problem, no
combination of settings fixes it. Either upgrade to Railway's Pro plan, or send via your provider's
HTTPS API instead of SMTP (Brevo, SendGrid, and most providers offer both — the HTTPS route works on
every Railway plan). If email still isn't sending after checking `MAIL_ENABLED` and your credentials,
this is almost certainly why — check your Railway plan before anything else.

---

## Deployment

**Current live URLs — both confirmed reachable directly, 1 Aug 2026. Both explicitly temporary:**
- Frontend: **https://easyflooring.vercel.app**
- Backend/admin: **https://wyc-backend-production-ed78.up.railway.app** (admin panel at `/admin`)

Neither is a final destination — there's no domain registered yet (see the honesty note at the top).
Don't remove or "clean up" either URL from anywhere in the codebase on the assumption it's a placeholder;
they're the real, live, currently-in-use infrastructure until a domain and business name are settled.

**The API** (`server.js` and everything it needs) runs on **Railway**, auto-deploying from `main`. **The
static frontend** (`index.html`, `css/`, `js/`, `images/`) is hosted separately on **Vercel**, also
auto-deploying from `main` — the two are connected via CORS (`ALLOWED_ORIGIN`, confirmed currently set to
`https://easyflooring.vercel.app,https://wyc-backend-production-ed78.up.railway.app`) and `vercel.json`'s
single rewrite rule, which proxies `/flooring/*` requests through to the Railway API for server-rendered
product pages.

**⚠️ Known live bug, not just a documentation issue (found 1 Aug 2026):** both `index.html` and
`src/routes/products-seo.js` still hardcode/default to `https://www.westyorkshirecarpets.com` — a domain that
returns a 404, confirmed by direct fetch — for canonical URLs, `og:image`, Twitter cards, and JSON-LD
business schema. `SITE_URL` (used by `products-seo.js` for exactly this) isn't currently set on Railway
at all, so it falls back to that same dead domain. Low real-world urgency *specifically because* nothing
is being promoted or shared publicly yet — but this needs fixing (either point everything at
`easyflooring.vercel.app` for now, or leave it broken deliberately until a real domain exists — that's a
product decision, not one this document should make) before any real launch. Tracked in
`MASTER_CHECKLIST.md`, not fixed as part of this documentation pass.

If you're setting this up fresh:
1. **Railway:** connect the GitHub repo, set the environment variables from `.env.example`, deploy.
   Railway sets `PORT` automatically.
2. **Vercel:** connect the same GitHub repo as a separate project, no build step needed (static files).
   Set `ALLOWED_ORIGIN` on Railway to include the resulting `*.vercel.app` URL (or your real domain,
   once one's attached).

A traditional VPS + PM2 + Nginx setup would also work (the app has no Railway-specific code) but isn't
what's actually deployed today, and isn't documented in detail here to avoid describing an untested path
as if it were the real one.

---

## Security Summary

| Threat | Defence |
|---|---|
| SQL Injection | Parameterized queries throughout — no string-concatenated SQL anywhere in the codebase |
| XSS | Helmet CSP headers + `express-validator` `.escape()` on free-text fields |
| CSRF | **Not implemented as a dedicated mechanism** — see note below |
| Spam / Bots | Honeypot field + rate limiting (5 lead submissions per 15 min per IP) |
| Brute Force | Separate rate limiter on admin login (10 attempts per 15 min) + general 60/min API limiter |
| Info Leakage | Generic error messages, logged internally in full — consistent across every controller as of 1 Aug 2026 (5A steps 2-4 closed the last of the raw-error-text leaks that used to exist in `routes/panel.js`/`routes/products.js`/`routes/scraper.js`, all now migrated into `src/`) |
| IP Privacy | Last IP octet (v4) truncated before storage |
| GDPR Article 17 | Soft anonymisation preserves aggregate stats, removes PII |

**On CSRF specifically:** a real double-submit-cookie implementation was built, tested, and merged on
11 Jul 2026 — then reverted the same day after real-world testing showed it broke lead submission for
Safari users with default privacy settings (Safari blocks the cross-domain cookie the pattern needs,
since the frontend and API are on different domains). That was the right call given the constraint, not
a mistake. Current protection against forged cross-site submissions relies on the CORS origin allow-list
instead. The vestigial `GET /api/csrf-token` route and its unused `csrfTokenGenerator` middleware
have been removed (`MASTER_CHECKLIST.md` 0.5-D, closed).

**Known, currently-open gaps in this area:** none as of 1 Aug 2026 — the last one tracked here
(`routes/panel.js` using synchronous `bcrypt` calls on the request path) was fixed as part of migrating
that file into `src/` (5A step 3, see `MASTER_CHECKLIST.md`).

**Dependency health:** `npm audit` reported zero vulnerabilities as of 26 Jul 2026. A previously-flagged
high-severity issue in the `sharp` package was resolved by removing the dependency entirely (it was
confirmed 100% unused, so this closed the vulnerability outright rather than needing a breaking-change
`npm audit fix --force`); two smaller `body-parser`/`morgan` advisories were fixed via a plain, non-breaking
`npm audit fix`. Re-run `npm audit` periodically — this reflects a point in time, not a permanent guarantee.

---

## GDPR Compliance Notes

- Minimal data collection: only fields actually needed for the service are requested
- Consent is recorded with a timestamp, not just a boolean
- Right to erasure: `DELETE /api/admin/leads/:id` anonymises PII by default; `?hard=true` permanently
  deletes
- IP addresses are truncated before storage, never kept in full
- Every admin action affecting a lead is audit-logged (actor, action, IP, timestamp) for accountability

---

## Known Gaps (honest, not exhaustive — see MASTER_CHECKLIST.md for the full, current list)

- **Automated test coverage is real but thin, not zero.** `src/tests/leads.test.js` (PR #34) is a genuine
  integration test against an in-memory Postgres, covering the valid- and invalid-submission paths for
  `POST /api/leads`. `src/tests/urlSafety.test.js` covers the SSRF guard. Everything else — admin login,
  product CRUD, the honeypot field, the SEO product pages — has no test coverage yet. A schema-drift bug
  in the `audit_log` table shipped silently for months in 2026 before the first of these tests existed;
  that specific class of bug is now caught, most others still aren't.
- **`migrate-auto.js` runs a large idempotent block on every server boot** rather than using a real
  migration tool with version tracking. Works today because it's disciplined about
  `IF NOT EXISTS` everywhere, but has no down-migrations and already has one confirmed case of drift
  between what it creates and what production's database actually has.
- **`admin/index.html` is still a large single file** (~2,400 lines, down from ~4,000 after a partial
  split). The remaining split is deliberately deferred until a planned admin panel redesign happens, so
  it isn't done twice.
- **`.vercel/README.txt` is tracked in git despite `.gitignore` excluding `.vercel/`** — it was committed
  before that ignore rule was added, so it wasn't retroactively removed. Harmless, but it's leftover
  debris from an earlier Vercel-for-everything setup that predates the current Vercel-site/Railway-API
  split; safe to `git rm` whenever someone's doing general housekeeping.
- **Dead-domain references baked into live output** — see "Deployment" above for the full detail.
  `index.html`'s SEO meta tags and `src/routes/products-seo.js`'s `SITE_URL` fallback both currently point at
  a domain that 404s. Not urgent while nothing's being publicly promoted, but needs fixing before launch.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3001` | Server port (Railway sets this automatically in production) |
| `ALLOWED_ORIGIN` | Yes | — | Frontend origin(s), comma-separated, no trailing slash |
| `DB_TYPE` | No | `postgres` | Must be `postgres` — the only supported value |
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` | Yes | — | PostgreSQL connection |
| `JWT_SECRET` | **Yes** | — | Admin login secret. **Server refuses to start without this.** |
| `ADMIN_DEFAULT_PASSWORD` | No | — | Used only by `migrate-auto.js`'s initial admin seed and `npm run admin:reset-password` |
| `MAIL_ENABLED` | No | `false` | Enable admin notification + customer confirmation emails |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | No | — | Required if `MAIL_ENABLED=true`. See the Railway SMTP-blocking note above. |
| `MAIL_FROM` / `MAIL_TO` | No | — | Sender/recipient for notification emails |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Only if using the scraper | — | Required for `/api/panel/scrape-*` and `/import-family`'s image upload step |
| `SITE_URL` | No | — | Used for SEO product pages, canonical URLs, sitemap generation. **Confirmed not currently set on Railway (1 Aug 2026)** — falls back to a hardcoded dead domain, see the Deployment section's known-bug note. Should be set to `https://easyflooring.vercel.app` until a real domain exists |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | No | `5` / `900000` | Lead-submission rate limit |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |

**Set on Railway but confirmed to do nothing (1 Aug 2026):** `CACHE_BUST` is set in the production
environment but has zero references anywhere in this codebase — grepped directly, no matches. Almost
certainly a leftover from a manual "change an env var to force a redeploy" trick rather than something
the app reads. Harmless; safe to remove from Railway whenever someone's doing general housekeeping, or
just as safe to leave alone.

**Variables listed in `.env.example` that don't currently do anything:** `SESSION_SECRET` and
`ADMIN_TOKEN` are both present in `.env.example` but confirmed (by grep, zero hits) to never be read
anywhere in the actual code. Both are also confirmed actually *set* on Railway (not just present in the
example file) — still inert either way. Harmless to leave as-is; not worth removing or generating new
values for.

---

## npm Scripts

| Script | Command | Notes |
|---|---|---|
| `start` | `node server.js` | Production start |
| `dev` | `nodemon server.js` | Auto-restarts on file changes |
| `db:init` | `node src/config/initDb.js` | Read-only connection check — lists existing tables, creates nothing |
| `db:seed` | `node seed-products.js` | **Dev only** — inserts placeholder products with Unsplash image URLs. Never run against production. |
| `admin:reset-password` | `node scripts/reset-admin-password.js` | Resets the `admin` user's password to `ADMIN_DEFAULT_PASSWORD` from `.env` |
| `test` | `node --test src/tests/leads.test.js src/tests/urlSafety.test.js` | Real integration + unit tests (PR #34, #38) — not placeholders. See Known Gaps for what's still uncovered |
| `db:drop-audit-details-column` | `node scripts/drop-audit-log-details-column.js` | One-off, deliberately **not** part of `migrate-auto.js` (that script only ever does safe additive changes). Drops `audit_log.details` (plural) — confirmed dead, distinct from the actively-used `audit_log.detail` (singular). Reports row counts before dropping; safe to run more than once |

`scripts/generate-hash.js` (not wired into `package.json`) prints a bcrypt hash of
`ADMIN_DEFAULT_PASSWORD` for cases where you need to set an admin password by hand via a database
console rather than through the reset script above.

---

## Maintenance

```bash
# View live logs (Railway)
railway logs

# Check your Postgres connection without starting the full server
npm run db:init

# Reset the admin password
npm run admin:reset-password

# Check for known dependency vulnerabilities
npm audit
```
