# Security Report — RealRest / Thanjai Property CRM

Assessed against OWASP Top 10 (2021) categories. Findings are graded by actual, verified behavior in this codebase — not generic checklist assumptions.

---

## Critical

### [FIXED] Broken Access Control — secrets exposed via generic settings endpoint
`GET /api/settings` returned every raw `Setting` row unfiltered, including `integration_*`-prefixed rows holding live WhatsApp/OpenAI/Gemini/Meta API keys and webhook secrets — in plaintext, to **any authenticated user regardless of role**, including external `PARTNER_USER` accounts. This completely bypassed the masking and Super-Admin-only gate built for `/settings/integrations`.
**Status:** Fixed this session — the generic endpoint now filters out `integration_*` keys.
**Verify:** confirmed the fix live against production before and after.

---

## High

None currently open. (The only High/Critical-grade issue found — the settings leak above — is fixed.)

---

## Medium

1. **Password policy is length-only.** `min(8)` on new accounts and resets, no complexity requirement, no breach-list check (e.g., HaveIBeenPwned range API), no password history. A determined attacker with a leaked credential list has a meaningfully easier time.
2. **bcrypt cost factor is 10.** Functional and was industry-standard several years ago; 12+ is the more common recommendation today. Low urgency (a cost-10 hash is still expensive to brute-force at scale) but cheap to raise.
3. **JWT secret fails open to a hardcoded default** (`"dev-secret-change-me"`) if `JWT_SECRET` is ever unset, rather than refusing to start. Production correctly supplies a real secret via Jenkins credentials today — this is a latent footgun for any future deployment path that doesn't.
4. **No global `unhandledRejection`/`uncaughtException` handler.** Every route and background job is individually try/caught (verified, no gaps), so this is defense-in-depth rather than an active hole — but a single genuinely unforeseen error anywhere outside those paths would crash the whole process with no graceful shutdown or alerting.
5. **CORS is wildcard-open** (`app.use(cors())` with no origin restriction). Low practical risk *in this specific app* because auth uses a `Authorization: Bearer` header sourced from `localStorage`, not a cookie — a foreign origin can't read that token due to same-origin policy on `localStorage` itself, and can't forge the header without already having the token. Still worth restricting to known origins as defense-in-depth, since it currently allows any website to make authenticated-looking requests against the public endpoints (blog, health) at will.
6. **No documented database backup/restore strategy.** Not a code vulnerability, but a real business-continuity risk that sits adjacent to security posture — ransomware, accidental `DROP`, or disk failure all have no known recovery path today.

---

## Low

1. **No rate limiting on most authenticated write endpoints** beyond the two explicitly added this session (login, forgot/reset-password) and a couple of public webhook/capture endpoints. An authenticated-but-malicious or compromised account could hammer, e.g., the CSV export or AI endpoints. Lower severity since it requires a valid session first.
2. **File-upload content verification exists but is signature-based only for images/video** (`verifyImageContent`/`verifyVideoContent` check magic bytes) — document uploads (PDF/CSV/XLSX) are extension-checked only, mitigated by an `X-Content-Type-Options: nosniff` header on `/uploads` (added this session) but not by content verification.
3. **Secrets-in-source scan:** none found. No hardcoded API keys, passwords, or tokens in the repository; `.env` is correctly gitignored and never committed.
4. **SQL injection:** not exploitable. The one raw query in the codebase (`reports.routes.ts`, monthly trend) is a tagged-template with zero interpolated user input; everything else goes through Prisma's parameterized query builder.
5. **XSS:** no `dangerouslySetInnerHTML` anywhere in the frontend; React's default escaping applies everywhere user content is rendered. No injection vector found.
6. **CSRF:** not applicable in the traditional sense — there is no ambient cookie-based credential for a forged cross-site request to ride on; auth requires an explicit `Authorization` header the browser will not attach automatically.
7. **SSRF:** no user-controlled URL is passed directly into a server-side `fetch()` call anywhere checked. Webhook-triggered outbound calls (property sync, WhatsApp send) all target configuration-supplied hosts, not request-supplied ones.
8. **[UPDATED] `npm audit` has now been run** (was previously flagged as an open gap). Backend: 1 High-severity finding (`nodemailer` <9.0.7 — SSRF/arbitrary-file-read + DoS CVEs) — **fixed**, upgraded to `9.0.3`, re-audit clean. Frontend: 7 High + 1 Moderate, all confined to dev-only tooling (`eslint-config-next`'s bundled `glob`/`typescript-eslint`, and a `postcss` copy inside `next` itself) with no runtime exposure — deliberately not upgraded, since the suggested fixes are major-version bumps that would either re-break a known ESLint 8/9 incompatibility (already hit once this session) or require a risky Next.js 14→16 upgrade with no test suite to catch regressions. Still no automated scanning wired into CI, because there is no CI — a manual `npm audit` should be run periodically until that changes.
9. **Webhook authentication is sound where implemented:** Meta's HMAC-SHA256 signature verification uses `crypto.timingSafeEqual` (not a naive `===`), correctly preventing timing side-channels; the shared-secret webhooks (delivery-status/inbound-message, website-sync) follow the same pattern.

---

## Not Assessed (out of scope for a static code audit)
- Actual `npm audit`/`pip audit`-style dependency CVE scan (recommend running one).
- Penetration testing against the live production environment.
- Infrastructure-level hardening (VM patching, firewall rules, Postgres network exposure) — this repo doesn't define that layer.
