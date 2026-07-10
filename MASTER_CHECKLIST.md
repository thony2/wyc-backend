# WYC — Master Checklist
**How to use this:** Work top to bottom. Never skip a phase.
Mark each item [ ] → [x] when complete.
Each item has a reference to the file(s) affected.

> **Updated 7 Jul 2026** following a full technical audit after the dormant period (30 May – 5 Jul).
> Changes from the May version: stale file-path references corrected (`routes/admin.js` → `routes/panel.js`,
> `src/routes/admin.js` → `src/routes/authGuard.js`), items verified as actually complete are now checked,
> one item that was marked done but wasn't is corrected, and a new **PHASE 0.5** section captures issues
> found in the audit that weren't previously documented. See `WYC-Backend-Technical-Audit.md` for full detail
> and reasoning behind each new item.
>
> **Updated again 10 Jul 2026.** Most of 0.5-A and 0.5-B are now done (SQLite dropped, products-seo.js fixed,
> dead files removed — see the individual items below for what's left). A second, independent audit was run
> by a separate session that day and cross-checked against this one; every one of its claims was independently
> re-verified against the actual code (and in one case, the actual live database) before being folded in here
> — see 0.5-H for the one genuinely new critical finding it caught that this checklist had missed, plus a
> few smaller items added to Phase 5 below. `WYC-Backend-Technical-Audit.md` is now actually committed to
> the repo (it previously wasn't, despite being referenced above — the second audit caught that too).
>
> **Golden rule for this phase of work: the live site currently works. Every item below is sequenced so that
> nothing is done directly on `main`. Branch → fix → verify locally → PR → merge. If a fix can't be verified
> locally, it gets a manual verification step on staging/production immediately after merge, called out explicitly.**

---

## PHASE 0 — Environment Setup
*Must be complete before any development work.*

- [x] Backend runs locally: `npm run dev` → http://localhost:3001 *(Postgres only — SQLite support was dropped entirely, see 0.5-A)*
- [x] Frontend runs locally: Live Server → http://127.0.0.1:5500
- [x] Admin panel accessible and login works
- [x] Railway PostgreSQL connected (production DB)
- [x] .env file has all required variables (see PROJECT_CONTEXT.md §5)
- [x] package-lock.json committed to repo
- [x] .env.example updated with all current variables including CLOUDINARY_*
- [x] netlify.toml deleted

---

## PHASE 0.5 — Audit Findings (7 Jul 2026)
*New section. Work this before Phase 1 — several Phase 1 items assume these are fixed.
Every item here is a branch-sized, single-purpose PR, matching the commit convention below.*

### 0.5-A — Critical: database configuration ✅ DONE (10 Jul 2026)
- [x] **Decide SQLite's fate** → decided: dropped formally, production has always been Postgres-only
- [x] `src/config/database.js` — `createSQLiteConnection()` removed; `getDatabase()` now throws a clear
      startup error if `DB_TYPE=sqlite` is ever set, instead of booting and failing confusingly later
      → `chore/drop-sqlite-support`
- [x] `src/config/schema.sql` deleted
- [x] `better-sqlite3` removed from `package.json`
- [x] `.env.example` updated — `DB_TYPE=postgres` is now the shown default, `SQLITE_PATH` removed
- [x] `README.md` — architecture tree and env var table corrected
      *(note: the older "Deploying / migration" section further down the README, describing converting
      schema.sql to Postgres, is now describing something that already happened years ago and reads as
      out of date — not fixed in this pass, flagged for the eventual README overhaul in 5E)*
- [x] `routes/products-seo.js` — now imports the shared `src/config/database.js` connection instead of its
      own separate pool → `fix/products-seo-shared-db-pool`
- [x] `src/config/initDb.js` — **bonus fix found while doing this work**: this script was *also* broken
      under Postgres (it queried `sqlite_master`, a SQLite-only system table, and called `.all()`
      synchronously on what would actually be a Promise). Rewritten to check the Postgres connection via
      `information_schema.tables` instead — `npm run db:init` is now a genuinely working connection check.
- [x] Verified: fresh `.env`, `npm run dev`, submitted a real lead through the live form — worked, no errors

### 0.5-H — Critical: `audit_log` schema drift ✅ DONE (10 Jul 2026)
*New item, not in the 7 Jul list — found by a second, independent audit and verified here before acting on it.*

`migrate-auto.js` created `audit_log` with columns `(id, lead_id, user_id, username, action, table_name,
record_id, details, created_at)`. But `leadController.js`, `adminController.js`, and `routes/panel.js` all
read/write `actor`, `detail`, and `ip_address` — none of which the script ever created, going back to the
very first commit.

**Verification before fixing (don't just trust an audit — check it):**
- Confirmed the column mismatch directly against the current code (not the audit's word for it)
- The claim that this was *currently* breaking live lead submission turned out to be **wrong** — a real,
  read-only query against the actual production database showed `actor`, `detail`, and `ip_address` already
  present (added by hand at some point, outside of any migration — hence `details` **and** `detail` both
  existing, one of them now dead code). So this was not an active outage; it was a landmine for the next
  time this database needs to be rebuilt from scratch.
- [x] `migrate-auto.js` — added the three missing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` lines, matching
      the file's existing pattern. No-op on the current database; prevents the exact crash a from-scratch
      Postgres instance would otherwise hit on the very first lead submission → `fix/audit-log-missing-columns`
- [ ] **Not done, worth doing:** the original `details` (plural) column is now confirmed dead — nothing reads
      or writes it. Don't drop it yet (removing a column deserves more certainty than this pass needed) —
      revisit once you're confident nothing else (an export, a report) quietly depends on it.
- [ ] **Not done, worth doing:** add one real integration test that POSTs to `/api/leads` and asserts `201`
      — this exact bug is precisely what a single test like that would have caught on day one. See 5C.

### 0.5-B — Critical: dead / broken repo artefacts (zero behavioural risk — safe to do anytime, independent of 0.5-A)
- [x] ~~Delete root-level `panel.js`~~ → done in this session, see `chore/remove-dead-panel-js`
      → It was an unreferenced duplicate of `routes/panel.js` left over from the `routes/admin.js` → `panel.js`
        rename. `server.js` only ever loads `routes/panel.js`. Confirmed nothing else required it.
- [x] ~~Remove broken orphaned git submodule at `wyc-backend`~~ → done in this session, see `chore/remove-broken-submodule`
      → Leftover from an accidental nested-copy that was reverted (`fe1ecc3` / `46681af`). No `.gitmodules`
        entry backs it; it's dead weight only. Confirmed the working tree contains no files there.

### 0.5-C — High: broken/missing npm scripts
- [ ] `db:seed` script points to `src/config/seedDb.js`, which doesn't exist
      → Check first whether `seed-products.js` (repo root) already does this job — if so, point the script
        there instead of writing a new file; if not, decide what "seeding" should mean and implement it
- [ ] `admin:reset-password` script referenced by `scripts/reset-admin-password.js`'s own header comment
      is **not** in `package.json` (the May checklist marked this "done in session" — it wasn't; add it now:
      `"admin:reset-password": "node scripts/reset-admin-password.js"`)

### 0.5-D — High: CSRF — decision needed
- [ ] `README.md`'s Security Summary still lists CSRF double-submit-cookie protection as active. It isn't —
      commits `b7dda53`/`3bfe28e` removed the validating middleware, relying on the CORS allow-list instead.
      `GET /api/csrf-token` still exists and issues a token that nothing checks.
      → **Decide:** (a) formally adopt CORS-only and update the README + delete the now-pointless
        `/csrf-token` route and `csrfTokenGenerator`, or (b) restore real CSRF validation per the original
        Phase 5B plan below. Either is defensible for a same-origin JSON API — just pick one and make the
        code and docs agree.

### 0.5-E — High: audit-log IP gap in the legacy layer
- [ ] `routes/panel.js`'s local `audit()` helper hardcodes the IP parameter to `null` for every product/offer/
      login action. `src/controllers/adminController.js`'s separate `audit()` already does this correctly —
      mirror that implementation into `routes/panel.js` (same fix noted below in 1F, duplicated here because
      it's a real audit-trail gap, not just a UX nicety)

### 0.5-F — Medium: ops scripts don't run anywhere but one old laptop
- [ ] `scripts/backup.sh`, `scripts/check-leads.sh`, `scripts/check.sh` hardcode
      `/Users/potencial/Desktop/project/wyc-backend/...` and query the SQLite file directly — but production
      is Postgres-only. Either rewrite them against Postgres (`pg_dump` for backup, a `db.query` call for
      check-leads) with a relative/env-driven path, or delete them if Railway's managed Postgres backups
      already cover this and they're not actually used

### 0.5-G — Medium: other hygiene
- [ ] `.vercel/README.txt` is committed despite `.vercel/` being in `.gitignore` — `git rm --cached .vercel/README.txt`
- [ ] `og:image` still missing (see 3A below — already tracked, just cross-referencing)
- [ ] `npm test` still only runs a placeholder assertion — see 5C below

---

## PHASE 1 — Admin Portal: Logic & Code Quality

### 1A — Scraper / Import Catalogue (HIGHEST PRIORITY)
*Goal: Zero supplier branding in any imported product.*

- [ ] routes/scraper.js — Remove supplierName from all API responses
      → The /api/panel/scrape-family response must not include supplier name
- [ ] routes/scraper.js — Auto-generated description must not include supplier name
      → Description field should be empty or generic ("Premium carpet, [style] pile")
- [x] routes/scraper.js — Use shared db from src/config/database.js *(confirmed done — no longer has its own `new Pool()`)*
- [ ] admin/index.html — Remove "Supplier Name" column from colour variants table
      → Section: Import Catalogue → Step 3 "Colour variants"
- [ ] admin/index.html — Description field starts empty, not pre-filled with supplier text
- [ ] admin/index.html — "WYC Product Name" is the only name field visible
- [ ] **Test: Import a product from carpetlinedirect.co.uk → verify zero supplier references**
      → ⚠️ Two separate commits (`4a130c7`, `714c7b5`) with the identical message
        "fix: remove supplier branding from import catalogue" exist in history — the first attempt
        apparently didn't stick. Re-verify this end-to-end before your next real supplier import.

### 1B — Database Connection Consolidation
*Goal: One connection pool, used everywhere.*

- [x] routes/scraper.js — Same as above (covered in 1A)
- [ ] routes/products-seo.js — Remove standalone `new Pool()` — use shared db *(now tracked as 0.5-A — do it there, checked off here once done)*
- [ ] Verify: Only ONE pool is created at startup (check logs show single "PostgreSQL connected")

### 1C — Migrate-auto cleanup
*Goal: Migrations don't run on every server start.*

- [ ] Create scripts/migrations/ folder with numbered SQL files
      → 001_initial_schema.sql, 002_add_product_columns.sql, etc.
- [ ] Create scripts/migrate.js — simple runner that executes SQL files in order
      → Tracks which migrations have run in a `_migrations` table
- [ ] Add to package.json scripts: `"db:migrate": "node scripts/migrate.js"`
- [ ] Remove `require('./migrate-auto')(db)` from server.js
- [ ] Delete migrate-auto.js
- [ ] Test: Fresh server start shows no migration output, just "Listening on port X"

### 1D — Admin Security
*Goal: Admin password never in source code.*

- [x] scripts/generate-hash.js created
- [x] scripts/reset-admin-password.js created
- [x] migrate-auto.js — Admin seed reads from env var, not hardcoded string *(confirmed fixed — reads `ADMIN_DEFAULT_PASSWORD`, commits `8a4169f`/`8e19fe9`)*
- [x] Add ADMIN_DEFAULT_PASSWORD to .env.example with a placeholder value
- [ ] Verify: `git log --all -S "Admin@WYC2026"` returns no results *(run this yourself — I didn't find the string in the current tree, but you should confirm it's gone from history too, not just HEAD)*
- [ ] Add the missing `admin:reset-password` npm script (see 0.5-C)

### 1E — Admin Panel: Split the monolith
*Goal: admin/index.html split into maintainable files.*
*Status: still 3,663 lines, unchanged since May — no sub-items started.*

- [ ] Create admin/css/admin.css — extract all <style> blocks from admin/index.html
- [ ] Create admin/js/admin-auth.js — login, logout, JWT storage, requireAuth guard
- [ ] Create admin/js/admin-leads.js — leads table, filters, status updates, export CSV
- [ ] Create admin/js/admin-products.js — product grid, add/edit modal, hide/delete
- [ ] Create admin/js/admin-import.js — scraper UI, colour variant editor, import flow
- [ ] Create admin/js/admin-offers.js — deals & offers section
- [ ] Create admin/js/admin-calendar.js — calendar view and booking management
- [ ] Create admin/js/admin-ui.js — shared utilities (toast, modals, formatters)
- [ ] Update admin/index.html — replace all inline <style> and <script> with file references
- [ ] Verify: admin/index.html is under 300 lines after extraction
- [ ] Delete admin/images/ — duplicate of root images/ folder
      → Update admin/index.html logo src to ../images/logo.svg

### 1F — Admin UX Improvements
*Goal: Faster, clearer workflow for managing products and leads.*

- [ ] Products page — Add category filter persistence (remembers last selected tab)
- [ ] Products page — Bulk select + bulk delete/hide
- [ ] Import page — Show clear error when URL is not a supported supplier
- [ ] Import page — Progress indicator during Cloudinary upload (not just a spinner)
- [ ] Import page — Preview images before confirming import
- [ ] Leads page — Click anywhere on row to open lead detail (not just the name)
- [ ] Leads page — Quick-reply WhatsApp link from lead row (opens wa.me/447449... with pre-filled message)
- [ ] Audit log — Record IP address on every admin action
      → Fix: `null` → real IP in **`routes/panel.js`** `audit()` function *(file corrected — was
        mis-referenced as `routes/admin.js` in the original checklist; see 0.5-E, same underlying issue)*
- [ ] Settings page — Change password enforces minimum 12 characters (currently 8)

---

## PHASE 2 — Content: Real Products

### 2A — Populate the catalogue
*Goal: Minimum viable catalogue for SEO and conversion.*

- [ ] Carpets — import minimum 12 products from suppliers
- [ ] Vinyl — import minimum 8 products
- [ ] Laminate — import minimum 6 products
- [ ] Wood — import minimum 4 products
- [ ] Each product has: own brand name, description, correct price, correct category
- [ ] Each product has: room suitability checked, features checked
- [ ] Each product has: at least one high-quality image (not placeholder)
- [ ] Each colour variant has a WYC brand name (no supplier colour names visible)
- [ ] At least 3 products marked as "Featured" for homepage display
- [ ] At least 2 active deals created in Deals & Offers

### 2B — Brand naming
- [ ] Define your brand collection names (e.g. "The Heritage Collection", "The Urban Range")
- [ ] All products assigned to a collection name — no supplier names anywhere
- [ ] Document your margin formula (cost price → selling price) somewhere private

---

## PHASE 3 — Website: Public-facing pages

### 3A — Quick wins (no redesign needed, fix in hours)
- [ ] Create images/og-image.jpg (1200×630px branded image)
      → Referenced in every OG/Twitter meta tag — currently missing → broken social shares
- [ ] Configure Google Analytics 4
      → Replace G-XXXXXXXXXX in index.html with real Measurement ID
      → Create GA4 property at analytics.google.com if not done
- [ ] Remove hardcoded Railway URL — currently in **`js/form-handler.js`, `js/catalogue.js` (3 call sites),
      and `js/product-page.js`** *(product-page.js wasn't in the original list — audit found a 4th file)*
      → Replace with one shared config (e.g. a single `js/config.js` exposing `window.WYC_CONFIG.apiBase`,
        loaded before the other scripts on every page that needs it)
- [ ] Fix broken npm scripts in package.json
      → db:seed: point to correct file or delete (see 0.5-C)
      → admin:reset-password: add it (see 0.5-C)
      → test: currently a placeholder, not broken — see 5C for real coverage
- [ ] Fix "licence" typo → "license" in package.json
- [ ] Remove express-session from dependencies (not used) *(verify still present — audit didn't find it in current package.json, may already be gone; check before spending time here)*
- [ ] Remove undici from dependencies (duplicate of axios) *(same — verify first, audit didn't find it in current package.json)*

### 3B — Catalogue as standalone page
*Goal: /catalogue.html is a real page, not a modal.*

- [ ] Create catalogue.html (see CATALOGUE_HTML_CHANGES.md output from earlier)
- [ ] Update js/catalogue.js — page mode (see CATALOGUE_JS_CHANGES.md)
      → init() reads URL params instead of looking for overlay
      → setCategory() updates URL with history.pushState
      → Product card click → navigate to /flooring/:category/:slug
      → enquireAbout() → navigate to /?product=X#contact
      → requestSample() → navigate to /?sample=X#contact
      → Remove open(), close(), lockScroll(), unlockScroll(), bindTriggers()
- [ ] Update index.html
      → All data-catalogue="X" links → href="catalogue.html?category=X"
      → Remove entire #cat-overlay HTML block
      → Remove catalogue.css link (catalogue.html loads it)
      → Remove catalogue.js script tag
      → Remove jspdf script tag (only needed on catalogue page)
      → Add URL param reader script for contact form pre-fill
- [ ] Verify: clicking Carpets in nav opens catalogue.html?category=carpets
- [ ] Verify: clicking a product opens /flooring/carpets/product-slug
- [ ] Verify: clicking Enquire on catalogue → goes to homepage contact form pre-filled

### 3C — Product page improvements
*Goal: SSR product page converts visitors into leads.*

- [ ] Review current product page output from routes/products-seo.js
- [ ] Add breadcrumb navigation (Home → Category → Product name)
- [ ] Ensure CTA "Book Free Measure" is prominent above the fold
- [ ] Add "Back to catalogue" link
- [ ] Verify JSON-LD structured data is correct per product
- [ ] Verify meta title/description is unique per product

### 3D — Landing page redesign
*Goal: Clean, fast, high-converting homepage.*

- [ ] Hero — new headline and subheadline copy
- [ ] Hero — replace 212.png with optimised WebP hero image *(6.8MB currently — see 0.5-G / audit M-4)*
- [ ] Features strip — review copy, ensure accurate
- [ ] Flooring range section — cards link to catalogue.html?category=X
- [ ] Deals section — pull real deals from API (not hardcoded HTML)
- [ ] Calculator — verify all pricing rates are current
- [ ] Gallery — replace placeholder images with real installation photos
- [ ] TikTok grid — replace static PNG screenshots with real embed or iframe
- [ ] Contact form — add success state with clear next steps message
- [ ] Footer — verify all links work

### 3E — SEO technical
- [ ] Submit sitemap to Google Search Console
- [ ] Verify /flooring/sitemap.xml returns valid XML with real product URLs
- [ ] Verify all product pages indexed by Google (Search Console coverage report)
- [ ] Add robots.txt entry blocking /api/* if not already done (it is — verify)
- [ ] Ensure canonical URLs are correct on catalogue.html and product pages
- [ ] Page speed test (PageSpeed Insights) — score above 85 on mobile
      → Note: several source images are 2–8MB (audit M-4) — this will likely fail until 3D's image work is done

---

## PHASE 4 — Automation & Lead Management

### 4A — Email automation
- [ ] Enable MAIL_ENABLED=true in Railway variables
- [ ] Configure SMTP credentials (Brevo/SendGrid recommended — free tier)
- [ ] Test: submit lead → customer receives confirmation email within 60 seconds
- [ ] Test: submit lead → owner receives notification email with lead details
- [ ] Email template — customer confirmation: professional, branded, sets expectations
- [ ] Email template — owner notification: includes name, phone, postcode, service, message
- [ ] (Future) Email template — lead follow-up at 3 days if no status change

### 4B — Lead workflow improvements
- [ ] Add "Assign to installer" field on lead detail
- [ ] Add notes field per lead (internal notes, not visible to customer)
- [ ] WhatsApp quick-reply button per lead (pre-filled message with customer name + service)
- [ ] Status change triggers email notification (e.g. "Quoted" → email customer with quote)
- [ ] Export leads to CSV works correctly (verify all fields export)

---

## PHASE 5 — Code Quality & Security

### 5A — Architecture consolidation
*Goal: One routing system, one DB pool, clean separation of concerns.*

- [ ] Migrate all functionality from **`routes/panel.js`** → src/controllers/ + src/routes/
      *(file name corrected — this was `routes/admin.js` before the July rename commits)*
- [ ] Migrate all functionality from routes/products.js → src/controllers/
- [ ] Remove routes/ directory entirely
- [ ] Verify: server.js only imports from src/
- [ ] Update server.js route mounts to match new structure
- [x] ~~Remove migrate-sqlite-local.js~~ → done as part of dropping SQLite entirely, see 0.5-A
- [ ] **New (from second audit, 10 Jul):** three separate, near-identical copies of a `requireAuth` JWT
      middleware exist — `src/routes/authGuard.js`, `routes/panel.js`, `routes/scraper.js` — confirmed by
      direct grep, not just the audit's word for it. Any future change to auth behaviour (token refresh,
      role checks, revocation) has to be made in three places and will drift. Consolidate into one shared
      middleware as part of this same routing consolidation, rather than as a separate task later.

### 5B — Security hardening
- [ ] CSRF protection — see 0.5-D, decide the approach first, then either:
      → Implement it properly (`src/middleware/security.js` `csrfTokenGenerator` already exists and issues
        tokens; add back a validator middleware and wire it into `src/routes/leads.js`'s POST route), or
      → Formally remove it and update the README to describe CORS-only protection accurately
- [ ] Add Content-Security-Policy header to catalogue.html and product pages
- [ ] Admin panel — add IP allowlist option via environment variable
      → If ADMIN_ALLOWED_IPS is set, reject requests from other IPs
- [ ] Review CORS allowed origins — ensure no wildcards in production
- [ ] Ensure all admin routes return 401 (not 403 or 404) for missing JWT *(spot-checked `src/routes/authGuard.js` during the audit — this one already returns 401 correctly; verify the equivalent check in `routes/panel.js`'s own auth middleware too)*
- [ ] Rate limit the scraper endpoint separately from general API

### 5C — Testing
*Goal: Confidence when refactoring.*

- [ ] Set up test runner (Node built-in test runner — already in package.json)
- [ ] Test: POST /api/leads — success case
- [ ] Test: POST /api/leads — missing required fields returns 400
- [ ] Test: POST /api/leads — honeypot field filled returns 400
- [ ] Test: POST /api/panel/login — success returns JWT
- [ ] Test: POST /api/panel/login — wrong password returns 401
- [ ] Test: POST /api/panel/login — rate limit after 10 attempts
- [ ] Test: GET /api/panel/products — without JWT returns 401
- [ ] Test: GET /flooring/carpets/duna — returns valid HTML with product data
- [x] ~~A test that boots the DB layer under both `DB_TYPE` values~~ → no longer applicable, SQLite was
      dropped entirely rather than fixed (see 0.5-A) — there's only one `DB_TYPE` value now
- [ ] **Highest-priority single test to add (from 0.5-H):** POST to `/api/leads` with valid data, assert
      `201`. This is the one test that would have caught the `audit_log` column mismatch on day one, and
      it's the cheapest possible insurance against something similar happening again in that same code path

### 5D — Dependency cleanup
- [ ] Remove express-session (unused) *(verify still present first — see 3A note)*
- [ ] Remove undici (duplicate of axios) *(verify still present first — see 3A note)*
- [ ] Evaluate pdf-parse — document what it's used for or remove it *(not found in current package.json dependencies — verify before spending time here, may already be gone)*
- [x] ~~Evaluate better-sqlite3~~ → resolved, removed entirely as part of dropping SQLite (0.5-A)
- [ ] **New (from second audit, 10 Jul):** `sharp` is declared in `package.json` and never imported
      anywhere in the codebase (confirmed by grep) — `cloudinary` is the actual image-handling path via
      `routes/scraper.js`. Dead dependency, safe to remove.
- [ ] Update all dependencies to latest minor versions: `npm update`
- [ ] Run `npm audit` — fix any high/critical vulnerabilities

### 5E — Developer experience
- [ ] Add README.md with setup instructions, env vars, scripts *(README exists — audit found it's stale in places, see 0.5-A and 0.5-D; treat as "update," not "add")*
- [ ] Add CONTRIBUTING.md with commit conventions and workflow *(the convention already exists informally — see §10 below — just needs to be its own file)*
- [x] package-lock.json in repo
- [ ] Add `"admin:reset-password"` to package.json scripts *(corrected: this was marked done in May but isn't in the current package.json — see 0.5-C)*
- [ ] Add `"db:migrate"` to package.json scripts (Phase 1C)
- [x] Rename env.example.txt → .env.example

---

## PHASE 6 — Performance & Monitoring

- [ ] Configure Winston to alert on errors (Slack webhook or email)
- [ ] Add response time logging to Morgan
- [ ] SSR product pages — add Cache-Control: public, max-age=300 header
- [ ] Hero image — convert to WebP, add srcset for mobile/desktop
- [ ] All images — consistent loading="lazy" below the fold
- [ ] Remove unused CSS — audit catalogue.css for dead rules post-modal-removal
- [ ] Set up uptime monitoring (UptimeRobot free tier — monitor /health endpoint)

---

## PHASE 7 — Scale (Future, when business is generating revenue)

- [ ] Add second product category (e.g. accessories — door bars, gripper rods)
- [ ] Stripe payment integration for online orders
- [ ] Installer portal — assign leads to fitters, track completion
- [ ] Customer portal — track their order/installation
- [ ] Affiliate/referral tracking system
- [ ] Multi-language support (Polish? — large community in West Yorkshire)
- [ ] Review architecture for adding non-flooring categories

---

## Progress Tracker

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 0 — Environment | ✅ Complete | May 2026 | Jul 2026 |
| 0.5 — Audit Findings | 🟡 In Progress *(0.5-A, 0.5-B, 0.5-H done; 0.5-C/D/E/F/G still open)* | Jul 2026 | — |
| 1 — Admin Portal | 🟡 In Progress *(1B, 1D partially done)* | May 2026 | — |
| 2 — Content | ⬜ Not started | — | — |
| 3 — Website | ⬜ Not started | — | — |
| 4 — Automation | ⬜ Not started | — | — |
| 5 — Code Quality | ⬜ Not started | — | — |
| 6 — Performance | ⬜ Not started | — | — |
| 7 — Scale | ⬜ Future | — | — |

---

## How to Resume in a New Chat

Paste this at the start of any new conversation:

---
*"I am building a flooring lead-generation platform (West Yorkshire Carpets).
Read PROJECT_CONTEXT.md and MASTER_CHECKLIST.md which I will attach.
Find the first unchecked item in the checklist and let's work on it.
Work like a senior full-stack engineer — no shortcuts, no hardcoded values,
no patches. One task at a time, commit after each change. The production site
is live and works — never make a change that can't be verified before it
reaches `main`."*

Then attach both PROJECT_CONTEXT.md and MASTER_CHECKLIST.md.
---
