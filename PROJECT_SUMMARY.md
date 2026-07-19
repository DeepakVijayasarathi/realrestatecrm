# Project Summary — Thanjai Property CRM

## Folder Structure
```
backend/            Express + Prisma + PostgreSQL API
  src/modules/       One folder per domain: auth, leads, properties, partners,
                     vendors, whatsapp, notifications, reports, settings, users,
                     ai, blog, integrations — each with a *.routes.ts (and
                     *.schemas.ts where validation warrants its own file)
  src/services/      Cross-cutting logic: whatsapp, pipelineAutomation,
                     vendorPipelineAutomation, notification, audit, email,
                     openai, matching, propertySync, branding, integrationSettings
  src/jobs/          Two interval-based background jobs (follow-up reminders,
                     lead recycling)
  src/middleware/    auth (JWT), validate (zod), upload (multer)
  prisma/            schema.prisma + migrations + seed.ts

frontend/            Next.js 14 App Router
  src/app/(dashboard)/  Authenticated pages (one folder per feature)
  src/app/blog/, enquiry/, login/, reset-password/   Public pages
  src/components/    Shared UI kit (ui.tsx) + a few feature components
  src/lib/           api client, auth context, shared types/constants
```

## Tech Stack
- **Backend:** Node.js, Express 4, TypeScript (strict), Prisma ORM, PostgreSQL, Zod, JWT (`jsonwebtoken`), `bcryptjs`, `multer`, `nodemailer`, `swagger-ui-express`.
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript. No state library — `useState`/`useEffect` + a thin `fetch` wrapper.
- **No test framework** in either package.

## Dependencies
- Backend prod deps: 11 direct packages (deliberately minimal footprint).
- Frontend prod deps: 3 direct packages (`next`, `react`, `react-dom`).
- **`npm audit` run this pass** (previously flagged as not-yet-done):
  - Backend: 1 High (`nodemailer` <9.0.7, several CVEs including SSRF/arbitrary-file-read and a DoS). **Fixed** — upgraded to `9.0.3`, re-audited clean (0 vulnerabilities).
  - Frontend: 7 High + 1 Moderate, **all in dev-only tooling** (`eslint-config-next`'s bundled `glob`/`@typescript-eslint`, and a `postcss` copy bundled inside `next` itself). None are reachable at runtime — `eslint`/`typescript-eslint` never ship in the production build, and the `postcss` XSS advisory requires rendering attacker-supplied CSS, which this app never does. **Not upgraded**: the suggested fix (`eslint-config-next@16.2.10`, `next@16.2.10`) are both major-version bumps; `eslint-config-next@16` was already tried once this session and found incompatible with this project's ESLint 8 setup (a circular-JSON crash), and a Next.js 14→16 major upgrade is a real regression risk with zero test coverage to catch breakage. Documented as a deliberate deferral, not an oversight.

## Build System
- Backend: `tsc -p tsconfig.json` → `dist/`, run via `node dist/server.js`.
- Frontend: `next build` (standalone output mode for Docker).
- Both Dockerized (multi-stage builds); Jenkins builds both images and runs them as standalone containers on one VM, health-checked with automatic rollback to the previous image tag on failure.

## Environment Variables
All backend config flows through `src/config/env.ts` (single source of truth, `.env`-driven via `dotenv`). Categories: server (`PORT`, `APP_URL`, `PUBLIC_API_URL`), auth (`JWT_SECRET`, `JWT_EXPIRES_IN`), WhatsApp (provider selection + per-provider credentials), AI (OpenAI/Gemini), SMTP, website-sync, Meta webhook. Most of these are **also** overridable at runtime via the database-backed `Setting` table (Settings → Integrations UI) — env vars are just the fresh-install defaults.

## Architecture
Single-tenant, single-Postgres-instance, single-VM deployment. See `PRODUCT_AUDIT.md` for the full diagram and module-by-module analysis — not repeated here to avoid drift between the two documents.

## Database
PostgreSQL via Prisma. 20+ models covering Users, Leads (+ notes/activity/pipeline-history/matches), Properties (+ images), Partners (+ shares), Vendors (+ WhatsApp log), WhatsApp (templates/logs/inbound messages), Notifications, Settings, Blog, AI usage. Indexing verified thorough on every hot query path (see `PERFORMANCE_REPORT.md`).

## API Routes
13 route modules, ~150 endpoints total. Consistent `requireAuth` → `requireRole` → `validate(zodSchema)` pipeline on nearly every mutating endpoint.

## Frontend Pages
24 routes: 18 authenticated dashboard pages, 6 public pages (home, login, reset-password, enquiry, blog list, blog post).

## Authentication
JWT (`Authorization: Bearer` header, stored in `localStorage`), 7-day expiry, `bcryptjs` password hashing (cost 10). Login/forgot/reset-password are rate-limited (added this session after finding they weren't).

## Authorization
5 roles (`SUPER_ADMIN`, `SALES_MANAGER`, `SALES_EXECUTIVE`, `PROPERTY_STAFF`, `PARTNER_USER`), enforced via `requireRole(...)` middleware per-route (Super Admin implicitly passes every check). Partner-portal users are additionally scoped to their own company's data at the query level, not just the route level.
