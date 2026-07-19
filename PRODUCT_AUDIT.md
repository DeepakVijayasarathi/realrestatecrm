# Product Audit — RealRest / Thanjai Property CRM

**Audit date:** 2026-07-19
**Scope:** Full repository (`d:\realestate`) — backend, frontend, database, DevOps.
**Method:** Direct source inspection (every route module, every page, `schema.prisma`, `Jenkinsfile`, both `Dockerfile`s, `package.json`s) plus live verification against the running production database for several subsystems (auth rate limiting, template/audience data, timezone handling, inbound WhatsApp flow) during earlier work sessions on this repo.

---

## STEP 1 — Understand the Product

**What it is:** A real-estate lead/property/partner/vendor CRM for a single agency ("Thanjai Property", Tamil Nadu, India), self-hosted on a Jenkins-deployed Docker stack. Not a multi-tenant SaaS — one org, one Postgres database, role-based internal + partner-portal access.

**Users:**
- `SUPER_ADMIN` — full access, user management, integration secrets.
- `SALES_MANAGER` — leads, properties, reports, templates, partner/vendor management.
- `SALES_EXECUTIVE` — leads assigned to them, properties, WhatsApp sends.
- `PROPERTY_STAFF` — properties, vendor sourcing, AI agent.
- `PARTNER_USER` — external, scoped to their own company's referred leads only.

**Main business flow:**
1. A lead enters via manual entry, CSV import, public enquiry form, Meta Lead Ads webhook, or a generic lead webhook.
2. Staff work the lead through a 13-stage pipeline (`NEW_LEAD` → … → `REGISTRATION`/`LOST_CLOSED`), matching properties, sending WhatsApp messages (manual or stage-automated), scheduling site visits.
3. A lead can be handed to a `PartnerCompany` (external referral partner) instead of closed internally.
4. Property inventory is sourced from `Vendor`s (upstream suppliers) through a parallel 10-stage pipeline with its own WhatsApp automation (currently soft-disabled).
5. An AI console (OpenAI or Gemini) generates sales pitches, investment proposals, price predictions, and agreement drafts from real inventory/lead data.
6. A public blog and enquiry form feed the top of the funnel.

**Tech stack:**
- Backend: Node.js, Express 4, TypeScript, Prisma ORM, PostgreSQL, Zod validation, JWT auth (`jsonwebtoken`), `bcryptjs`, `multer` for uploads, `nodemailer` for email, `swagger-ui-express` for hand-written API docs.
- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript. No state-management library (plain `useState`/`useEffect` + a thin `api.ts` fetch wrapper).
- No test framework in either package (`no jest/vitest/mocha/playwright/cypress` dependency anywhere).
- Deployment: Docker (multi-stage builds), Jenkins pipeline building both images and running them as standalone containers on one host (`93.127.194.128`), Postgres runs outside this repo's Docker Compose (referenced by container name `postgres` on a shared `realcrm-net` network).

**External services:** WhatsApp (SmartPing/AiSensy campaign API, or Meta Cloud API, or MSG91 — pluggable), OpenAI or Google Gemini (pluggable), SMTP (nodemailer), Meta Lead Ads webhook, a generic website-sync webhook for the public marketing site's property catalog.

**Dependencies:** Deliberately minimal — no ORM alternatives, no UI kit (hand-built Tailwind components in `ui.tsx`), no axios (native `fetch`), no lodash. This is a strength (small attack surface, few supply-chain risks) and a weakness (every cross-cutting concern — pagination, toasts, confirm dialogs, date formatting — is hand-rolled and must be kept consistent by hand).

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Browser (staff)                          │
│         Next.js 14 App Router · React 18 · Tailwind (SPA-ish)       │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ fetch (Bearer JWT in Authorization)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express API  (single process)                   │
│  /api/auth  /api/leads  /api/properties  /api/partners  /api/vendors │
│  /api/whatsapp  /api/notifications  /api/reports  /api/settings     │
│  /api/ai  /api/blog  /api/integrations  /api/users                  │
│                                                                       │
│  Cross-cutting: requireAuth (JWT) → requireRole → zod validate()    │
│  Services: whatsapp, pipelineAutomation, vendorPipelineAutomation,   │
│  notification, audit, email, openai, matching, propertySync,        │
│  branding, integrationSettings                                      │
└───────┬───────────────┬───────────────┬───────────────┬─────────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
   PostgreSQL      /uploads volume   SmartPing/Meta/   OpenAI / Gemini
   (Prisma)        (multer, local    MSG91 (WhatsApp)   (AI features)
                    disk, no CDN)
        ▲
        │ inbound webhooks (delivery status + messages — same URL,
        │ dormant until BSP support enables it)
        │
