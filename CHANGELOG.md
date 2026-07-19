# Changelog

Generated from actual commit history (`git log`), most recent first. Entries before `52b779f` are older and not repeated here — see `git log` for full history.

## Unreleased (local commits, not yet pushed/deployed as of this writing — check `git status` for current state)

- **Fixed:** `nodemailer` dependency upgraded to `9.0.3`, resolving a High-severity CVE chain (SSRF/arbitrary-file-read, DoS) — found via this pass's `npm audit` run.
- Restyle the lead conversation view to actually look like WhatsApp (bubble colors, timestamp placement, status ticks)
- Keep WhatsApp reply notifications in-app only, no email
- Notify both assigned exec and super admin on lead reply, add inline reply, fix `MAIL_FROM` branding
- Fix remaining "RealRest" branding leftovers on public-facing pages (enquiry form, blog)
- Notify the assigned sales exec when a lead replies on WhatsApp
- Add a direct "Schedule visit" button to the lead detail page
- Add inbound WhatsApp visibility and auto-reply (dormant until BSP webhooks are enabled)
- Soft-disable vendor management (reversible — nav hidden, API returns 503)
- Add real date/time prompt for lead "Site Visit Scheduled" stage (fixes a bug where the automated message could quote a stale, unrelated date)
- Add Edit/Delete UI to the Vendor detail page
- **Fixed:** ~5.5-hour timezone bug in vendor/lead site-visit scheduling (server had no fixed timezone)
- Add `qa-fix` skill and a WhatsApp templates reference CSV
- Enrich WhatsApp property-share messages with full details (bedrooms/bathrooms/area/furnishing) and every photo, not just one
- Add full vendor management: sourcing pipeline + automated WhatsApp templates
- Add inline availability-status control to property cards
- Add an acceptance QA report; fix the issues it found
- Surface WhatsApp translation failures instead of silently sending English
- Add "Share via WhatsApp" from the property detail page; fix Users page mobile view
- **Fixed (Critical):** generic `/settings` endpoint exposed all integration credentials (WhatsApp/OpenAI/Gemini/Meta API keys) in plaintext to any authenticated user, including external partner accounts
- Make all code-generated client-facing text use the configurable branding app name
- Fix mobile-responsiveness gaps on several pages
- Sidebar logo/branding polish (white card background, full-size logo, no duplicate text)

## Documentation added this pass
`PROJECT_SUMMARY.md`, `QA_REPORT.md`, `FIX_REPORT.md`, `CHANGELOG.md` (this file) — alongside the pre-existing `PRODUCT_AUDIT.md`, `BUG_REPORT.md`, `SECURITY_REPORT.md`, `PERFORMANCE_REPORT.md`, `FEATURE_GAP_REPORT.md`, `ROADMAP.md` from the prior full-audit pass.
