# WYC — Master Checklist
**How to use this:** Work top to bottom. Never skip a phase.
Mark each item [ ] → [x] when complete.
Each item has a reference to the file(s) affected.

---

## PHASE 0 — Environment Setup
*Must be complete before any development work.*

- [x] Backend runs locally: `npm run dev` → http://localhost:3001
- [x] Frontend runs locally: Live Server → http://127.0.0.1:5500
- [x] Admin panel accessible and login works
- [x] Railway PostgreSQL connected (production DB)
- [x] .env file has all required variables (see PROJECT_CONTEXT.md §5)
- [ ] package-lock.json committed to repo
      → Run: `npm install` then `git add package-lock.json && git commit -m "chore: add lockfile"`
- [ ] .env.example updated with all current variables including CLOUDINARY_*
      → File: env.example.txt (also rename to .env.example)
- [ ] netlify.toml deleted
      → `git rm netlify.toml && git commit -m "chore: remove orphaned netlify config"`

---

## PHASE 1 — Admin Portal: Logic & Code Quality

### 1A — Scraper / Import Catalogue (HIGHEST PRIORITY)
*Goal: Zero supplier branding in any imported product.*

- [ ] routes/scraper.js — Remove supplierName from all API responses
      → The /api/panel/scrape-family response must not include supplier name
- [ ] routes/scraper.js — Auto-generated description must not include supplier name
      → Description field should be empty or generic ("Premium carpet, [style] pile")
- [ ] routes/scraper.js — Use shared db from src/config/database.js
      → Remove `const { Pool } = require('pg'); const pool = new Pool({...})`
      → Replace with `const db = require('../src/config/database')`
- [ ] admin/index.html — Remove "Supplier Name" column from colour variants table
      → Section: Import Catalogue → Step 3 "Colour variants"
- [ ] admin/index.html — Description field starts empty, not pre-filled with supplier text
- [ ] admin/index.html — "WYC Product Name" is the only name field visible
- [ ] Test: Import a product from carpetlinedirect.co.uk → verify zero supplier references

### 1B — Database Connection Consolidation
*Goal: One connection pool, used everywhere.*

- [ ] routes/products-seo.js — Remove standalone `new Pool()` — use shared db
      → Replace with `const db = require('./src/config/database')` (adjust path)
- [ ] routes/scraper.js — Same as above (covered in 1A)
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
- [ ] migrate-auto.js — Admin seed reads from env var, not hardcoded string
      → `const pwd = process.env.ADMIN_SEED_PASSWORD` (blocked by 1C — do after migration refactor)
- [ ] Add ADMIN_SEED_PASSWORD to .env.example with a placeholder value
- [ ] Verify: `git log --all -S "Admin@WYC2026"` returns no results

### 1E — Admin Panel: Split the monolith
*Goal: admin/index.html split into maintainable files.*

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
      → Fix: `null` → `req.ip` in routes/admin.js audit() function
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
- [ ] Remove hardcoded Railway URL from js/form-handler.js
      → Replace with relative path or window.WYC_CONFIG.apiBase
- [ ] Remove hardcoded Railway URL from js/catalogue.js
      → Same approach
- [ ] Fix broken npm scripts in package.json
      → db:seed: point to correct file or delete
      → test: create placeholder test or delete
- [ ] Fix "licence" typo → "license" in package.json
- [ ] Remove express-session from dependencies (not used)
- [ ] Remove undici from dependencies (axios already handles HTTP)

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
- [ ] Hero — replace 212.png with optimised WebP hero image
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

- [ ] Migrate all functionality from routes/admin.js → src/controllers/ + src/routes/
- [ ] Migrate all functionality from routes/products.js → src/controllers/
- [ ] Remove routes/ directory entirely
- [ ] Verify: server.js only imports from src/
- [ ] Update server.js route mounts to match new structure
- [ ] Remove migrate-sqlite-local.js (local dev artefact, no longer needed)

### 5B — Security hardening
- [ ] Implement CSRF protection properly
      → src/middleware/security.js csrfValidator() must validate token
      → Token cookie must be set on page load
      → Lead form and admin mutations must send X-CSRF-Token header
- [ ] Add Content-Security-Policy header to catalogue.html and product pages
- [ ] Admin panel — add IP allowlist option via environment variable
      → If ADMIN_ALLOWED_IPS is set, reject requests from other IPs
- [ ] Review CORS allowed origins — ensure no wildcards in production
- [ ] Ensure all admin routes return 401 (not 403 or 404) for missing JWT
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

### 5D — Dependency cleanup
- [ ] Remove express-session (unused)
- [ ] Remove undici (duplicate of axios)
- [ ] Evaluate pdf-parse — document what it's used for or remove it
- [ ] Evaluate better-sqlite3 — move to devDependencies if only used locally
- [ ] Update all dependencies to latest minor versions: `npm update`
- [ ] Run `npm audit` — fix any high/critical vulnerabilities

### 5E — Developer experience
- [ ] Add README.md with setup instructions, env vars, scripts
- [ ] Add CONTRIBUTING.md with commit conventions and workflow
- [ ] package-lock.json in repo (Phase 0 — verify done)
- [ ] Add `"admin:reset-password"` to package.json scripts (done in session)
- [ ] Add `"db:migrate"` to package.json scripts (Phase 1C)
- [ ] Rename env.example.txt → .env.example

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
| 0 — Environment | 🟡 In Progress | May 2026 | — |
| 1 — Admin Portal | ⬜ Not started | — | — |
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
no patches. One task at a time, commit after each change."*

Then attach both PROJECT_CONTEXT.md and MASTER_CHECKLIST.md.
---
