# WYC — Project Context & Handover Document
**Version:** 1.0 | **Last updated:** May 2026
**Use this document to:** onboard a new developer, resume in a new chat, or audit progress.

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

**Current state:** Functional prototype. Live in production. No real products yet.

---

## 2. Tech Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Vanilla HTML/CSS/JS | Vercel |
| Backend | Node.js + Express | Railway |
| Database | PostgreSQL | Railway (managed) |
| Image storage | Cloudinary | Cloudinary free tier |
| Email | Nodemailer (SMTP) | Disabled in dev |
| Auth | JWT (8h expiry) | — |
| Logging | Winston | — |

**Key versions:**
- Node: ≥18.0.0
- Express: 4.18.x
- pg: 8.19.x

---

## 3. Repository Structure

```
project/
├── admin/
│   ├── index.html          ← MONOLITHIC: 3,669 lines. HTML + CSS + JS all inline.
│   └── images/             ← Duplicate of root images/ — to be cleaned
├── css/
│   ├── styles.css          ← Main website styles
│   ├── catalogue.css       ← Catalogue overlay/page styles
│   └── product-page.css    ← SSR product page styles
├── images/                 ← Static assets (logo, hero, gallery, tiktok screenshots)
├── js/
│   ├── script.js           ← Homepage scripts (calculator, animations, nav)
│   ├── form-handler.js     ← Lead form submission (⚠️ hardcoded Railway URL)
│   ├── catalogue.js        ← Catalogue overlay logic (⚠️ hardcoded Railway URL)
│   └── product-page.js     ← Product page JS (calculator, PDF, lightbox)
├── routes/                 ← ⚠️ LEGACY LAYER — partially superseded, still active
│   ├── admin.js            ← Old admin router (mounted at /api/panel)
│   ├── products.js         ← Old products router
│   ├── scraper.js          ← Catalogue importer (⚠️ own DB pool, supplier name leaks)
│   └── suppliers/          ← Web scrapers per supplier (cld, cormar, victoria, etc.)
├── src/                    ← NEW LAYER — refactored architecture
│   ├── config/
│   │   ├── database.js     ← PostgreSQL/SQLite abstraction layer
│   │   └── schema.sql      ← SQLite schema (legacy, not used in production)
│   ├── controllers/
│   │   ├── adminController.js
│   │   └── leadController.js
│   ├── middleware/
│   │   ├── security.js     ← Helmet, CORS, rate limiting. ⚠️ csrfValidator is a stub
│   │   └── validate.js     ← express-validator input validation
│   ├── routes/
│   │   ├── admin.js        ← New admin router (mounted at /api/admin)
│   │   └── leads.js        ← Lead routes
│   ├── services/
│   │   ├── emailService.js ← Nodemailer email templates
│   │   └── csvService.js   ← Lead CSV export
│   └── utils/
│       └── logger.js       ← Winston logger
├── scripts/
│   ├── generate-hash.js    ← Utility: generates bcrypt hash from .env password
│   └── reset-admin-password.js ← Utility: resets admin password in DB
├── index.html              ← Main website landing page
├── catalogue.html          ← ⚠️ PLANNED but not yet built
├── privacy-policy.html
├── terms.html
├── robots.txt
├── sitemap.xml
├── sitemap-pages.xml
├── server.js               ← Express app entry point
├── migrate-auto.js         ← ⚠️ Runs schema + seeds on every server start
├── package.json
├── vercel.json             ← Frontend deployment config
└── netlify.toml            ← ⚠️ ORPHANED — should be deleted
```

---

## 4. Active API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | None | Server health check |
| POST | /api/leads | None | Submit lead form |
| GET | /api/leads | JWT | List leads (src/routes) |
| POST | /api/panel/login | Rate limited | Admin login → returns JWT |
| GET | /api/panel/stats | JWT | Dashboard stats |
| GET | /api/panel/products | JWT | List products |
| POST | /api/panel/products | JWT | Create product |
| PUT | /api/panel/products/:id | JWT | Update product |
| DELETE | /api/panel/products/:id | JWT | Delete product |
| POST | /api/panel/scrape-family | JWT | Scrape supplier URL |
| POST | /api/panel/import-family | JWT | Import scraped products |
| GET | /flooring/:category/:slug | None | SSR product page (SEO) |
| GET | /flooring/sitemap.xml | None | Dynamic sitemap |
| GET | /admin | None | Serve admin panel HTML |

