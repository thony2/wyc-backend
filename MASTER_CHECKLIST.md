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
> **Updated again 11 Jul 2026.** Two things, both bigger than a normal day's work:
> 1. **The live frontend (`easyflooring.vercel.app`) was never connected to this GitHub repo at all** — it
>    was a one-time manual upload, frozen since ~5 April, silently missing every change since (including
>    everything from the May session and everything from this one, until today). Fixed by properly connecting
>    it via Vercel's Git integration. See 0.5-I.
> 2. **0.5-D (CSRF) was decided, implemented, tested locally, merged — and then reverted the same day**,
>    after real-world testing on the now-properly-connected live site revealed it broke lead submission for
>    Safari users with default privacy settings (Safari blocks the cross-domain cookie the double-submit
>    pattern depends on). The original reasoning wasn't wrong given what was known at the time — this is a
>    case of new evidence changing a decision, not a mistake. See 0.5-D for the full account; left in place
>    rather than deleted, since the reasoning is worth keeping for next time this gets reconsidered.
>
> **Updated again 26 Jul 2026.** A third, independent audit (`WYC-Backend-Independent-Audit-2026-07-26.md`,
> not committed to the repo — shared as a reference document) was reviewed the same way as the second one:
> every specific claim independently re-checked against the actual code before being trusted. It held up
> well — almost everything it flagged as "still open" genuinely is, confirming `MASTER_CHECKLIST.md` is
> still accurate rather than stale. The one thing it correctly identified that neither this checklist nor
> the second audit had real data for: `npm audit`, actually run for the first time this session, found a
> genuine high-severity vulnerability in the already-flagged-as-dead `sharp` dependency, plus two smaller
> ones in `body-parser` and `morgan` — see 5D. Also confirmed `admin/index.html` was split partially, not
> fully, this same day — see 1E for why, and what was deliberately left for later.
>
> **Updated again 26 Jul 2026 (second update this day).** A fourth, independent audit was reviewed —
> excellent, rigorous work, every specific claim checked came back accurate. One important correction to
> its own recommendation, caught by verifying rather than trusting the guess: it assumed `/api/panel` was
> the "live" admin API and `/api/admin` the dead legacy one, and recommended confirming before deleting
> either. Confirming directly (reading exactly what `admin/index.html` calls) found the opposite split —
> **both are genuinely live, divided by feature** (leads/dashboard/calendar → `/api/admin`;
> login/products/offers/scraping → `/api/panel`) — see 5A. Real new findings folded in: an SSRF gap in the
> image-import step, unpinned JWT algorithm, CSV formula-injection risk via the message field, synchronous
> bcrypt calls, a quantified (not vague) error-handling inconsistency (`routes/panel.js` leaks raw errors
> 21 times), and a fully-built customer confirmation email that's never actually called anywhere — see
> 4A/5A/5B. A companion document (`README-discrepancies.md`, not committed, shared as reference) did a
> thorough claim-by-claim comparison of `README.md` against reality — confirms what was already known
> (the README describes an old, pre-Postgres architecture) in much more detail; worth pulling up when the
> README rewrite in 5E actually happens, rather than starting that rewrite from scratch.
>
> **Updated again 29–31 Jul 2026.** Three small, independently-verified PRs landed, each checked against
> a fresh clone (not just the working copy) before being called done:
> 1. **5E — README rewrite, done** (PR #30). Rewritten from scratch against the current code rather than
>    patched — corrects the deployment model (static site on Vercel, API on Railway, not one combined
>    service, which the checklist itself hadn't previously stated explicitly), documents JWT auth in place
>    of the old `ADMIN_TOKEN` framing, flags that local frontend dev hits the production API by default
>    (hardcoded Railway URL in `js/form-handler.js`/`catalogue.js`/`product-page.js` — this is 3A below,
>    now cross-referenced from the README itself), and notes Railway's outbound-SMTP block on
>    Free/Trial/Hobby plans as the most likely cause if `MAIL_ENABLED` email silently doesn't send. Two
>    independently-produced drafts were compared line-by-line against the code before merging; where they
>    disagreed (deployment model, Node version prerequisite), the code settled it.
> 2. **5B — CSV formula-injection, done** (PR #31). `quoteField()` now runs every value through a new
>    `sanitizeFormula()` step first, prefixing a leading `'` onto anything starting with `=`, `+`, `-`, or
>    `@` before it's written to the exported file. Verified with an actual `=HYPERLINK(...)`-style payload
>    through `generateCsv()` — comes out neutralised; a normal message with a comma round-trips unchanged.
> 3. **5A — partial, done** (PR #32). Not the full consolidation — that's still open, see below — but the
>    narrower thing that was actually safe to do now: `routes/panel.js` turned out to contain its own
>    *second* copy of all 7 lead/dashboard/calendar endpoints (`GET /dashboard`, `GET /leads`,
>    `GET /leads/export.csv`, `PATCH /leads/:id/status`, `PATCH /leads/:id/booking`, `DELETE /leads/:id`,
>    `GET /calendar`), never called by the live frontend, sitting alongside the genuinely-used
>    login/products/offers/scraping endpoints in the same file. Confirmed dead by grep against every
>    `fetch()` call in `admin/index.html`, then removed — 142 lines, nothing else in the file touched.
>    Worth flagging why this mattered beyond tidiness: this dead copy's `DELETE /leads/:id` did a **hard
>    delete with no anonymisation option**, unlike the live implementation, which anonymises by default. If
>    anything had ever been mis-wired to call it, GDPR-anonymisation would have silently not happened.
>    The remaining, larger part of 5A (migrating login/products/offers/scraping into `src/`) is unchanged
>    and still open.
>
> **Updated again 1 Aug 2026.** Both of 0.5-H's two open items are now genuinely done, not just prepared:
> 1. **The real integration test** (PR #34) — see 0.5-H and 5C for the full account, including the
>    before/after proof that the test actually fails when the original bug is reintroduced.
> 2. **The dead `audit_log.details` column was dropped from the real production database** (PR #35 added
>    the script; running it against production was done separately by hand, 1 Aug 2026, after confirming
>    with the project owner that this database currently holds no real customer data — see 0.5-H for the
>    honest note about the 3 unexpected non-null rows this surfaced, and what to do differently once real
>    leads exist here).
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
- [x] .env file has all required variables (see README.md's "Environment Variables Reference" —
      *corrected 1 Aug 2026: this used to cite `PROJECT_CONTEXT.md §5`, which has wrong variable names
      for email config (`MAIL_HOST` etc. instead of the real `SMTP_HOST` etc.) and is now retired, see
      that document's own archived banner*)
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
      *(note: this was a partial, in-place fix at the time — the "Deploying / migration" section further
      down the README, describing converting schema.sql to Postgres, was left out of date and flagged for
      a full rewrite in 5E. That rewrite happened 29–31 Jul 2026 — see the update note above and 5E below.
      This item stays checked as an accurate record of what was done in this specific pass.)*
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
- [x] **Done 1 Aug 2026:** the original `details` (plural) column is confirmed dead — nothing reads or
      writes it (checked every file that touches `audit_log` at all, including the admin panel's own
      display of the audit log; only the singular `detail` is ever used). Dropped via a standalone,
      manually-run script (`scripts/drop-audit-log-details-column.js`, `npm run
      db:drop-audit-details-column`) — deliberately kept out of `migrate-auto.js`, since that script runs
      automatically on every boot and is meant only for safe, additive, idempotent changes, not anything
      destructive. See `chore/drop-dead-audit-log-details-column`.
      **Worth recording honestly:** running it against the real production database found 3 rows with a
      non-null value in the column — unexpected against a codebase-only check, though consistent with the
      column being old, pre-dating the `details` → `detail` rename, and nothing since ever writing to it
      again. That data is gone now (dropping a column isn't reversible) — acceptable here specifically
      because the project currently holds no real leads, confirmed directly by the person running it. If
      this project ever holds real customer data, a change like this should be preceded by an actual
      backup and a slower look at what those rows were, not just a warning printed to the console.
- [x] **Done 31 Jul 2026** (PR #34): added a real integration test — `src/tests/leads.test.js` now POSTs
      to `/api/leads` and asserts `201`, using an in-memory Postgres (`pg-mem`, test-only dependency) built
      from the actual `migrate-auto.js` rather than a hand-copied schema. Verified the test has real teeth,
      not just that it passes: deliberately reintroduced this exact bug (dropped `audit_log.detail`)
      against the finished test file and confirmed it fails with a genuine "column does not exist" error,
      then restored it and confirmed it passes again. See 5C — this was that section's highest-priority
      item, and it's now done, not just proposed.

### 0.5-B — Critical: dead / broken repo artefacts (zero behavioural risk — safe to do anytime, independent of 0.5-A)
- [x] ~~Delete root-level `panel.js`~~ → done in this session, see `chore/remove-dead-panel-js`
      → It was an unreferenced duplicate of `routes/panel.js` left over from the `routes/admin.js` → `panel.js`
        rename. `server.js` only ever loads `routes/panel.js`. Confirmed nothing else required it.
- [x] ~~Remove broken orphaned git submodule at `wyc-backend`~~ → done in this session, see `chore/remove-broken-submodule`
      → Leftover from an accidental nested-copy that was reverted (`fe1ecc3` / `46681af`). No `.gitmodules`
        entry backs it; it's dead weight only. Confirmed the working tree contains no files there.

### 0.5-C — High: broken/missing npm scripts ✅ DONE (10 Jul 2026)
- [x] `db:seed` script pointed at nonexistent `src/config/seedDb.js` → fixed to point at the real
      `seed-products.js` (repo root), which already did this job → `fix/broken-npm-scripts`
- [x] `admin:reset-password` script now actually added to `package.json`, matching what
      `scripts/reset-admin-password.js`'s own header always claimed → `fix/broken-npm-scripts`

### 0.5-D — High: CSRF — decided, implemented, tested, reverted (11 Jul 2026)
- [x] **Decision made:** restore real CSRF validation on `POST /api/leads` only (not the admin panel, which
      is already immune via JWT-in-header auth — see reasoning discussion, 11 Jul)
- [x] Implemented: `csrfValidator` middleware (double-submit cookie pattern) in `src/middleware/security.js`,
      wired into `src/routes/leads.js`; `js/form-handler.js` updated to fetch and send the token →
      `feat/restore-csrf-validation-on-leads`
- [x] Tested end-to-end locally (real browser, real local server, real submission) — worked correctly
- [x] **Reverted the same day**, after testing on the live site (which required first discovering and fixing
      0.5-I below) revealed a real problem the local test couldn't have caught: Safari's default
      "Prevent Cross-Site Tracking" setting blocks the cookie this pattern depends on, because the frontend
      (`vercel.app`) and backend (`railway.app`) are different domains. Confirmed directly — form failed
      with tracking protection on, worked with it off. A meaningful share of real iPhone visitors use Safari
      with default settings, so this would have silently lost real leads with no visible error on your end.
      → Reverted via GitHub's PR revert feature, confirmed live site works normally again afterward.
- **Current state:** back to CORS-only, as it was before 11 Jul. `GET /api/csrf-token` still exists and is
  still unused — cleaning that up formally (matching option (a) from the original decision) is the one
  piece of this still worth doing, now that (b) has been tried and ruled out by real evidence rather than
  just reasoned about in the abstract.
- [x] **Done 1 Aug 2026:** removed the `/csrf-token` route (`src/routes/leads.js`) and the unused
      `csrfTokenGenerator` middleware (`src/middleware/security.js`); confirmed via grep that nothing in
      `js/`, `admin/js/`, or `index.html` ever called the endpoint, so there was nothing on the frontend
      to update. README's Security Summary updated to match.

### 0.5-I — Critical: live frontend was never connected to this repository ✅ FIXED (11 Jul 2026)
*Bigger than anything else found this session — discovered by accident while testing 0.5-D on the "live" site.*

`easyflooring.vercel.app` — the actual site checked when asking "does this work" — was a one-time manual
upload to Vercel, never connected to `thony2/wyc-backend` via Git at all. It had been frozen since roughly
5 April 2026. Every change since then — the entire May session, and everything from this session before this
was caught — never reached it. Confirmed via Vercel's own Git settings page, which stated outright:
*"This Project is not connected to a Git repository."*

- [x] Connected the project to `thony2/wyc-backend` (`main`) via Vercel's Git integration
- [x] Triggered the first real deployment (an empty/doc commit, since connecting alone didn't auto-deploy)
- [x] Verified: `easyflooring.vercel.app` now genuinely reflects current `main`, confirmed by testing the
      live contact form and seeing behaviour that matched the current code (including, ironically, catching
      the 0.5-D Safari issue — which only reveals itself against a genuinely live, cross-domain deployment)
- [ ] **Worth doing:** do a full pass over the live site (not just the contact form) to check for anything
      else that assumed the old, frozen April version was still current — e.g. cached copy in Search Console,
      any external links pointing at old content, social media previews
- [ ] **Worth understanding:** why/how this became disconnected in the first place (a manual upload at some
      point, replacing a Git connection?) — not urgent, but worth knowing so it doesn't happen again silently

### 0.5-E — High: audit-log IP gap in the legacy layer ✅ DONE (10 Jul 2026)
- [x] `routes/panel.js`'s local `audit()` helper hardcoded the IP parameter to `null` for every
      product/offer/login action. Added a `getClientIp(req)` helper matching
      `src/controllers/adminController.js`'s already-correct approach, threaded through all 11 call
      sites → `fix/panel-audit-log-ip` (also closes the duplicate mention of this in 1F below)

### 0.5-F — Medium: ops scripts don't run anywhere but one old laptop ✅ DONE (2 Aug 2026)
- [x] `scripts/backup.sh` rewritten — was copying a local SQLite file (`data/wyc_leads.db`) that hasn't
      existed since SQLite was removed (0.5-A, 10 Jul). Now runs `pg_dump` against the real Postgres
      database, loading connection details from `.env` the same way the app does. Backup output moved
      to a new `backups/` directory at repo root (added to `.gitignore` in the same change — it holds
      real customer data). Hardcoded `/Users/potencial/...` path removed — resolves relative to the
      script's own location now, so it works on any machine the repo is checked out on.
- [x] `scripts/check-leads.sh` → **replaced with `scripts/check-leads.js`**, not just patched. Two real
      bugs found in the original, both silent failures rather than errors: (1) it called
      `db.prepare(sql).all()` and used the result synchronously, but that method is async — it would
      have printed a pending Promise object, not lead data; (2) it never loaded `.env` — `server.js` is
      the only place in this codebase that calls `dotenv.config()`, so any standalone script requiring
      `src/config/database.js` directly gets `undefined` for `PGHOST` etc. unless it loads `.env` itself,
      which the original didn't. Converted from a bash-wrapped `node -e` one-liner to a real `.js` file,
      matching how `scripts/reset-admin-password.js` and `scripts/generate-hash.js` already do this —
      partly because a proper async/await flow is much harder to get right correctly in an inline
      one-liner, which is arguably *why* bug (1) happened in the first place.
- [x] `scripts/check.sh` rewritten — was checking for a `data/` directory and `data/backups/` folder that
      haven't existed since the SQLite removal, and its `backup.sh` existence check looked for
      `./backup.sh` in the repo root — the real file has always been at `scripts/backup.sh`, so this
      check would have failed even before the SQLite rewrite made the rest of the script stale. Now
      checks the variables that actually matter (`JWT_SECRET`, `PGHOST`, `PGDATABASE`, `PGUSER`,
      `PGPASSWORD`), checks the correct `scripts/backup.sh` path, and checks that the new `backups/`
      directory is gitignored. Hardcoded machine path removed here too.
- [x] Verified: all three pass `node --check` / `bash -n`. Not run end-to-end in this environment (no
      network access to a real Postgres instance) — before relying on `backup.sh`, run it once manually
      and confirm the resulting `.sql.gz` file actually restores.

### 0.5-G — Medium: other hygiene
- [ ] `.vercel/README.txt` is committed despite `.vercel/` being in `.gitignore` — `git rm --cached .vercel/README.txt`
- [ ] `og:image` still missing (see 3A below — already tracked, just cross-referencing)
- [x] ~~`npm test` still only runs a placeholder assertion~~ → false since PR #34/#38 (real integration +
      unit tests) — see 5C. This was the third place this same stale claim was found sitting unfixed
      this session (also in README.md's Known Gaps and npm Scripts table, both corrected 1 Aug) —
      genuinely just an overlooked duplicate, not a new discovery each time.

---

## PHASE 1 — Admin Portal: Logic & Code Quality

### 1A — Scraper / Import Catalogue (HIGHEST PRIORITY) ✅ DONE (25 Jul 2026)
*Goal: Zero supplier branding in any imported product.*

Investigated properly before making changes, rather than assuming the original list of sub-tasks below
was still accurate — several of them turned out to already be non-issues, and the real gap was somewhere
the original list didn't point to.

- [x] **Real finding:** the top-level product name field was already safe — starts empty, required, never
      pre-filled with supplier text. No change needed.
- [x] **Real finding:** the product description is hardcoded to always save as blank in the backend
      (`routes/scraper.js`), regardless of what's scraped or typed — so this was never actually a branding
      leak. *(Separately noted: this means admin-typed descriptions are currently silently discarded — a
      real bug, unrelated to branding, not yet fixed — see new item below.)*
- [x] **The actual leak:** colour variant names. The input box shows the supplier's name only as grey
      placeholder text — but if left blank, the code was silently submitting the raw supplier name as the
      real value. Easy to miss, since the placeholder makes the field look filled in at a glance.
- [x] **Fix implemented:** rather than hiding supplier names from the admin (you still need to see the
      original name to know what to rename it to), added a hard server-side block in
      `POST /api/panel/import-family` — refuses to import any colour whose name still exactly matches the
      supplier's original name. This is the one place guaranteed to run no matter how an import is
      triggered, so it's the right place to actually enforce this, rather than relying on the UI alone.
      → `feat/block-supplier-branding-on-import`
- [x] routes/scraper.js — Use shared db from src/config/database.js *(confirmed done — no longer has its own `new Pool()`)*
- [x] **Test: Import a product → verify zero supplier references** → confirmed working end-to-end,
      including via the new bulk-import flow below (25 Jul 2026)
- [x] **Description bug, found along the way, now fixed** (25 Jul 2026): admin-typed descriptions were
      being silently discarded on save. Fixed — and while fixing it, found that doing so naively would have
      reopened a branding leak through descriptions instead of colours (the bulk-scrape flow's
      auto-generated description text embeds the supplier's product name). Both fixed together: single-URL
      import now genuinely saves what's typed; bulk import explicitly clears this field rather than
      forwarding the risky auto-generated text → `fix/save-admin-typed-description`. Confirmed working for
      real on both paths.

#### Bonus: bulk import (not on the original list, added 25 Jul 2026)
*Business need: importing products one at a time was slow; wanted to paste a whole list of URLs at once.*

- [x] `POST /api/panel/scrape-bulk` — scrapes a list of URLs (up to 50) one at a time, with a randomized
      3-8 second pause between each so it reads as normal browsing rather than automated traffic. Streams
      results back live as each one finishes rather than one long silent wait. Required a small, targeted
      change to `server.js` (a compression-bypass filter for this one route) for the live streaming to
      actually reach the browser rather than getting buffered → `feat/bulk-scrape-endpoint`
- [x] Bulk-scrape UI on the Import Catalogue page — paste a list of URLs, watch live progress, review the
      whole batch (same "blank colour name, supplier name as placeholder" pattern as the single-import
      flow), Import All. Built as its own self-contained section, deliberately named to avoid any collision
      with the separate, already-existing CSV-based "Bulk Import" tool on the Products page (different tool,
      different purpose — that one's for data you've already prepared yourself, not scraping) →
      `feat/bulk-scrape-ui`
- [x] **Confirmed working end-to-end by real use, not just testing** (25 Jul 2026)

### 1B — Database Connection Consolidation
*Goal: One connection pool, used everywhere.*

- [x] routes/scraper.js — Same as above (covered in 1A)
- [x] ~~routes/products-seo.js — Remove standalone `new Pool()` — use shared db~~ → done, see 0.5-A
      (that list already had this checked off; this duplicate tracking entry was left open — found
      during the 1 Aug reconciliation pass, same recurring pattern as several other items this session)
- [ ] Verify: Only ONE pool is created at startup (check logs show single "PostgreSQL connected")

### 1C — Migrate-auto cleanup ✅ DONE (2 Aug 2026)
*Goal: Migrations don't run on every server start.*

- [x] Created `scripts/migrations/001_initial_schema.sql` — the full current schema as one baseline file,
      not split into files matching migrate-auto.js's exact historical additions (reverse-engineering
      those boundaries would be archaeology with no operational benefit — every future schema change is
      a new numbered file from here on, e.g. `002_...`). Deliberately idempotent throughout
      (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), matching migrate-auto.js's own discipline — this is
      what makes it safe to run for the first time against the already-migrated live database (a no-op
      there) as well as a genuinely fresh one.
- [x] Created `scripts/migrate.js` — tracks applied migrations in a new `_migrations` table, only runs
      files not yet recorded there. Exports a single `applyMigrations(db)` function (same shape as
      migrate-auto.js's own `module.exports = async function(db) {...}`) rather than only being a CLI
      script — `src/tests/leads.test.js` requires this file directly and awaits it against a test
      database, exactly like it did with migrate-auto.js before this change; keeping the same shape
      meant that test only needed a path update, not a rewrite. The bcrypt-based default-admin seed
      (`ADMIN_DEFAULT_PASSWORD`) couldn't move into the `.sql` file — plain SQL can't hash a password —
      so it stayed as a JS step in `migrate.js` itself, run after the `.sql` files, same idempotency
      (`ON CONFLICT DO NOTHING`) as everything else.
- [x] Added `"db:migrate": "node scripts/migrate.js"` to `package.json`. Also chained into `"start"`
      (`node scripts/migrate.js && node server.js`) and `"dev"` (`node scripts/migrate.js && nodemon
      server.js`) — **a deliberate addition beyond the original plan, not just the literal checklist
      text.** Without this, nothing would actually run migrations on Railway deploys once `server.js`
      stopped doing it automatically — a real gap: a deploy could boot fine and then break on the first
      query touching a column a forgotten migration never created. Chaining into `start` closes that gap
      entirely in the repo, with zero Railway dashboard configuration needed. Chaining into `dev` too is
      safe specifically because it's cheap now: an already-applied migration is a fast tracking-table
      check, not 30 real schema statements, and nodemon only restarts `server.js` on file changes — not
      the outer `npm run dev` command — so this still only runs once per dev session, not on every save.
- [x] `require('./migrate-auto')(db)` removed from `server.js`. The `db` require that only existed to
      support that call was removed too, not left as dead code — `require()`-ing
      `src/config/database.js` opens a real Postgres connection pool immediately
      (`module.exports = getDatabase()` runs on require), so an unused import there wouldn't just be
      dead code, it'd be a wasted connection.
- [x] `migrate-auto.js` deleted.
- [x] **Deliberate behaviour change, beyond the stated plan:** migrate-auto.js caught every error, logged
      it, and let the server boot anyway — a broken migration could leave the app running against an
      incomplete schema without anyone necessarily noticing. `scripts/migrate.js`'s CLI entrypoint does
      not swallow errors — it exits non-zero on failure, which (via the `&&` chain above) stops the
      server from starting at all. Failing loudly is safer than booting quietly broken.
- [x] Test criterion met, with one honest clarification: running `node server.js` directly now shows
      zero migration output, since there's none left in that file at all. Running `npm start` (the
      actual Railway entrypoint) does show migration output first, by design — see the point above about
      why that's a deliberate addition, not a deviation from the goal. The underlying goal ("schema
      changes are a deliberate, visible step, not an invisible side effect of every boot") is met either
      way.
- [x] Verified: `scripts/migrate.js` and `server.js` pass `node --check`; `src/tests/leads.test.js`
      updated (path only — `MIGRATE_PATH` now points at `scripts/migrate.js`, comments updated to match,
      an unused `path` import removed since `require.resolve()` replaced `path.resolve()`). Every other
      reference to `migrate-auto.js` across the codebase swept and checked individually — historical
      references (dated checklist entries describing past fixes, the archived 7 Jul audit doc) left
      alone; current-tense references (README.md, `scripts/drop-audit-log-details-column.js`'s own
      comment) updated. Not run end-to-end in this environment (no network access to a real Postgres
      instance) — before relying on this, run `npm run db:migrate` once against a real database and
      confirm it completes cleanly, then run it a second time and confirm it reports "nothing to do."

### 1D — Admin Security
*Goal: Admin password never in source code.*

- [x] scripts/generate-hash.js created
- [x] scripts/reset-admin-password.js created
- [x] migrate-auto.js — Admin seed reads from env var, not hardcoded string *(confirmed fixed — reads `ADMIN_DEFAULT_PASSWORD`, commits `8a4169f`/`8e19fe9`)*
- [x] Add ADMIN_DEFAULT_PASSWORD to .env.example with a placeholder value
- [ ] Verify: `git log --all -S "Admin@WYC2026"` returns no results *(run this yourself — I didn't find the string in the current tree, but you should confirm it's gone from history too, not just HEAD)*
- [x] ~~Add the missing `admin:reset-password` npm script~~ → already done, see 0.5-C. (This was a
      duplicate tracking entry for the same fix — found during the 1 Aug reconciliation pass; the
      checklist had it marked open here while 0.5-C correctly had it marked done.)

### 1E — Admin Panel: Split the monolith 🟡 PARTIALLY DONE (25 Jul 2026)
*Goal: admin/index.html split into maintainable files.*
*Status: 3,991 lines (grew from 3,663 in May) → 2,440 lines after this pass.*

**Deliberate decision, made with the project owner:** a redesign of the admin panel is planned. Rather
than do the full six-way split now and risk it being reshuffled again shortly after for no lasting
benefit, only the parts that were genuinely safe, low-risk, and *not* likely to be redesigned were
extracted today. The rest is intentionally left alone until the redesign happens — split and redesign
together, as one piece of work, not split twice.

- [x] Create admin/css/admin.css — both `<style>` blocks (base stylesheet + the later
      `wyc-admin-theme` block) extracted and combined into one file, one `<link>` tag
      → `refactor/split-admin-css-and-import-js`
- [x] Create admin/js/admin-import.js — the single-URL and bulk-scrape import flows (both already
      written as clean, self-contained IIFEs specifically so this extraction would be close to
      mechanical when it came time to do it) → same PR as above
- [ ] Create admin/js/admin-auth.js, admin-leads.js, admin-products.js, admin-offers.js,
      admin-calendar.js, admin-ui.js — **on hold until the planned redesign**, since these all live in
      one large (~64,000-character), genuinely tangled script block sharing state across leads,
      products, calendar, offers, navigation, and auth. Splitting this safely needs careful mapping of
      every cross-reference first — the highest-risk, most complex remaining piece of this whole task,
      and better done once alongside the redesign than twice.
- [x] Verify: admin/index.html is dramatically smaller after extraction *(not yet under the original
      300-line target — that target assumed the full six-way split; revisit once the rest happens)*
- [ ] Delete admin/images/ — duplicate of root images/ folder *(confirmed smaller than originally
      described — just logo.svg/logo2.svg/.gitkeep now — still worth doing, low priority)*
- [x] Verified working correctly in a real browser after the split (25 Jul 2026) — visual check across
      Leads/Products/Calendar/Deals plus both import flows, confirmed by the project owner, not just
      static checks

### 1F — Admin UX Improvements
*Goal: Faster, clearer workflow for managing products and leads.*

- [ ] Products page — Add category filter persistence (remembers last selected tab)
- [ ] Products page — Bulk select + bulk delete/hide
- [ ] Import page — Show clear error when URL is not a supported supplier
- [ ] Import page — Progress indicator during Cloudinary upload (not just a spinner)
- [ ] Import page — Preview images before confirming import
- [ ] Leads page — Click anywhere on row to open lead detail (not just the name)
- [ ] Leads page — Quick-reply WhatsApp link from lead row (opens wa.me/447449... with pre-filled message)
- [x] Audit log — Record IP address on every admin action → done, see 0.5-E
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
- [ ] **New (documentation reconciliation pass, 1 Aug 2026):** `index.html`'s canonical URL, `og:url`,
      `og:image`, Twitter card, and JSON-LD business schema all hardcode `https://www.westyorkshirecarpets.com`
      — confirmed by direct fetch to return a 404, the project owner no longer owns this domain. Same root
      problem as the `og-image.jpg` and hardcoded-Railway-URL items in this section, found separately.
      Fix once a real domain exists, or point everything at `https://easyflooring.vercel.app` in the
      meantime — that's a product decision, not something to default silently.
- [ ] **New (documentation reconciliation pass, 1 Aug 2026):** same problem, second location —
      `routes/products-seo.js` falls back to the same dead domain via its `SITE_URL` default when that
      env var isn't set, which — confirmed directly against Railway's actual variable list — it currently
      isn't. Affects every SSR product page's canonical URL, `og:image`, and sitemap.xml entries.
- [ ] Configure Google Analytics 4
      → Replace G-XXXXXXXXXX in index.html with real Measurement ID
      → Create GA4 property at analytics.google.com if not done
- [ ] Remove hardcoded Railway URL — currently in **`js/form-handler.js`, `js/catalogue.js` (3 call sites),
      and `js/product-page.js`** *(product-page.js wasn't in the original list — audit found a 4th file)*
      → Replace with one shared config (e.g. a single `js/config.js` exposing `window.WYC_CONFIG.apiBase`,
        loaded before the other scripts on every page that needs it)
- [ ] Fix broken npm scripts in package.json
      → db:seed: point to correct file or delete (see 0.5-C)
      → admin:reset-password: ~~add it~~ already done, see 0.5-C
      → test: ~~currently a placeholder, not broken~~ real integration + unit tests since PR #34/#38 — see 5C
- [x] ~~Fix "licence" typo → "license" in package.json~~ → already correct, `"license": "UNLICENSED"` —
      confirmed by direct grep, 1 Aug 2026 reconciliation pass. This item was left open after the fix
      landed, same pattern as several other items found and fixed elsewhere in this document already.
- [x] ~~Remove express-session from dependencies~~ → confirmed already gone, not in package.json (same
      fact tracked twice in this document — see the other entry, verified 26 Jul, for the original)
- [x] ~~Remove undici from dependencies~~ → confirmed already gone, not in package.json (same fact
      tracked twice in this document — see the other entry, verified 26 Jul, for the original)

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
- [ ] **New (fourth audit, 26 Jul, verified):** `src/services/emailService.js`'s
      `sendCustomerConfirmation` function is fully built (branded HTML email, plain-text fallback,
      properly HTML-escaped) but is **never called anywhere in the codebase** — confirmed by grep finding
      zero call sites outside its own definition and export line. Customers submitting a lead right now
      get no confirmation email at all, despite fully-working code for exactly that already existing.
      Likely the fastest, highest-value item in this whole phase once `MAIL_ENABLED` work above happens —
      wiring this in may be most of the "customer confirmation" task already done.

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

- [ ] **Important correction (26 Jul, fourth audit + independently verified):** this is not "one live API,
      one dead legacy API." **Both are genuinely in active use, split by feature** — confirmed by reading
      exactly what `admin/index.html`'s remaining script actually calls:
      → `/api/admin` (`src/routes/authGuard.js` → `src/controllers/adminController.js`): leads, dashboard,
        calendar, booking, status updates, CSV export
      → `/api/panel` (`routes/panel.js`): login, products, offers — plus scraping/import
        (`routes/scraper.js`), already confirmed separately
      A fourth independent audit guessed the opposite ("my read is `/api/panel` is the one in active use")
      and explicitly recommended confirming before deleting either — good instinct, and confirming it
      first is exactly what caught that the guess was wrong. **Consolidating these means genuinely merging
      two feature-complete implementations, not picking a winner and deleting a loser** — size this task
      accordingly; it's bigger than "delete the dead one."
- [x] **Done 31 Jul 2026** (PR #32): `routes/panel.js` also had its own unused second copy of exactly the
      7 endpoints listed above (`/dashboard`, `/leads`, `/leads/export.csv`, `/leads/:id/status`,
      `/leads/:id/booking`, `DELETE /leads/:id`, `/calendar`) — dead code, never called by the frontend,
      distinct from the genuine `/api/admin` vs `/api/panel` feature split described above. Removed;
      confirmed by loading the resulting router directly and checking the remaining 16 routes are exactly
      login/products/offers/audit/change-password/likes, by grepping the whole repo for any reference to
      the removed paths (none found), and by re-running the test suite. **This does not close 5A** — it
      only removes the one part of the duplication that was safely deletable outright. The two items below
      it, and the real merge of login/products/offers/scraping into `src/`, are still fully open — as
      of 1 Aug 2026, all 5 steps of 5A are done, see below.
- [x] **Done 1 Aug 2026:** migrated all functionality from `routes/panel.js` → `src/controllers/
      adminAuthController.js` (login, change-password) + `src/controllers/productAdminController.js`
      (stats, product CRUD, offer CRUD, audit log) + `src/routes/panel.js`, still mounted at
      `/api/panel`. No longer a `(db) => {...}` factory. The shared `audit()` helper that used to live
      inline in `routes/panel.js` is now `src/utils/auditLog.js` (`auditProductAction` + `getClientIp`)
      — extracted, not duplicated across the two new controllers. Two changes made during the move,
      beyond relocation: (1) closed this file's share of the error-handling finding below — all 14
      instances now log internally and return a generic message, matching the pattern already used
      correctly elsewhere; (2) switched `bcryptjs`'s synchronous `compareSync`/`hashSync` to the async
      `compare`/`hash` in login and change-password — this was the last item under README.md's Security
      Summary "known, currently-open gaps," now closed. Verified: all 5 touched/added files pass
      `node --check`; every route path cross-checked unchanged against the original file; every
      controller function referenced by the new router cross-checked against actual exports (all 15
      matched exactly); applied and confirmed via a real `git am` on a clean checkout before merging.
      **Not fixed here, deliberately out of scope:** the `audit_log.lead_id` column-overload schema
      smell this helper inherited — see the comment in `src/utils/auditLog.js` itself for why.
      `routes/scraper.js` is still not migrated — that's 5A step 4, still open below.
- [x] **Done 1 Aug 2026 — 5A complete, all 5 steps:** migrated `routes/scraper.js` →
      `src/controllers/importController.js` + `src/routes/import.js`, still mounted at `/api/panel`.
      Closed this file's 5 remaining client-facing error-message leaks (the last ones anywhere in the
      codebase), matching the pattern used for every other file — reasoned about and rejected keeping
      the detailed messages on the theory that admins need the diagnostic detail for a scraping tool;
      the detail isn't lost, it's in server logs now instead of round-tripped through the API response,
      consistent with how every other file handles it. `routes/suppliers/*` moved to
      `src/services/suppliers/` as a straight directory move — confirmed by direct diff that every file
      is byte-identical except the two that only ever used relative `./` requires within their own
      folder, which needed no changes at all regardless of where the parent directory sits.
      **`routes/products-seo.js` was folded into this same step**, even though it was never part of
      5A's original scope (it's SEO page rendering, not the admin-routing problem 5A exists to fix) —
      decided against leaving a single-file exception in an otherwise-empty `routes/` directory. Moved
      to `src/routes/products-seo.js` as a **deliberate pure relocation, no behavioural change** —
      confirmed by direct diff that only the top-of-file comment and one require path changed across
      939 lines; the file's known `SITE_URL` dead-domain-fallback bug (tracked separately, 3A) was
      explicitly left untouched to keep this move low-risk. `routes/` directory removed entirely.
      `server.js` now imports only from `src/`. Verified: all files pass `node --check`; every route
      path and every controller function reference cross-checked against the original/actual exports;
      applied and confirmed via a real `git am` on a clean checkout before merging.
- [x] ~~Remove routes/ directory entirely~~ → done 1 Aug 2026, 5A step 4/5 (above)
- [x] ~~Verify: server.js only imports from src/~~ → done 1 Aug 2026, 5A step 4/5 (above)
- [x] ~~Update server.js route mounts to match new structure~~ → done across 5A steps 1-5
- [x] ~~Remove migrate-sqlite-local.js~~ → done as part of dropping SQLite entirely, see 0.5-A
- [x] **Done 1 Aug 2026:** the three separate, near-identical copies of a `requireAuth` JWT middleware —
      `src/routes/authGuard.js`, `routes/panel.js`, `routes/scraper.js` (confirmed by direct grep, second
      audit, 10 Jul) — are consolidated into a single `src/middleware/auth.js` (`requireAuth` +
      `requireAdmin`), imported by all three call sites. `routes/scraper.js` previously set `req.admin`
      instead of `req.user`; standardized on `req.user` after grepping the file first to confirm nothing
      downstream reads either property, so this was a safe rename, not a behaviour change. No route paths,
      request/response shapes, or frontend code changed. Verified: all four touched files pass
      `node --check`; applied and confirmed via a real `git am` on a clean checkout before merging.
      **This is step 1 of 5 in the routing consolidation — the actual merge of
      login/products/offers/scraping into `src/` (the two items below) is still fully open.** *(Update,
      1 Aug 2026: all 5 steps of 5A are now done — see below.)*
- [x] **Fourth audit, 26 Jul, verified; fully closed 1 Aug 2026 across all of 5A steps 2-4:**
      error-handling was inconsistent across the two layers — `src/controllers/leadController.js` and
      `adminController.js` always did this correctly; `routes/panel.js` (14 instances), `routes/products.js`
      (3), and `routes/scraper.js` (5, grew from 2 on 26 Jul when the SSRF-guard work touched that file)
      all leaked raw `e.message` to the client. All three were closed as part of migrating their
      respective files into `src/` (5A steps 2, 3, and 4). **Zero known instances remain anywhere in
      the codebase as of 1 Aug 2026** — every controller now logs the real error internally and returns
      a generic message to the client, consistently.

### 5B — Security hardening
- [x] ~~CSRF protection — resolved, see 0.5-D~~ → both remaining tasks this item used to describe are
      done: the `/csrf-token` route was removed (PR #37), and the README correction happened as part of
      the 29–31 Jul rewrite (5E). This checkbox was left unchecked after both landed — found during the
      1 Aug reconciliation pass.
- [ ] Add Content-Security-Policy header to catalogue.html and product pages
- [ ] Admin panel — add IP allowlist option via environment variable
      → If ADMIN_ALLOWED_IPS is set, reject requests from other IPs
- [ ] Review CORS allowed origins — ensure no wildcards in production
- [ ] Ensure all admin routes return 401 (not 403 or 404) for missing JWT *(spot-checked `src/routes/authGuard.js` during the audit — this one already returns 401 correctly; verify the equivalent check in `routes/panel.js`'s own auth middleware too)*
- [ ] Rate limit the scraper endpoint separately from general API
- [x] **Done 1 Aug 2026:** `/import-family`'s image-download step
      (`axios.get(colour.imgUrl, ...)` in `routes/scraper.js`) now runs every URL through
      `src/utils/urlSafety.js`'s `assertSafeExternalUrl()` before fetching — resolves the hostname and
      rejects it if the IP falls in a private/loopback/link-local range (covers the RFC1918 ranges,
      127.0.0.0/8, and 169.254.0.0/16, which is what cloud metadata endpoints use), rejects non-http(s)
      schemes, and rejects `localhost` by name. Also added: a content-type check after download (rejects
      anything that isn't `image/*`) and `maxRedirects: 3` (was previously unset, so axios's default of 5).
      Covered by 7 new unit tests (`src/tests/urlSafety.test.js`), all passing.
      **Known residual gap, not fully closed:** this checks the IP *before* the request, not on every
      redirect hop — a URL that resolves safely but redirects to a private address afterward would still
      get through. Closing that fully means either disabling redirects entirely or validating the IP of
      every hop; not done here. Worth revisiting if this endpoint's trust model ever widens beyond
      JWT-admin-only. A domain allow-list (matching `/scrape-family`'s approach) was considered instead but
      not used, since legitimate supplier image URLs come from many different CDN domains that would need
      constant maintenance.
- [x] **Done 1 Aug 2026:** `jwt.verify()` now pins `{ algorithms: ['HS256'] }`, done as a side effect of
      the auth-middleware consolidation above (this is now a single call site instead of three). Low
      practical risk either way with a single symmetric secret, as noted when this was first flagged
      (fourth audit, 26 Jul) — but a one-line, zero-cost hardening, so done rather than deferred.
- [x] **Fixed 31 Jul 2026** (PR #31): CSV lead export could be tricked into executing a formula in
      Excel/Sheets — the export's escaping (`src/services/csvService.js`'s `quoteField()`) only handled
      quote-escaping, not formula-injection characters (`=`, `+`, `-`, `@`) at the start of a cell. The
      `name` field was already safe (its format validation rejects those characters) — `message` is free
      text up to 2,000 characters with no such restriction, so it was genuinely exploitable via that field
      specifically. Fixed with a new `sanitizeFormula()` step that prefixes a leading `'` onto any value
      starting with those characters before it reaches the CSV. Verified manually with an
      `=HYPERLINK(...)`-style message (comes out prefixed and inert) and a normal comma-containing message
      (comes out byte-for-byte unchanged) — see `csvService.js` for the exact logic.
- [ ] **New (fourth audit, 26 Jul, verified):** `routes/panel.js` uses `bcrypt.compareSync`/`hashSync`
      (blocking) on login and password-change, instead of the async `bcrypt.compare`/`hash`. Not a bug at
      current traffic levels (a local business, a handful of admin users) — a scalability foot-gun worth
      swapping when convenient, not urgent.


### 5C — Testing
*Goal: Confidence when refactoring.*

- [x] Set up test runner (Node built-in test runner — already in package.json) → now actually exercised,
      not just declared unused, see below
- [x] Test: POST /api/leads — success case → done, PR #34 (`src/tests/leads.test.js`)
- [x] Test: POST /api/leads — invalid data is rejected and no row is written → done, PR #34. *(Correcting
      this item as written: this app returns `422` for validation failures throughout, not `400` — the
      test asserts the status this codebase actually uses, not the one originally guessed here.)*
- [ ] Test: POST /api/leads — honeypot field filled returns 400 *(still open — not covered by PR #34,
      which only exercises the valid-data and invalid-field-data paths)*
- [ ] Test: POST /api/panel/login — success returns JWT
- [ ] Test: POST /api/panel/login — wrong password returns 401
- [ ] Test: POST /api/panel/login — rate limit after 10 attempts
- [ ] Test: GET /api/panel/products — without JWT returns 401
- [ ] Test: GET /flooring/carpets/duna — returns valid HTML with product data
- [x] ~~A test that boots the DB layer under both `DB_TYPE` values~~ → no longer applicable, SQLite was
      dropped entirely rather than fixed (see 0.5-A) — there's only one `DB_TYPE` value now
- [x] **Done 31 Jul 2026** (PR #34) — **Highest-priority single test to add (from 0.5-H):** POST to
      `/api/leads` with valid data, assert `201`. Built using an in-memory Postgres (`pg-mem`) running the
      real `migrate-auto.js`, specifically so it validates real column existence rather than trusting a
      JS-level mock that would pass even with the original bug still present. Verified both directions —
      confirmed it fails when the exact `audit_log` bug is reintroduced, confirmed it passes once fixed —
      before calling it done. See 0.5-H for the full account.

### 5D — Dependency cleanup
- [x] ~~Remove express-session~~ → confirmed already gone, not in package.json (verified 26 Jul)
- [x] ~~Remove undici~~ → confirmed already gone, not in package.json (verified 26 Jul)
- [x] ~~Evaluate pdf-parse~~ → confirmed already gone, not in package.json (verified 26 Jul)
- [x] ~~Evaluate better-sqlite3~~ → resolved, removed entirely as part of dropping SQLite (0.5-A)
- [x] **`sharp` removed** (26 Jul) — flagged twice before (second audit 10 Jul, third/fourth audits 26 Jul)
      and never actually removed until now. `npm audit` had shown it carried a high-severity
      vulnerability; since it was confirmed 100% unused, removing it eliminated the vulnerability
      entirely rather than needing the breaking-change `npm audit fix --force` route.
      → `chore/remove-sharp-and-audit-fix`
- [x] **`body-parser` and `morgan` vulnerabilities fixed** (26 Jul) — both via plain, non-breaking
      `npm audit fix`. `npm audit` now reports **0 vulnerabilities**. Verified for real, not just by
      reading the diff: booted the actual server locally afterward and sent a real request through the
      updated middleware — got the expected response, not a crash → same PR as above
- [ ] Update all dependencies to latest minor versions: `npm update`
- [x] ~~Run `npm audit`~~ → done 26 Jul, all three findings now fixed, 0 vulnerabilities remaining

### 5E — Developer experience
- [x] **Done 29–31 Jul 2026** (PR #30): README.md rewritten from scratch against the current code —
      setup instructions, full env var table (including `JWT_SECRET`, previously undocumented despite the
      server refusing to boot without it), npm scripts, deployment model, security summary, and a "Known
      Gaps" section cross-referenced to this checklist so it doesn't go stale silently again. See the
      29–31 Jul update note above for what specifically changed and why.
- [ ] Add CONTRIBUTING.md with commit conventions and workflow *(the convention already exists informally — see §10 below — just needs to be its own file)*
- [x] package-lock.json in repo
- [x] **Done** (dated before this correction was noticed — confirmed already present by direct grep of
      `package.json`, 1 Aug 2026 reconciliation pass): `"admin:reset-password": "node scripts/reset-admin-password.js"`
      is in `package.json`. This item was left open here after the fix landed; the checklist entry itself
      had drifted from the code, which is the same class of problem `5E`'s README rewrite exists to
      prevent — see the note below.
- [ ] Add `"db:migrate"` to package.json scripts (Phase 1C)
- [x] Rename env.example.txt → .env.example
- [x] **Done 1 Aug 2026 (reconciliation pass):** README.md had drifted from actual code in 4 places since
      the 29–31 Jul rewrite above — 3 caused by real work landing after the rewrite without a follow-up
      README pass (PR #32's dead-route removal, PR #34's real test replacing the placeholder, and PR #39's
      auth-middleware consolidation), plus one undocumented npm script. All 4 corrected in the same PR as
      this checklist update. **The lesson, not just the fix**: a README rewrite is a snapshot, not a
      standing guarantee — it goes stale again the next time a PR changes something it describes and
      nobody does a matching README edit. Going forward, any PR that changes something the README
      documents (an endpoint, a script, a file's location, a "Known Gaps" item) should update the README
      in the same commit, the same way this checklist is expected to be — not as a separate deferred pass.

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
| 0.5 — Audit Findings | 🟡 In Progress *(0.5-A/B/C/D/E/F/H all done; 0.5-I's core fix done, 2 optional follow-ups still open; only 0.5-G — 2 minor hygiene items, `.vercel/README.txt` cleanup and `og-image.jpg` — genuinely remains. Corrected 2 Aug 2026: this row previously undercounted 6 of 8 sub-sections as still open)* | Jul 2026 | — |
| 1 — Admin Portal | 🟡 In Progress *(1A and 1C done; 1B down to one manual verification step; 1D down to one manual git-history check; 1E partially done, rest deliberately deferred to a planned redesign; 1F not started)* | May 2026 | — |
| 2 — Content | ⬜ Not started | — | — |
| 3 — Website | ⬜ Not started | — | — |
| 4 — Automation | ⬜ Not started | — | — |
| 5 — Code Quality | 🟡 In Progress *(**5A architecture consolidation: complete, all 5 steps** — auth middleware unified, routes/products.js + routes/panel.js + routes/scraper.js + routes/products-seo.js all migrated to src/, routes/ directory removed entirely, error-handling leaks closed everywhere, like/unlike duplication resolved; 5B CSV-injection fix, JWT algorithm pinning, and sync-bcrypt fix done; 5E README rewrite done; 5C now has its first two tests, most of it still open — see the update notes above for detail)* | Jul 2026 | — |
| 6 — Performance | ⬜ Not started | — | — |
| 7 — Scale | ⬜ Future | — | — |

---

## How to Resume in a New Chat

Paste this at the start of any new conversation:

---
*"I am building a flooring lead-generation platform (West Yorkshire Carpets).
Read README.md and MASTER_CHECKLIST.md, which I will attach — README.md for how the system actually
works today, MASTER_CHECKLIST.md for what's done and what's still open.
Find the first unchecked item in the checklist and let's work on it.
Work like a senior full-stack engineer — no shortcuts, no hardcoded values,
no patches. One task at a time, commit after each change. The production site
is live and works — never make a change that can't be verified before it
reaches `main`."*

Then attach both README.md and MASTER_CHECKLIST.md.

**Corrected 1 Aug 2026 (documentation reconciliation pass):** this used to say `PROJECT_CONTEXT.md` and
`MASTER_CHECKLIST.md`, with no caveat. `PROJECT_CONTEXT.md` hasn't been updated since 27 May 2026 and is
now formally archived — see its own banner. Attaching it to a new session used to mean handing that
session wrong architecture facts (stale file paths, a fictional API route, wrong env var names) at the
exact moment it was most likely to act on them uncritically. `PROJECT_CONTEXT.md §1` (business model) is
still worth reading if the session needs business context, not technical context — but it's no longer
part of the default onboarding pair.
---