┌───────┴─────────┐        ┌──────────────────────┐
│  Meta Lead Ads   │        │  Public marketing    │
│  webhook         │        │  website (sync push) │
└──────────────────┘        └──────────────────────┘

Deploy: Jenkins → docker build (backend, frontend) → docker run on one
VM, health-checked, auto-rollback to previous image tag on failure.
```

---

## STEP 2 — Module-by-Module Analysis

For each module: purpose, strengths/weaknesses, and scores are given holistically rather than repeating identical boilerplate per module — the numeric scores reflect real differences observed while reading the code.

| Module | Purpose | Maintainability | Complexity | Risk |
|---|---|---|---|---|
| **Leads** (`leads.routes.ts`, 1139 lines) | Core CRM entity: CRUD, pipeline stage machine, assignment, WhatsApp send, partner share, CSV import/export, Meta webhook, generic lead webhook | 4/10 | High | Medium |
| **Properties** | Inventory CRUD, image/video upload, matching, CSV import/export, website sync push | 6/10 | Medium | Low |
| **Partners** | Referral-partner company CRUD + lead-share tracking | 7/10 | Low | Low |
| **Vendors** | Upstream sourcing pipeline, mirrors Leads' automation pattern | 7/10 | Medium | Low (soft-disabled) |
| **WhatsApp** | Templates, send-log, CSV export, delivery-status + inbound-message webhook | 6/10 | Medium-High | Medium |
| **AI** | Sales pitch / proposal / price prediction / agreement draft / free-form ask, usage tracking | 7/10 | Medium | Low |
| **Reports** | Lead/staff/partner/monthly/property-engagement/buyer-behavior aggregates | 6/10 | Medium (raw SQL present) | Low |
| **Settings/Integrations** | Key-value settings store + masked integration credentials | 6/10 | Medium | Medium (was Critical — see Security report) |
| **Users** | Staff account CRUD, audit log | 7/10 | Low | Low |
| **Blog** | Public content marketing pages | 6/10 | Low | Low |
| **Auth** | Login, forgot/reset password, `/me` | 7/10 | Low | Medium |

### Strengths (repo-wide)
- Consistent `requireAuth` → `requireRole` → `validate(zodSchema)` pipeline on almost every route.
- Genuinely good inline commenting *of intent* ("why", not "what") — unusually disciplined for a codebase this size.
- Real production-incident-driven fixes are already baked in (optimistic-concurrency `expectedUpdatedAt` on lead edits, `STAGE_ORDER` regression guards, phone-normalization for WhatsApp destinations, a documented anti-spam-throttle diagnosis).
- CSV export governance is role-gated correctly (PII-heavy exports require Super Admin).

### Weaknesses / Technical Debt (repo-wide)
1. **`leads.routes.ts` is a god-file** — 1139 lines covering ~20 distinct responsibilities. Should be split into `leads.routes.ts` (CRUD/list), `leads.pipeline.routes.ts` (stage/assign), `leads.whatsapp.routes.ts` (send/history), `leads.import.routes.ts`, `leads.webhooks.routes.ts`.
2. **Zero automated tests.** No unit, integration, or E2E tests anywhere in either package. Every regression this session was caught by manual live-curl testing against production data, not a test suite.
3. **No structured logging/monitoring.** `errorHandler.ts` does `console.error(err)` and nothing else — no request IDs, no log levels, no external sink (Sentry/Datadog/CloudWatch). In production, diagnosing an incident means SSH-ing in and reading raw stdout.
4. **No CI.** No `.github/workflows`, no pre-merge test/lint gate. Jenkins only runs on deploy (build + push), not on PRs — a broken build isn't caught until someone actually deploys it.
5. **Two nearly-identical pipeline-automation services** (`pipelineAutomation.service.ts`, `vendorPipelineAutomation.service.ts`) — real duplication that should share a generic "stage → template → send → log" helper parameterized by entity type.
6. **No accessibility attributes anywhere in the component library** (`ui.tsx` — zero `aria-*`/`role=` usage). Screen-reader users cannot meaningfully use this app.
7. **No SEO infrastructure** on the one genuinely public-facing surface (the blog): no per-post `generateMetadata`, no Open Graph tags, no `sitemap.xml`, no `robots.txt`.
8. **Uploads live on local container disk**, not object storage (S3/R2/Blob). A container redeploy without the named volume attached, or a host disk failure, loses every property photo/video ever uploaded. (The Jenkinsfile does mount a named volume, `realcrm-uploads`, so this is mitigated for redeploys specifically — but there is still no offsite backup of that volume.)
9. **No documented backup strategy** for the Postgres database itself.

---

## STEP 6 — Performance Audit (summary; full detail in PERFORMANCE_REPORT.md)

- Prisma schema indexing is genuinely thorough (every hot filter path on Lead/Property/WhatsAppLog/Notification/AiUsageLog has an index) — this was checked explicitly and is a real strength, not an assumption.
- CSV export / dashboard endpoints run intentionally unbounded `findMany` queries (by design, for exports) — fine at current scale (dozens of leads), will need pagination or streaming if lead volume reaches the thousands.
- No caching layer anywhere (no Redis, no in-memory cache with invalidation) — every request hits Postgres directly. Acceptable at current traffic; a scaling concern if this becomes multi-tenant or high-traffic.
- Frontend: no code-splitting beyond Next.js's automatic per-route splitting, no `next/image` (raw `<img>` tags everywhere, flagged by ESLint's own `no-img-element` warning across ~6 files), no explicit memoization — but bundle sizes observed during builds this session were small (87–113 kB first load per route), so this isn't currently a real problem.

## STEP 7 — UI/UX Audit (summary; full detail in FEATURE_GAP_REPORT.md context)

- Recent work this session specifically closed several confusion/consistency gaps (status/stage contradiction, silent pipeline regressions, ambiguous badges, mobile card-view gaps). The app is materially more coherent than a fresh read of git history alone would suggest.
- Genuine remaining gaps: no dark mode, no keyboard-navigation testing, no dedicated empty/loading skeletons in a few pages (`Spinner` is a full-page blocking spinner, not a skeleton), no toast queue de-duplication check performed.
- Vendor Network is currently soft-disabled (hidden nav + 503 API) at explicit user request — not a bug, a deliberate temporary state.

## STEP 9 — Code Quality Audit (summary)

- **SOLID/DRY:** Route handlers mix HTTP concerns with business logic directly (no service-layer separation for Leads/Properties specifically, unlike WhatsApp/AI which do have service modules) — acceptable for this scale, but a barrier to unit testing without an HTTP layer in the way.
- **Naming:** Consistently good and descriptive throughout.
- **Type safety:** Strong — `strict` TypeScript, Zod validation at every boundary, no `any` found in spot checks.
- **Dead code:** None found during this audit; a prior session already removed several dead controls (a "Currencies" setting that saved but was never read back — now fixed and wired to `useCurrencies()`).
- **Large functions:** `send-whatsapp` and `share-partner` handlers in `leads.routes.ts` each exceed 100 lines with multiple responsibilities (message construction, stage regression guard, notification, activity logging) — candidates for extraction into named helpers.

---

## Scores (STEP 14)

| Dimension | Score /10 | Note |
|---|---|---|
| Architecture | 7 | Clean layering, but one god-file and no service layer for the two biggest modules |
| Backend | 7 | Consistent auth/validation pipeline, real production hardening already done |
| Frontend | 7 | Coherent, mobile-responsive, but zero accessibility and no test coverage |
| Security | 6 | See SECURITY_REPORT.md — one Critical issue already found *and fixed* this session; posture is now reasonable but unverified by any automated scan |
| Database | 8 | Well-indexed, correctly normalized, migrations are clean and additive |
| Performance | 7 | Fine at current scale; no caching layer, no CDN for uploads |
| UX | 7 | Actively improved this session; still no dark mode/a11y |
| Maintainability | 5 | God-files, zero tests, no CI drag this down significantly |
| Scalability | 6 | Single-tenant, single-VM, local-disk uploads, no cache — fine for one agency, not ready for multi-tenant SaaS |
| SEO | 3 | No metadata/sitemap/robots on the one public content surface |
| Accessibility | 2 | No aria attributes anywhere in the shared component library |
| Testing | 1 | Zero automated tests of any kind |
| Documentation | 5 | Excellent inline "why" comments; no README/API guide beyond a hand-written Swagger spec |

**Overall Product Score: 62/100** — a genuinely solid, actively-maintained single-tenant CRM with strong data-layer discipline and an unusually good track record of catching and fixing real production bugs, held back almost entirely by the complete absence of automated testing/CI and accessibility/SEO investment, not by architectural rot.
