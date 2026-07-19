# Performance Report — RealRest / Thanjai Property CRM

## Database
- **Indexing is genuinely thorough** — every hot query path (Lead by status/stage/source/assignedTo/followUpAt/createdAt, Property by type/category/status/location/price, WhatsAppLog/VendorWhatsAppLog by leadId/vendorId/sentById/createdAt, Notification by userId+isRead, AiUsageLog by userId+createdAt/feature/createdAt) already has a matching index. Verified by direct schema inspection, not assumption.
- **N+1 risk:** low. List endpoints use Prisma's `include`, not per-row queries in a loop, for the paths checked (leads list, properties list, board view). The one place that iterates and queries per-item (`reports.routes.ts` partner-performance aggregate) does so with `Promise.all` over a small, bounded (`partners.findMany`) set — acceptable at current partner counts.
- **Unbounded queries exist by design** on CSV export endpoints (leads, properties, WhatsApp log, templates) and the vendors list without an explicit cap in some paths — fine at current data volume (dozens to low hundreds of rows), will need pagination/streaming if a table reaches the thousands.
- **No caching layer** (Redis or otherwise). Every request round-trips to Postgres. Not currently a problem at this traffic level; will matter if the CRM adds more concurrent users or moves toward multi-tenant.

## Backend
- No connection pooling configuration beyond Prisma's default — fine for a single-instance deployment (documented explicitly in `rateLimit.ts`'s own comment: "would need a shared store to hold across replicas" — the codebase is self-aware that it isn't horizontally scaled yet).
- AI calls (`openai.service.ts`) are synchronous request/response with no streaming — acceptable for the current use cases (short-form pitch/proposal generation), would need a rework for longer generations.
- WhatsApp sends are synchronous within the request that triggers them (a stage change waits on the automated message's HTTP round-trip to the provider before responding). This couples user-facing request latency to a third-party API's response time; a queue/background-worker pattern would decouple this, but isn't necessary at current volume.

## Frontend
- Bundle sizes are small and healthy: 87.3 kB shared JS, with per-route first-load sizes observed between ~88 kB and ~113 kB across all 24 routes during this session's production builds — no bloat.
- No `next/image` usage anywhere — raw `<img>` tags throughout (flagged by ESLint's own `no-img-element` rule on ~6 files). Means no automatic responsive-image generation, no lazy-loading-by-default, no format negotiation (WebP/AVIF). Low urgency given current image volume and that uploads are already served from local disk without a CDN in front of them anyway.
- No explicit `React.memo`/`useMemo`/`useCallback` optimization pass has been done; given the app's data volumes (dozens of leads/properties per page, paginated), this is very unlikely to be a real bottleneck today.
- Polling-based "live" updates (notifications every 60s, pipeline board every 20s) are simple `setInterval` calls — correct and effective at this scale, but would need to move to WebSockets/SSE if update latency requirements tighten or user count grows significantly.

## Uploads / Media
- Property photos/videos are served directly from the backend container's local disk via `express.static`, with no CDN in front. Every image request round-trips through the same Node process handling API traffic. Fine at current traffic; a real bottleneck once property listings and their photo counts grow meaningfully, since static file serving competes with API request handling for the same event loop and network interface.

## Summary
Nothing found in this audit indicates an active performance problem at current usage levels. The main forward-looking risks are: (1) unbounded queries on the largest tables if lead/property volume grows an order of magnitude, (2) local-disk media serving becoming a bottleneck as photo counts grow, and (3) the lack of any caching or queueing layer becoming necessary if the user base or request volume grows significantly. None of these are urgent; all are reasonable to defer until there's a measured signal (slow query logs, response-time monitoring) indicating they're actually needed — which itself requires the monitoring infrastructure flagged as missing in the Product Audit.
