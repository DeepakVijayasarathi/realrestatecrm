# Bug Report — RealRest / Thanjai Property CRM

Two sections: bugs **already found and fixed** during active development on this repo (kept here as an audit trail — they explain *why* several defensive patterns exist in the code today), and bugs **still open** as of this audit.

---

## Already Fixed (audit trail)

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | Lead `status` and `stage` could contradict each other | `stageToStatus` mapping table was missing 4 of 13 stages | Completed the mapping |
| 2 | Sending a WhatsApp or sharing to a partner could silently move a lead **backward** in the pipeline | No stage-order comparison before force-setting stage | Added `STAGE_ORDER`-indexed regression guard |
| 3 | Moving a lead directly to `SHARED_TO_PARTNER` via the stage dropdown left no `PartnerLeadShare` record | Dropdown allowed any stage value | Blocked that specific transition server-side; only the dedicated share endpoint can set it |
| 4 | A property sent via WhatsApp without first clicking "Save shortlist" never showed as shared | `updateMany` (no-op if no row exists) instead of `upsert` | Switched to `upsert` |
| 5 | Frontend lead-source filter silently missing `VISA_FORM` | Enum drift between backend Prisma enum and frontend constant | Added the missing value |
| 6 | Unmatched `{{placeholder}}` in a template vanished instead of showing | `vars[key] ?? ""` | Changed to `vars[key] ?? match` |
| 7 | AI-generated `**bold**` showed as literal asterisks on WhatsApp | WhatsApp only supports single-asterisk bold; system prompt didn't say so | Added explicit instruction to the shared AI system prompt |
| 8 | AI requests failed with "model not found" | Default Gemini model (`gemini-1.5-flash`) unavailable on the user's key tier | Changed default to `gemini-2.0-flash` |
| 9 | SmartPing send failed with "Campaign does not exist" | Trailing whitespace in the stored campaign-name setting | Fixed the stored value + added `.trim()` on save |
| 10 | SmartPing rejected valid numbers | Destination needed bare local-format digits, not `+91...` | Reformatted before send |
| 11 | SmartPing rejected multi-line messages | Template params can't contain newlines/tabs | Flattened to `•`-separated text before sending |
| 12 | Delivered WhatsApp messages showed literal `<br>` text | The **already Meta-approved** template's static text literally contains `<br>` — not fixable from code | Documented; needs a new template submitted in Meta Business Manager |
| 13 | **Critical** — any authenticated user (including external `PARTNER_USER` accounts) could read every configured integration secret (WhatsApp/OpenAI/Gemini/Meta API keys) in plaintext | Generic `GET /api/settings` dumped every `Setting` row unfiltered, bypassing the masked `/settings/integrations` endpoint entirely | Filtered out `integration_*`-prefixed keys from the generic endpoint |
| 14 | 7 of 13 pipeline stages configured to auto-send WhatsApp did nothing, silently | The underlying `WhatsAppTemplate` rows for those stage keys had never been created in production | Created the missing templates directly; extended `TEMPLATE_BY_STAGE` |
| 15 | Vendor "Site Visit Scheduled" (and lead-side equivalent) messages could show a time up to ~5.5 hours off, occasionally the wrong calendar date | Node process had no fixed timezone; parsing a plain `datetime-local` string as local time silently assumed the server's ambient (usually UTC) timezone instead of India's | Pinned `process.env.TZ = "Asia/Kolkata"` at the earliest load point + pinned `timeZone` explicitly in the two message-formatting call sites |
| 16 | A WhatsApp message sent in a non-English language could silently go out in English with no indication anything failed | `translateForWhatsApp`'s catch-all swallowed AI translation errors and returned the original text with no signal | Return a `failed` flag; surface it as a warning toast on send |
| 17 | Newly created vendor WhatsApp templates saved with the wrong `audience` (`LEAD` instead of `VENDOR`) | The create/update zod schema for templates never had an `audience` field, so it was silently stripped before reaching the database | Added `audience` to the schema |
| 18 | Dashboard stat tiles all showed a hover/lift animation even when they had no destination | `Stat` component applied the hover class unconditionally | Only apply it when `href` is set |
| 19 | WhatsApp Log and Users pages were unusable on mobile (wide tables, no fallback) | Newly added pages never got the mobile card-list treatment older pages already had | Added the same `md:hidden` card list pattern |
| 20 | Could not send a WhatsApp message to a lead without first selecting a property | `sendWhatsApp()` hard-required `selected.size > 0` | Redesigned into a modal supporting template-only/custom-message-only sends |
| 21 | Automated "site visit confirmation" message could quote a stale, unrelated date | Automation reused whatever `followUpAt` happened to already be set, from any earlier purpose | Added an explicit date/time prompt on this specific transition, for both leads and vendors |
| 22 | No visibility at all into a lead's replies on WhatsApp | Nothing captured inbound messages — only outbound sends were ever logged | Added `WhatsAppInboundMessage`, a merged conversation view, an auto-reply, and a reply notification to the assigned exec (dormant pending BSP webhook activation — see below) |
| 23 | **High** — `nodemailer` carried multiple published CVEs (SSRF/arbitrary-file-read via the `raw` message option, DoS via recursive address parsing) | Dependency had never been audited (`npm audit` was flagged as "not yet run" in `SECURITY_REPORT.md`) | Upgraded to `nodemailer@9.0.3`; re-audit clean, build/typecheck clean, live smoke-tested |

---

## Still Open

| Severity | Bug / Gap | Where | Impact |
|---|---|---|---|
| **High** | Zero automated test coverage | entire repo | Every one of the 22 fixes above was caught by manual testing (or a live user report) after the fact, not before. No regression safety net for future changes. |
| **High** | No documented Postgres backup/restore strategy | infrastructure | A single database incident (bad migration, disk failure, accidental delete) has no known recovery path. |
| **Medium** | No global `unhandledRejection`/`uncaughtException` handler | `backend/src/server.ts` | Every route handler and both background jobs are individually try/caught (verified — no gaps found), so the practical risk is low today, but there is no safety net for something genuinely unforeseen crashing the whole process. |
| **Medium** | Uploaded property photos/videos live on local container disk only | `backend/src/middleware/upload.ts`, `UPLOAD_DIR` | The Jenkins deploy does mount a named Docker volume (`realcrm-uploads`), so redeploys are safe, but there is no offsite/object-storage backup — a host-level disk failure loses every uploaded file permanently. |
| **Medium** | Inbound-WhatsApp payload field-name assumptions are unverified | `whatsapp.routes.ts` `extractInboundEvents` | Built against common BSP conventions, not a confirmed real payload from AiSensy/SmartPing (support hasn't enabled webhooks yet). Will likely need adjustment once real traffic arrives. |
| **Low** | `leads.routes.ts` is a 1139-line god-file mixing ~20 responsibilities | backend | Increases the odds of an accidental regression when touching an unrelated part of the file; no test suite to catch it if it happens. |
| **Low** | Two near-duplicate "stage → template → send → log" automation services | `pipelineAutomation.service.ts`, `vendorPipelineAutomation.service.ts` | A fix applied to one (e.g., the timezone fix) has to be remembered and applied to the other by hand — already happened once this session. |
| **Low** | `GET /auth/me` handler is `async` with no `try/catch` | `auth.routes.ts` | Currently harmless (the handler body can't throw), but inconsistent with every other route in the file. |
| **Info** | The Meta-approved WhatsApp template's static wrapper text literally contains `<br>` | External (Meta Business Manager) | Not fixable from this codebase — needs a new template submitted and approved externally. |
