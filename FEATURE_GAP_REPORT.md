# Feature Gap Report — RealRest / Thanjai Property CRM

Compared against typical mid-market real-estate CRM competitors (e.g., Zoho CRM for real estate, Kylas, Sell.Do, LeadSquared-style products common in the Indian market this product targets).

## What's already genuinely strong here
Multi-channel WhatsApp automation tied to pipeline stage (rare even in paid competitors at this price point), an AI console grounded in real inventory/lead data (sales pitch, investment proposal, price prediction, agreement draft), a working partner-referral network with commission/status tracking, a vendor-sourcing pipeline mirroring the sales pipeline, CSV import/export with governance, and an audit log. This is not a thin CRM — it has real depth in the WhatsApp/AI area specifically.

---

## Must Have (competitive table stakes this product is missing)

| Feature | Why it matters | Current state |
|---|---|---|
| **Automated database backups** | Any competitor's hosted offering guarantees this; a self-hosted single-VM deployment with none is a real business risk | Not implemented (see Bug/Security reports) |
| **Two-factor authentication** | Standard on any CRM handling client PII and financial (budget) data | Not implemented — password-only login |
| **Automated tests + CI gate** | Table stakes for any product that intends to keep shipping safely | None exist |
| **Real delivery-status tracking for WhatsApp** | "Sent" without knowing if it was delivered/read is a known gap the team is actively trying to close | Built, dormant — blocked on BSP (AiSensy/SmartPing) support enabling webhooks |
| **Duplicate lead detection** | Multiple intake channels (manual, CSV, webhook, public form, Meta Ads) with no dedupe means the same person can become 3 separate lead records | Not implemented |

## Should Have (common in competitors, clear value, moderate effort)

| Feature | Why it matters | Current state |
|---|---|---|
| **SMS/email as WhatsApp fallback channels** | WhatsApp-only communication fails for the segment of clients who don't use it or have opted out | Email exists only for internal notifications (password reset, follow-up reminders to staff) — not used as a client-facing channel |
| **Calendar integration (Google Calendar/Outlook) for site visits** | Site visits are currently tracked as a lead field + WhatsApp message, with no calendar sync/reminder for staff | Not implemented |
| **Saved searches / property alerts for repeat inquirers** | The buyer-behavior report already tracks "repeat inquirers" — but there's no way to proactively alert them when new matching inventory arrives | Not implemented (matching exists on-demand only, via "Find matches") |
| **Lead scoring** | Prioritizing which of dozens of leads to work first is currently manual (a `priority` field set by a human) | No automated scoring based on engagement/budget/recency |
| **Document e-signature for sale agreements** | The AI console already drafts sale agreements — there's no way to actually get them signed in-product | Draft-only; signing happens outside the system |
| **Commission/payout tracking beyond a free-text note** | `PartnerLeadShare.commissionNote` is a plain string, not a structured, reportable amount | Not structured |
| **Mobile app / PWA** | Sales staff are frequently in the field (site visits) | Web-only, though responsive |

## Nice to Have

| Feature | Why it matters | Current state |
|---|---|---|
| **Map-based property search** | Visual property discovery is common in real-estate-specific tools | Not implemented — text/filter search only |
| **In-app staff chat / internal notes @mentions** | Currently notes are per-lead free text with no @mention/notify-a-colleague mechanism | Not implemented |
| **Dark mode** | Increasingly standard, low effort | Not implemented |
| **Client-facing portal** | Partners get a scoped portal; end clients (the actual home buyers) have no self-service view of their own shortlisted properties/status | Not implemented |
| **Bulk actions on lead/property lists** | E.g., bulk-reassign, bulk-tag | Not implemented — actions are per-row |

## Future

| Feature | Why it matters |
|---|---|
| **Multi-tenant / multi-org support** | Current architecture (single DB, no org-scoping anywhere in the schema) is fundamentally single-tenant; would require a genuine re-architecture, not a feature add, if this were ever sold to other agencies |
| **MLS/property-portal integrations** (99acres, MagicBricks, Housing.com syndication) | Common in mature real-estate CRMs; the existing "website sync" push is custom/bespoke to one marketing site, not a portal integration |
| **Voice/call logging (VoIP integration)** | Would round out the multi-channel story alongside WhatsApp/email/SMS |
| **Predictive analytics** (deal-close probability, churn risk) | Natural extension of the existing AI integration once there's enough historical data |
