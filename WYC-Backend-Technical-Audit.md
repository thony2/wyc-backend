# Technical Audit — `thony2/wyc-backend`
**West Yorkshire Carpets — Lead Management & Catalogue Backend**

> **📋 ARCHIVED — historical snapshot, superseded.** This audit reflects the repository as it stood on
> **7 July 2026** only. It was the first of what became a recurring self-audit practice on this project;
> its findings have since been absorbed into, and superseded by, `MASTER_CHECKLIST.md`, which is the
> current, actively-maintained source of truth for implementation status. Two independent re-verifications
> (26 Jul, 1 Aug 2026) confirmed this document's findings were accurate *for that date* — most have since
> been resolved (tracked in `MASTER_CHECKLIST.md`); a handful (hardcoded frontend URL, ops-script paths,
> unoptimized images, missing `og-image.jpg`) are, as of 1 Aug 2026, still open and still accurately
> described here. Read this as a dated history document, not a current action list — check
> `MASTER_CHECKLIST.md` for what's actually still outstanding today.
>
> This document's own "Activity Timeline" table (§1) was independently checked against direct `git log`
> queries on 1 Aug 2026 and found to be substantially inaccurate for the two oldest periods it covers
> (its commit counts for 10 Mar–5 Apr and 24–30 May don't reconcile with the actual repository history —
> the two most recent periods it covers do match exactly). This doesn't affect the document's code-level
> findings, which independently check out, but the timeline table specifically shouldn't be relied on.

Audited: 7 July 2026 · Method: full local clone + static analysis + targeted empirical verification (dependency inspection, git archaeology, cross-referencing docs against source). Not a black-box review — every finding below is traced to a specific file, line, or commit.

---

## 0. Executive Summary

This is a **real, actively-developed, mostly well-engineered prototype** — not a toy project. The security fundamentals (parameterized SQL, bcrypt, JWT, rate limiting, GDPR-aware deletion) are implemented correctly. The team (or you, in an earlier session) also left behind unusually good internal documentation (`PROJECT_CONTEXT.md`, `MASTER_CHECKLIST.md`) that already self-diagnoses much of the project's debt.

However, I found **one showstopper bug that the existing docs don't mention**: as configured today, **the application cannot function in its own documented default local-dev setup (SQLite).** Every database call in the app will throw at runtime unless `DB_TYPE=postgres` is set. This is on top of the architectural debt the project's own checklist already flags (dual routing layers, an unfinished refactor, a 3,663-line monolithic admin panel).

Git history shows a clear pattern: heavy work Mar 10 – Apr 5, a burst May 24–30, then dormancy — and you've already restarted, with 22 commits in the last three days (Jul 5–7). This audit is a snapshot of exactly where that resumption left off.

**Bottom line:** the frontend and the "shape" of the backend are solid. The critical path to get productive again is: (1) fix the SQLite/Postgres split, (2) clean up three pieces of dead/broken repo debris (below), (3) work through the excellent checklist you already wrote in May, most of which is still valid.

---

## 1. Activity Timeline (from git log)

| Period | Commits | Notes |
|---|---|---|
| 10 Mar – 5 Apr 2026 | ~74 | Initial build-out, security hardening, admin panel, product API |
| 24 – 30 May 2026 | 14 | `PROJECT_CONTEXT.md` / `MASTER_CHECKLIST.md` written here — a deliberate "handover to future self" |
| 30 May – 5 Jul 2026 | **0** | The dormant period you referred to |
| 5 – 7 Jul 2026 (today) | 22 | Resumption in progress: JWT hardening, file renames, dead-code cleanup, hardcoded-password removal |

You're not starting from zero — you (or a prior session) already did real cleanup work three days ago. Some items in `MASTER_CHECKLIST.md` are now stale/complete even though they're still unchecked (see §6).

---

## 2. Critical Findings — fix before anything else

### 🔴 C-1: The app is non-functional in its own documented default configuration
`.env.example` states plainly: *"SQLite is used by default (great for local dev)."* This is **false as the code stands.**

- `src/config/database.js` only returns an object with a working `.query()` method when `DB_TYPE=postgres`. When `DB_TYPE=sqlite` (the default), it returns the **raw `better-sqlite3` instance**, which has `.prepare()`, `.exec()`, `.pragma()` — but **no `.query()` method at all** (confirmed against the official better-sqlite3 API docs).
- `db.query(...)` is called **117 times across 9 files** (`leadController.js`, `adminController.js`, both copies of `panel.js`, `products.js`, `scraper.js`, `migrate-auto.js`, `seed-products.js`, `reset-admin-password.js`).
- Even if `.query()` existed, the SQL itself is Postgres-only dialect throughout (`SERIAL PRIMARY KEY`, `NOW()`, `INTERVAL '7 days'`, `ON CONFLICT ... DO NOTHING`, `ADD COLUMN IF NOT EXISTS`) — none of which SQLite supports.

