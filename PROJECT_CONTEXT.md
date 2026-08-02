# Project Context — Business Background

**Last updated:** 1 Aug 2026 · **Scope: business context only.** For anything technical — architecture,
API routes, environment variables, deployment, what's done and what's pending — use `README.md` and
`MASTER_CHECKLIST.md` instead. Those two are the actively-maintained technical sources of truth; this
document deliberately isn't, and doesn't try to be.

---

## What this is

A flooring e-commerce and lead-generation platform, being built as a personal business venture.

**The model:**
- Source flooring product from suppliers (Carpet Line Direct, Victoria, Cormar, and others — see
  `README.md`'s Project Structure for the current list of integrated suppliers)
- Rebrand it under the business's own name — no supplier branding visible to customers anywhere
- Sell online (eventually) or capture leads for a free measure & quote
- Pass installation leads to local fitters in exchange for commission on product + installation
- The core asset is intended to be SEO-ranked web presence, not physical stock

**Not evaluated by this document or any of the technical docs — a business/legal question someone should
look at separately:** the product-import pipeline (`routes/scraper.js`, `routes/suppliers/`) exists
specifically to pull content — images, specifications, descriptions — from supplier websites and re-host
it, rebranded, without attribution. Nothing in this repository's documentation addresses whether that's
been checked against the relevant suppliers' terms of service, or the copyright status of re-hosted
supplier photography. Flagging it here since this is the one document that's actually about the business
rather than the implementation.

---

## Current status (as of 1 Aug 2026)

**This is not a live business yet.** Specifically:
- No business name has been finalized. The repository and its documentation use "WYC" only because
  that's the existing repo name (`wyc-backend`) from earlier in the project, not because it's a
  confirmed brand.
- No domain is registered. The app runs on temporary Vercel/Railway URLs — see `README.md`'s
  "Deployment" section for the current, verified-live addresses; deliberately not duplicated here so
  there's only one place for that fact to go stale.
- No real customers, no real leads captured, no real products live for sale.

**What does exist and does work, right now:** the full technical stack described in `README.md` — lead
capture, admin panel, product catalogue, supplier scraping/import — is built and deployed. Treat the
current deployment as a live staging environment for continued development, not as a live business.

---

## For the next developer or chat session

Don't start with this document. Use `MASTER_CHECKLIST.md`'s own "How to Resume in a New Chat" section
(bottom of that file) — it's the current, correct version of this kind of instruction, and stays in sync
with the checklist itself rather than needing to be kept in sync with a second copy here.

**Git commit conventions** (the one piece of process guidance worth keeping in a document separate from
the technical ones):

```
feat: add new feature
fix: bug fix
refactor: code restructure, no behaviour change
chore: cleanup, deps, config
docs: documentation only
```
