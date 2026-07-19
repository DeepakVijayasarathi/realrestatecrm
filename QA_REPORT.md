# QA Report — Runtime & Static Pass

This pass builds on the full audit already in `PRODUCT_AUDIT.md` / `BUG_REPORT.md` / `SECURITY_REPORT.md` / `PERFORMANCE_REPORT.md` / `FEATURE_GAP_REPORT.md` / `ROADMAP.md` — findings already documented there aren't repeated here.

## Step 3 — Runtime QA (actually executed, not assumed)

| Check | Result |
|---|---|
| `npm install` (backend) | Already installed; `npm audit` run instead (see below) |
| `npm install` (frontend) | Already installed; `npm audit` run instead |
| Linter (frontend, `next lint` via direct `eslint`) | **Pass** — 0 errors, 2 pre-existing `<img>`-vs-`next/image` warnings only |
| Linter (backend) | No ESLint config exists for the backend package — nothing to run. `tsc --noEmit` is this project's actual correctness gate for the backend and is run instead. |
| Formatter | No Prettier/formatter config exists in either package — not applicable |
| Tests | **None exist.** No test framework dependency in either `package.json`, no `*.test.ts`/`*.spec.ts` files anywhere in project source (only inside `node_modules/zod`'s own bundled tests, which aren't this project's). This is the single largest gap in the whole audit — see `ROADMAP.md` item #2. |
| Build (backend, `tsc -p tsconfig.json`) | **Pass**, clean |
| Build (frontend, `next build`) | **Pass**, clean — compiled successfully, 0 type errors, only the two known `<img>` warnings |
| Start application | Backend started successfully (`Thanjai Property CRM API running on http://localhost:4000`), health check `200 OK` |
| Inspect logs | Clean — no unexpected errors during the smoke-test session below |

## Live smoke test performed this pass
- `POST /auth/forgot-password` with a non-existent email → `200`, no user enumeration leak (generic message either way) — correct.
- `POST /auth/forgot-password` with a real account → `200`, `sendEmail()` executed through the newly-upgraded `nodemailer` without error (logged to console since SMTP isn't configured — expected, see `BUG_REPORT.md` item on email never having been configured).
- No crashes, no unhandled rejections, no unexpected console output during the session.

## Dependency audit (new this pass)
Full detail in the updated `SECURITY_REPORT.md`. Summary: 1 real, fixed (backend `nodemailer` High severity, several CVEs) vs. 8 dev-tooling-only findings on the frontend, deliberately left as-is with reasoning documented (upgrading would either re-break a known ESLint incompatibility or require a risky major Next.js version bump with no test suite to catch regressions).

## Steps 4/5/6/7/8 (UI, API, Database, Performance, Security)
Already covered exhaustively in the existing reports from the prior audit pass, all of which remain accurate — re-verified spot-checks (indexing, auth pipeline consistency, CORS, XSS/SQLi surface) found no drift since that pass. Not repeated here.

## Score Impact of This Pass
No score changes to the categories in `PRODUCT_AUDIT.md` — the nodemailer fix removes one real vulnerability but was already reflected as "Medium, fixable" rather than counted against the Security score, which was already 6/10 pending exactly this kind of dependency hygiene work.