---

## 5. Environment Variables

### Required on Railway (wyc-backend service):

```env
# Database
DB_TYPE=postgres
PGHOST=postgres.railway.internal
PGPORT=5432
PGDATABASE=railway
PGUSER=postgres
PGPASSWORD=<from Railway Postgres service Variables tab>

# App
NODE_ENV=production
PORT=8080
JWT_SECRET=<strong random string, min 32 chars>
ALLOWED_ORIGIN=https://www.westyorkshirecarpets.com,https://project-rho-nine-19.vercel.app

# Email (optional)
MAIL_ENABLED=false
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=

# Cloudinary (for product images)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Required locally (.env file):

Same as above but with:
```env
PGHOST=hopper.proxy.rlwy.net   ← Public Railway host for local dev
PGPORT=10115                    ← Public Railway port
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:5500
```

---

## 6. Known Critical Issues

### 🔴 CRITICAL

| # | Issue | File | Impact |
|---|-------|------|--------|
| C1 | CSRF validator is empty stub — does nothing | src/middleware/security.js | Security |
| C2 | Admin password hardcoded in source code | migrate-auto.js | Security |
| C3 | Dual routing architecture — both layers active simultaneously | server.js | Maintainability |
| C4 | Three separate PostgreSQL connection pools | database.js + products-seo.js + scraper.js | Reliability |
| C5 | Migrations run on every server start | migrate-auto.js | Stability |

### 🟠 HIGH

| # | Issue | File | Impact |
|---|-------|------|--------|
| H1 | Supplier name leaks into imported products | routes/scraper.js | Business critical |
| H2 | Railway backend URL hardcoded in frontend JS | js/form-handler.js, js/catalogue.js | Dev workflow |
| H3 | admin/index.html is 3,669 lines (all inline) | admin/index.html | Maintainability |
| H4 | og-image.jpg referenced but doesn't exist | index.html | SEO/Social |
| H5 | Google Analytics not configured | index.html | Business |
| H6 | Zero automated tests | — | Quality |
| H7 | package-lock.json not in repo | — | Reproducibility |

### 🟡 MEDIUM

| # | Issue | File | Impact |
|---|-------|------|--------|
| M1 | Catalogue is a modal overlay, not a page | index.html | UX/SEO |
| M2 | netlify.toml orphaned | netlify.toml | Confusion |
| M3 | express-session in deps but unused | package.json | Bundle size |
| M4 | undici + axios both present (duplicate) | package.json | Bundle size |
| M5 | npm scripts db:seed and test are broken | package.json | DX |
| M6 | Audit log never records IP address | routes/admin.js | Security |
| M7 | "licence" typo in package.json | package.json | Minor |

---

## 7. Architecture Decisions Already Made

- **Frontend on Vercel, backend on Railway** — correct, keep this split
- **PostgreSQL in production, SQLite option for local** — abstraction in database.js
- **SSR product pages** at /flooring/:category/:slug — correct for SEO
- **JWT auth, no sessions** — correct for stateless API
- **Cloudinary for images** — correct, keep

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

**Local dev:**
- Backend: npm run dev → http://localhost:3001
- Frontend: VS Code Live Server → http://127.0.0.1:5500
- Database: connects to Railway PostgreSQL via public URL in .env

---

## 9. Supplier Scrapers

The import catalogue feature scrapes these suppliers:

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
Only the owner's brand name is visible.

---

## 10. For the Next Developer / Chat Session

### Before starting any work:

1. Read this document fully
2. Read MASTER_CHECKLIST.md — find the first unchecked item
3. Run `npm run dev` — confirm server starts cleanly
4. Open http://127.0.0.1:5500 — confirm frontend loads
5. Log into the admin panel — confirm it works

### The single most important rule:

**One change at a time. Commit after each change. Never mix multiple fixes in one commit.**

### Git commit conventions:

```
feat: add new feature
fix: bug fix
refactor: code restructure, no behaviour change
chore: cleanup, deps, config
docs: documentation only
```

### The non-negotiables:

- No supplier names in any customer-facing content
- No hardcoded URLs or secrets in source code
- Every database query goes through src/config/database.js
- All new routes go in src/routes/ + src/controllers/
- admin/index.html must eventually be split into separate files

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
| GitHub repo | [your repo URL] |
