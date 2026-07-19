# Fix Report

## This Pass

### ISSUE-001
- **Severity:** High
- **Location:** `backend/package.json` → `nodemailer` dependency
- **Root Cause:** `nodemailer@6.9.14` (the version in use) carries multiple published CVEs, most seriously GHSA-p6gq-j5cr-w38f (arbitrary file read + full-response SSRF via the message-level `raw` option bypassing `disableFileAccess`/`disableUrlAccess`) and GHSA-rcmh-qjqh-p98v (DoS via recursive address-parsing). Found via `npm audit` (previously flagged in `SECURITY_REPORT.md` as "not yet run" — now run).
- **Fix Applied:** Upgraded to `nodemailer@^9.0.3`, the earliest version with all known advisories patched.
- **Files Changed:** `backend/package.json`, `backend/package-lock.json` (not shown in git status individually — `npm install` output confirmed 1 package changed)
- **Verification:** `npm audit` re-run → 0 vulnerabilities. `tsc --noEmit` and full `tsc -p tsconfig.json` build both clean (no type-signature breakage across the major version bump). Live smoke test: started the server, hit `POST /auth/forgot-password` against a real account, confirmed `sendEmail()` executed through the new version without error (logged to console as expected, since SMTP isn't configured — a separate, already-documented, non-code issue).
- **Risk:** Low — `email.service.ts`'s usage is limited to `createTransport()` + `sendMail()` with a stable, long-unchanged option shape; no breaking API surface touched.
- **Status:** ✅ Fixed and verified.

### Deferred (not fixed, with reasoning)

| Item | Why deferred |
|---|---|
| Frontend `npm audit` findings (7 High + 1 Moderate, all in `eslint-config-next`'s bundled `glob`/`typescript-eslint`, or a `postcss` copy inside `next` itself) | All dev-tooling-only — none of these packages ship in the production build. The suggested fixes are major-version bumps: `eslint-config-next@16` was already tried once this session and found incompatible with this project's ESLint 8 setup (a reproducible circular-JSON crash, downgraded back to 14.2.5 to fix it); a Next.js 14→16 major upgrade carries real App-Router breaking-change risk with zero test coverage to catch regressions. Upgrading now would trade a theoretical, unreachable vulnerability for a real, immediate regression risk. |

## Prior Fixes (this engagement, for continuity — full detail in `BUG_REPORT.md`)
22 issues found and fixed across earlier sessions on this repo, spanning: a Critical secrets-leak in the generic settings endpoint, a ~5.5-hour timezone bug in site-visit scheduling, silent WhatsApp translation failures, missing pipeline-automation templates, mobile-responsiveness gaps, and more. See `BUG_REPORT.md`'s "Already Fixed" table for the complete list — not duplicated here.