**Effect:** run `npm run dev` with a stock `.env` copied from `.env.example`, and the server *boots* (the migration failure is silently caught and logged), but the instant you submit the lead form, log into `/admin`, or hit any API route, you get `TypeError: db.query is not a function`. The app only works today because production is hard-set to Postgres — the SQLite path is a dead, misleading illusion of a "local dev mode."

**Fix:** Given `PROJECT_CONTEXT.md` already confirms Postgres is the committed production choice, the cheapest correct fix is to **drop the pretense of SQLite support** — remove the SQLite branch (or make it throw a clear startup error), delete `src/config/schema.sql` (legacy/unused per your own notes), and update `.env.example`/README so a fresh clone can't silently misconfigure itself.

### 🔴 C-2: Three incompatible database-credential schemes coexist
- `src/config/database.js` (the "real" shared config) expects **`PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`**.
- `routes/products-seo.js` runs its **own separate `new Pool()`** using a single **`DATABASE_URL`** connection string — a variable that appears **nowhere** in `.env.example` or in the Railway variable list documented in `PROJECT_CONTEXT.md §5`.

This route serves `/flooring/:category/:slug` — your SEO product pages, arguably the most business-critical route given the stated "SEO-ranked web presence is the core asset" model. If `DATABASE_URL` isn't manually set on Railway (outside of any documented process), this route silently fails to connect correctly. This is the same root issue as your own checklist's **C4 "three separate connection pools"** — it's now down to two (scraper.js was already fixed to use the shared pool), but `products-seo.js` still hasn't been migrated.

### 🔴 C-3: Root-level `panel.js` is dead, byte-identical duplicate code — the file you linked me to
This explains itself once you see the history: commit `cf14136` renamed `routes/admin.js` → `routes/panel.js`, but the **original copy at repo root was never deleted**. `server.js` only ever `require()`s `./routes/panel` — the root file is loaded by nothing.

```
diff panel.js routes/panel.js   →  logic-identical (only whitespace differs)
grep "require.*panel"           →  no reference to root panel.js anywhere
```

This is a real trap: if you (understandably, after months away) start editing `/panel.js` at the repo root — which is exactly what the link you sent me points to — **none of your changes will have any effect on the running application.** `routes/panel.js` is the live file.

**Fix:** `git rm panel.js` at the root.

### 🔴 C-4: A broken, orphaned git submodule sitting at the repo root
The path `wyc-backend` (yes, same name as the repo) is tracked in git as a **submodule gitlink** (mode `160000`, pointing at commit `88d5621...`) with **no `.gitmodules` file** to back it up. History shows why: commit `fe1ecc3` ("remove old files and wyc-backend copy") was immediately followed by `46681af` ("**Revert** 'chore: remove old files and wyc-backend copy'") — undoing the cleanup. It now sits as a permanently empty, broken directory that will confuse any tool that understands git submodules (CI checkouts, `git submodule status`, some GUI clients).

