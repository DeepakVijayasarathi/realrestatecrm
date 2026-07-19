# Roadmap — RealRest / Thanjai Property CRM

Prioritized from the findings in PRODUCT_AUDIT.md, BUG_REPORT.md, SECURITY_REPORT.md, PERFORMANCE_REPORT.md, and FEATURE_GAP_REPORT.md. Each item: **Difficulty**, **Impact**, **Time estimate**, **Risk if left undone**, **Dependencies**.

---

## Critical (fix immediately)

*Nothing currently open at Critical severity* — the one Critical finding (the settings-secrets leak) was found and fixed during this engagement, verified live. Confirming there's no regression of that fix is the only "critical-adjacent" action item, covered under Testing below.

---

## High

### 1. Set up a database backup strategy
- **Difficulty:** Low-Medium (pg_dump on a cron + offsite copy, or managed-Postgres snapshot if migrating hosting)
- **Impact:** High — currently zero recovery path from any data-loss incident
- **Time:** 1–2 days
- **Risk if undone:** Total, unrecoverable data loss from any single incident (bad migration, disk failure, accidental delete, ransomware)
- **Dependencies:** none — can start immediately, independent of any code change

### 2. Stand up a minimal automated test suite + CI gate
- **Difficulty:** Medium-High (no test infra exists at all; needs framework choice, then real test-writing effort)
- **Impact:** High — every future change currently has zero regression safety net; this session alone shipped 20+ fixes that were only caught by manual testing or live user reports
- **Time:** 1–2 weeks for a meaningful first slice (auth, lead pipeline stage transitions, WhatsApp send/template rendering, the settings-secrets-leak class of bug specifically)
- **Risk if undone:** Continued reliance on manual/production testing to catch regressions; compounds over time as the codebase grows
- **Dependencies:** pick a framework (Vitest/Jest for backend logic, Playwright for critical-path E2E); wire into a CI step (currently none exists — GitHub Actions or a Jenkins pre-merge stage)

### 3. Offsite backup for uploaded media
- **Difficulty:** Medium (move `multer` storage to S3-compatible object storage, or add a scheduled sync of the existing volume to offsite storage)
- **Impact:** Medium-High — every property photo/video is currently a single-host-failure away from permanent loss
- **Time:** 2–4 days
- **Risk if undone:** Permanent loss of all property media on host failure
- **Dependencies:** choice of object storage provider; some rework of `resolveMediaUrl`/upload middleware if moving off local disk entirely

### 4. Structured logging + basic monitoring
- **Difficulty:** Medium
- **Impact:** High for operability — currently `console.error` is the entire observability story
- **Time:** 3–5 days for a first pass (structured logger + error-tracking service like Sentry + uptime/health monitoring)
- **Risk if undone:** Production incidents are diagnosed by SSH-ing in and reading raw stdout; no alerting when something breaks
- **Dependencies:** pick a logging library (pino/winston) and an error-tracking service

---

## Medium

### 5. Confirm/activate WhatsApp delivery-status and inbound-message webhooks
- **Difficulty:** Low on the code side (already built and verified against a simulated payload); depends on an external party
- **Impact:** Medium-High — closes the "Sent but did it actually arrive/get read?" gap and makes the new inbound-reply/auto-reply feature live instead of dormant
- **Time:** Unknown — waiting on AiSensy/SmartPing support response; likely under a day of follow-up work once they confirm the payload shape
- **Risk if undone:** Feature stays dormant; "Sent" remains misleading as a final status
- **Dependencies:** external — AiSensy/SmartPing support ticket (already sent)

### 6. Split `leads.routes.ts` into focused modules
- **Difficulty:** Medium (mechanical but must preserve exact behavior across ~20 endpoints with no test suite to lean on — do this *after* item #2)
- **Impact:** Medium — maintainability, reduces blast radius of future changes
- **Time:** 2–3 days
- **Risk if undone:** Continued elevated risk of an unrelated change accidentally breaking something else in the same file
- **Dependencies:** ideally after a test suite exists to verify the refactor didn't change behavior

### 7. Merge the two pipeline-automation services into one parameterized implementation
- **Difficulty:** Low-Medium
- **Impact:** Medium — removes a proven source of "fixed one, forgot the other" bugs (already happened once with the timezone fix)
- **Time:** 1 day
- **Dependencies:** none

### 8. Raise password policy strength; raise bcrypt cost factor
- **Difficulty:** Low
- **Impact:** Medium
- **Time:** half a day
- **Dependencies:** none

### 9. Restrict CORS to known origins
- **Difficulty:** Low
- **Impact:** Low-Medium (defense-in-depth; current architecture already limits practical exploitability)
- **Time:** half a day
- **Dependencies:** none

### 10. Accessibility pass on the shared component library (`ui.tsx`)
- **Difficulty:** Medium (needs real screen-reader testing, not just adding attributes blindly)
- **Impact:** Medium — currently unusable for assistive-technology users
- **Time:** 3–5 days for the core components (Button, Modal, Select, form Fields)
- **Dependencies:** none

### 11. Basic SEO pass on public pages (blog, enquiry form)
- **Difficulty:** Low-Medium
- **Impact:** Medium for organic lead-generation, which is presumably the point of having a public blog at all
- **Time:** 2 days (per-page `generateMetadata`, OG tags, `sitemap.xml`, `robots.txt`)
- **Dependencies:** none

---

## Low

### 12. Duplicate-lead detection across intake channels
- **Difficulty:** Medium (phone-number normalization + fuzzy name match already exists as a pattern elsewhere in the codebase to build on)
- **Impact:** Medium (data quality) but not urgent
- **Time:** 3-4 days

### 13. Rate limiting on remaining authenticated write endpoints
- **Difficulty:** Low (the utility already exists and is used in 3 places — just needs applying more broadly)
- **Impact:** Low-Medium
- **Time:** 1 day

### 14. Global `unhandledRejection`/`uncaughtException` safety net
- **Difficulty:** Low
- **Impact:** Low (no gaps currently found in per-route error handling) but good defense-in-depth
- **Time:** half a day

---

## Nice to Have / Future (see FEATURE_GAP_REPORT.md for full detail)
- SMS/email as WhatsApp fallback channels
- Calendar integration for site visits
- Lead scoring
- E-signature for sale agreements
- Structured commission tracking
- Map-based property search
- Dark mode
- Client-facing self-service portal
- Multi-tenant architecture (a genuine re-architecture, not a feature add — only pursue if there's real intent to sell this to other agencies)

---

## Suggested sequencing
1. **Weeks 1-2:** Backups (DB + media) and structured logging/monitoring — these are pure risk-reduction with no feature trade-off and can start immediately.
2. **Weeks 2-4:** First slice of automated tests, focused on the highest-changed-risk areas (lead pipeline, WhatsApp send/automation, auth).
3. **Weeks 4-5:** Security hardening batch (password policy, bcrypt cost, CORS) — quick wins, bundle together.
4. **Ongoing, opportunistic:** Refactors (`leads.routes.ts` split, automation-service merge) once tests exist to verify them safely.
5. **Whenever AiSensy support responds:** Activate and verify the delivery-status/inbound-message webhook against real payloads.
