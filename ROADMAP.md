# Roadmap — From Solid Foundation to Operating Business

**Last updated:** 4 Aug 2026

## What this document is, and isn't

This is the **sequencing layer** — the order things should happen in, and why, written down so
it doesn't just live in conversation history. It is deliberately not a task list: `MASTER_CHECKLIST.md`
already has detailed, granular, checkbox-level breakdowns for most of what's below (Phases 2–6 there
are genuinely well thought out already, not stubs) — this document doesn't repeat that content, it
tells you what order to tackle it in and why, and names the one real gap that isn't tracked anywhere
else.

**If this document and `MASTER_CHECKLIST.md` ever disagree on whether something is done, trust
`MASTER_CHECKLIST.md`** — same rule as everywhere else in this project's documentation. This file is
about sequencing and reasoning, which don't go stale the way "is X done" does; if a stage below ever
needs correcting, it's more likely the *order* was wrong than a fact being outdated.

---

## Where things actually stand (4 Aug 2026)

The technical foundation — backend architecture, security posture, migrations, documentation accuracy
— is solid. See `MASTER_CHECKLIST.md`'s Progress Tracker for the current state of each phase; it's kept
accurate, this document doesn't repeat it. Nothing in Phases 2–7 below has started yet, by design —
foundation work came first on purpose, because it's expensive to fix later and cheap to fix now.
Everything from here on is genuinely new ground.

---

## Stage 0 — Rebrand: business name, domain, visual identity

**Not currently tracked anywhere else in this project's documentation.** `MASTER_CHECKLIST.md` `2B`
covers *product collection* names ("The Heritage Collection," etc.) — a real but narrower thing than
the business itself having a settled name. This stage is that: business name, registered domain, logo,
colour palette, voice. It's a business decision, not an engineering one, and nothing here can be
delegated to code.

**Why this genuinely has to come first, not just "should":** it's a hard dependency, not a preference.
The redesign (Stage 1) can't have a real visual identity without one existing yet. Content (Stage 2)
can't be written in a brand voice that doesn't exist yet. Every currently-deferred bug that involves the
dead `www.westyorkshirecarpets.com` domain — the `og-image.jpg` gap and the hardcoded-dead-domain items
in `MASTER_CHECKLIST.md` `3A` — resolves as a natural side effect of this stage, not as separate tickets
to work through later.

---

## Stage 1 — Redesign: landing page + admin portal, features decided once

Once Stage 0 is settled. Covers `MASTER_CHECKLIST.md` `1E` (the admin panel's remaining code split),
`3B`/`3C`/`3D` (catalogue-as-a-page, product page improvements, landing page redesign).

**Two things worth doing deliberately here, not as afterthoughts:**
- `1E` (splitting `admin/index.html`'s remaining ~2,400 lines) was intentionally left unfinished all the
  way back at the start of this project's cleanup work, specifically so it could be done *as part of*
  this redesign instead of before it — this is that moment, not a separate task to schedule.
- Decide the final admin feature set here, before content exists. `MASTER_CHECKLIST.md` `1F`'s list
  (bulk select, WhatsApp quick-reply, filter persistence, etc.) is a reasonable starting menu, but this
  is the point to actually decide what's in and what's cut, not just work through the list top to
  bottom. Building real content (Stage 2) against a UI that's about to change means writing it twice.

---

## Stage 2 — Real content

Once Stage 1 exists to put content into. Covers `MASTER_CHECKLIST.md` `2A`/`2B`.

Content authored directly into final templates, once — not into a placeholder layout that gets
redesigned out from under it. The supplier-scraper/import tool (built and hardened earlier this
project) is a real asset here, not just infrastructure for its own sake: it already enforces "no
supplier branding leaks through" at the code level, so populating real products once there's a brand to
attach them to should be fast.

---

## Stage 3 — SEO

Split into two genuinely different halves, on purpose — treating "SEO" as one bucket tends to make the
technical half wait for the strategy half for no reason.

- **Technical** (`MASTER_CHECKLIST.md` `3E`): clean URLs, meta tag infrastructure, sitemap.xml,
  structured data. Mostly already built — the `/flooring` server-rendered pages already generate
  JSON-LD and sitemap entries. This is verification and hardening *during Stage 1's redesign work*, not
  a separate later phase. Doing it then, not after, is the point.
- **Content/strategy** (keyword targeting, copy written for search intent, Search Console, backlinks):
  genuinely can't start until Stage 2 (real content) and Stage 0 (real domain) both exist, so this half
  correctly comes last — but only this half, not the technical work alongside it.

---

## Stage 4 — Operational readiness

The "ready to operate, as if an agency delivered this" bar, right before real launch. Covers
`MASTER_CHECKLIST.md` Phase 6 (monitoring, caching, uptime checks) plus a few things not currently
tracked as their own checklist items anywhere:
- Actually test-restoring a database backup — `scripts/backup.sh` produces a file, but nothing has
  verified end-to-end that the file successfully restores.
- Legal pages (`privacy-policy.html`, `terms.html`) — worth a deliberate accuracy pass once the business
  itself (name, structure) is real, not left as whatever they currently say.
- Broader test coverage on admin operations, once the admin UI being tested is the final one, not one
  about to be redesigned out from under the tests.

**One nuance worth calling out**: `MASTER_CHECKLIST.md` `4A`'s email automation work — specifically
wiring up `sendCustomerConfirmation`, which the checklist itself flags as "fully built but never
called" — doesn't actually need to wait for Stage 0. The underlying plumbing (`MAIL_ENABLED`, SMTP
credentials, confirming the pipeline fires) is brand-independent infrastructure. Only the email
*templates'* final visual branding needs to wait. This is a legitimate candidate to pull forward and do
whenever, independent of the rest of this sequence — flagged here so it doesn't get stuck waiting on
Stage 0 for no real reason.

---

## Explicitly out of scope for now

`MASTER_CHECKLIST.md` Phase 7 (Scale — payments, installer/customer portals, multi-language, additional
product categories) is correctly gated in the checklist itself on the business actually generating
revenue. Nothing in this roadmap changes that; it stays there until Stages 0–4 above are real and
operating.

---

## Decisions only the business owner can make

Named explicitly, since these are the actual blocking dependencies for everything above, not
engineering tasks that can be delegated or estimated in story points:
- Business name and registered domain (Stage 0)
- Visual identity — logo, colour palette, voice (Stage 0)
- Final admin feature set — what's in `1F`'s list stays, what's cut, what's added (Stage 1)
- Content voice and product collection naming (Stage 2, `2B`)