**Fix:** `git rm --cached wyc-backend` (no working-tree files will be lost — it's already empty) and commit.

---

## 3. High-Severity Findings

| # | Issue | Evidence | Status |
|---|---|---|---|
| H-1 | `npm run db:seed` is broken | `package.json` points to `src/config/seedDb.js`, which **does not exist** in the repo | New finding — not in your checklist |
| H-2 | `npm run admin:reset-password` doesn't exist | `scripts/reset-admin-password.js`'s own header says to run it via that npm script; `package.json` has no such entry — you must know to call `node scripts/reset-admin-password.js` directly | New finding |
| H-3 | Production Railway URL hardcoded in 4 frontend files, 5 call sites | `js/form-handler.js:4`, `js/catalogue.js:1113/1660/1770`, `js/product-page.js:474` | Already flagged as your own **H2**, still open |
| H-4 | `admin/index.html` is a 3,663-line monolith (HTML+CSS+JS inline) | `wc -l` confirms, essentially unchanged since May | Already flagged as **H3 / Phase 1E**, zero progress — all 10 sub-tasks still unchecked |
| H-5 | README's Security Summary claims active CSRF protection; it was deliberately removed | Commits `b7dda53`/`3bfe28e` stripped CSRF validation from the lead route in favor of relying on CORS. `GET /api/csrf-token` still exists and issues a token **that nothing checks** — dead endpoint, and the README is now factually wrong | New finding (design decision may be reasonable — see §7 — but docs are stale) |
| H-6 | Ops scripts hardcode one developer's local machine path and assume SQLite | `scripts/backup.sh` / `check-leads.sh` / `check.sh` reference `/Users/potencial/Desktop/project/wyc-backend/...` and query `data/wyc_leads.db` directly — but production is Postgres-only per your own architecture decision. These scripts cannot run correctly anywhere they currently exist | New finding |
| H-7 | `og:image` meta tag points to a file that doesn't exist | `index.html:27` references `/images/og-image.jpg` — confirmed absent from the entire repo | Already flagged as **H4**, still open — every social/WhatsApp share of your site shows a broken preview image |
| H-8 | Audit log for products/offers/logins never records IP address | `routes/panel.js`'s local `audit()` helper hardcodes the IP param to `null`; the *separate* `adminController.js` audit function does it correctly | Already flagged as **M6 / 1F**, only half-fixed — the newer `src/` layer got the fix, the legacy `routes/panel.js` layer didn't |

---

## 4. Medium / Hygiene Findings

- **M-1** — `"licence"` (should be `"license"`) in `package.json`. Cosmetic, but some tooling (license-checkers, npm registry metadata) won't recognize it. Already flagged, still present.
- **M-2** — The commit message "fix: remove supplier branding from import catalogue" appears **twice**, identically (`4a130c7`, `714c7b5`) — suggests the first attempt didn't stick. Your own checklist item *"Test: Import a product from carpetlinedirect.co.uk → verify zero supplier references"* is still unchecked. **Recommend re-verifying this manually before your next real supplier import** — this is a stated business-critical rule ("customer must never see 'Carpet Line Direct'").
- **M-3** — `.vercel/README.txt` is committed to git despite `.vercel/` being listed in `.gitignore`. Harmless (no secrets in it), just shows the ignore rule was added after the fact and never fully cleaned up.
- **M-4** — Several marketing images are unoptimized: `212.png` 6.8MB, `bedroom.jpg` 8.1MB, `IMG_4166.jpg` 5.3MB, `carpet.png` 1.6MB, `wood.png` 1.9MB. On a site whose entire business model leans on organic SEO ranking, this actively hurts Core Web Vitals / page-speed scoring. Worth compressing and converting to WebP with responsive `srcset`.
- **M-5** — `admin/images/` duplicates root `images/` (already flagged in your docs, still open).
- **M-6** — `npm test` runs exactly one placeholder assertion (`1+1===2`). Zero real coverage — including of the SQLite bug in C-1, which automated tests against both `DB_TYPE` values would have caught immediately.

---

## 5. What's Actually Solid

To be fair and not one-sided:

- **No SQL injection surface found anywhere** — every query is parameterized; no string-concatenated SQL exists in the codebase.
- Password handling, JWT (with a mandatory fail-fast startup check if `JWT_SECRET` is missing), login rate-limiting, and a honeypot field on the public lead form are all implemented correctly and sensibly.
- `express-validator` input validation on `POST /api/leads` is genuinely thorough — UK phone/postcode regex, length caps, HTML-escaping.
- Helmet CSP + strict CORS allow-list + a real GDPR Article 17 soft-anonymisation flow on lead deletion is **better security/compliance hygiene than most small-business backends this size ever get.**
- `.gitignore` correctly excludes `.env`, the SQLite data directory, and logs — I did not find any committed secrets or live credentials in the current tree.
- `PROJECT_CONTEXT.md` and `MASTER_CHECKLIST.md` are genuinely excellent engineering practice — most solo/small projects never leave this kind of structured handover trail. The last three days of commits follow the "one change per commit" discipline they call for.

---

## 6. Your Own Checklist vs. Current Reality (May → now)

Your `MASTER_CHECKLIST.md` is dated May 2026 and is largely still accurate, but several items are stale in *both* directions:

| Item | May status | Actual status today |
|---|---|---|
| package-lock.json committed | ☐ unchecked | ✅ **Done** — file is present and in sync |
| `.env.example` renamed/updated | ☐ unchecked | ✅ **Done** |
| `netlify.toml` deleted | ☐ unchecked | ✅ **Done** |
| Admin password hardcoded (C2) | 🔴 flagged | ✅ **Fixed** — now reads `ADMIN_DEFAULT_PASSWORD` from env |
| CSRF validator is empty stub (C1) | 🔴 flagged | ⚠️ **Changed, not fixed** — validator was deleted entirely rather than implemented; README still claims it's active |
| Three DB pools (C4) | 🔴 flagged | ⚠️ **Improved** — down to two (`database.js` + `products-seo.js`); scraper.js was migrated to shared pool |
| Supplier name leak (H1) | 🔴 flagged | ⚠️ **Unclear** — code changes made twice, but the checklist's own verification test was never run |
| Split `admin/index.html` (H3) | 🔴 flagged | ❌ **No progress** — still 3,663 lines |
| `db:seed` broken (M5) | 🟡 flagged | ❌ **Still broken**, plus I found a second broken script (`admin:reset-password`) not in your original list |

---

## 7. Documentation vs. Reality — README.md specifically

| README claims | Reality |
|---|---|
| "SQLite is used by default" / Quick Start works out of the box | Broken — see C-1 |
| CSRF: "Double-submit cookie pattern" listed as an active defence | Removed from code in July; CORS is the actual current defence |
| Project structure diagram shows only `src/` | Real, but incomplete — omits `routes/`, `admin/`, `js/`, which together hold more runtime logic than `src/` does. A returning developer reading only the README would not know the legacy layer exists or is still load-bearing |

None of this is "wrong" maliciously — it's exactly what happens when a refactor gets 80% done and life intervenes. But it means **the README currently cannot be trusted as an onboarding document**; `PROJECT_CONTEXT.md` is the more accurate source, and even that needs the corrections above.

---

## 8. Recommended Action Plan

**Do today (< 1 hour total, unblocks everything else):**
1. Delete root `panel.js` (C-3).
2. Remove the broken submodule: `git rm --cached wyc-backend` (C-4).
3. Decide SQLite's fate — recommend killing it outright given production is Postgres-committed. Update `.env.example` default and README accordingly (C-1).
4. Point `routes/products-seo.js` at the shared `src/config/database.js` instead of its own `DATABASE_URL`-based pool (C-2).

**This week:**
5. Fix or remove the `db:seed` script — you already have `seed-products.js` at the root, which looks like it may already do this job; check for redundancy before writing a new one (H-1).
6. Fix `routes/panel.js`'s `audit()` to pass real IP, mirroring `adminController.js` (H-8).
7. Extract the hardcoded Railway URL into one shared frontend config constant (H-3).
8. Add an `og-image.jpg` and verify it renders in a link-preview tool (H-7).
9. Correct the README's security claims to match reality, or restore real CSRF validation if you want the claim to stay true (H-5).

**When you have a focused block of time:**
10. Work through Phase 1E of your own checklist — splitting `admin/index.html` — it's already fully scoped, just needs execution.
11. Re-run the supplier-import verification test your checklist already defines (M-2).
12. Compress the large images (M-4).
13. Replace the placeholder test with a handful of real ones — at minimum: lead validation rejects a malformed postcode/phone, and the admin auth guard rejects a missing/invalid JWT. This is the cheapest possible insurance against C-1 ever silently recurring.

---

## 9. Quick-Reference File Status

| Path | Status |
|---|---|
| `server.js` | OK — correctly wires the active routers |
| `routes/panel.js` | OK (live) |
| `panel.js` (root) | **Delete** — dead duplicate |
| `wyc-backend` (root dir) | **Delete** — broken git submodule |
| `src/config/database.js` | **Broken** for `DB_TYPE=sqlite`; OK for `postgres` |
| `src/config/schema.sql` | Legacy/unused (your own note) — candidate for deletion alongside SQLite removal |
| `migrate-auto.js` | Postgres-only despite running unconditionally on every boot; runs on every start (your own C5, still open) |
| `src/controllers/*`, `src/middleware/*`, `src/routes/*` | Good quality, Postgres-only (consistent with the rest) |
| `routes/products-seo.js` | **Risk** — own pool, undocumented env var |
| `routes/scraper.js`, `routes/suppliers/*` | Functional; supplier-name leak needs re-verification |
| `admin/index.html` | Functional but a 3,663-line monolith, needs the split you already scoped |
| `js/form-handler.js`, `js/catalogue.js`, `js/product-page.js` | Functional; hardcoded backend URL |
| `scripts/*.sh` | **Broken** — hardcoded personal machine paths, target the wrong database |
| `scripts/generate-hash.js`, `scripts/reset-admin-password.js` | Good quality |
| `src/tests/leads.test.js` | Placeholder only |

---

*Happy to go through any of the fixes above with you directly — the two highest-leverage next steps are almost certainly C-1 (SQLite/Postgres split) and C-3 (deleting the duplicate panel.js), since both are quick to fix and both are actively misleading about the true state of the app.*
