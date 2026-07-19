import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { MessageStatus, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { forbidden } from "../../lib/errors";
import { toCsv } from "../../lib/csv";
import { audit } from "../../services/audit.service";
import { getIntegrationSettings } from "../../services/integrationSettings.service";
import { verifyMetaSignature } from "../../lib/webhookAuth";
import { sendWhatsApp } from "../../services/whatsapp.service";

const router = Router();

// ── Delivery-status webhook (public — verified by signature/secret, not login) ────────
// "Sent" from sendWhatsApp() only ever meant "the provider's API accepted the request" —
// nothing updated a WhatsAppLog row past that point, so the UI kept showing "Sent" even
// for messages the recipient's device never actually got. This callback lets whichever
// provider is configured push real delivery/read/failed updates back, matched by the
// providerMessageId every provider already returns on send.
//
// Two auth paths, since providers speak different dialects:
//  - Meta Cloud API sends `X-Hub-Signature-256` (HMAC over the raw body with the Meta App
//    Secret) — the same mechanism already used for the Lead Ads webhook.
//  - Everyone else (SmartPing/AiSensy, MSG91, etc.) doesn't support HMAC config in their
//    dashboards, so they get a shared-secret header instead, same as the other webhooks
//    in this app (see leads.routes.ts webhook/website).
router.get("/webhook/status", async (req, res, next) => {
  try {
    const meta = (await getIntegrationSettings()).meta;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && meta.verifyToken && token === meta.verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (err) {
    next(err);
  }
});

function mapProviderStatus(raw: string): MessageStatus | null {
  switch (raw.toLowerCase()) {
    case "sent": return MessageStatus.SENT;
    case "delivered": return MessageStatus.DELIVERED;
    case "read": return MessageStatus.READ;
    case "failed": case "undelivered": case "error": return MessageStatus.FAILED;
    default: return null;
  }
}

interface StatusEvent { id: string; status: string; error?: string }

/** Meta's format nests one or more status events several levels deep; every other BSP
 * we support just posts a flat object or array — accept both shapes rather than picking one. */
function extractStatusEvents(body: unknown): StatusEvent[] {
  const events: StatusEvent[] = [];
  const b = body as Record<string, unknown> | null;
  const entries = Array.isArray(b?.entry) ? (b!.entry as Record<string, unknown>[]) : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      const statuses = Array.isArray(value?.statuses) ? (value!.statuses as Record<string, unknown>[]) : [];
      for (const s of statuses) {
        if (typeof s.id === "string" && typeof s.status === "string") {
          const errors = Array.isArray(s.errors) ? (s.errors as { title?: string }[]) : [];
          events.push({ id: s.id, status: s.status, error: errors[0]?.title });
        }
      }
    }
  }
  if (events.length) return events;

  const flat = Array.isArray(b?.statuses) ? (b!.statuses as unknown[]) : Array.isArray(body) ? (body as unknown[]) : [body];
  for (const item of flat) {
    const o = item as Record<string, unknown> | null;
    const id = (o?.id ?? o?.messageId ?? o?.message_id ?? o?.submitted_message_id) as string | undefined;
    const status = (o?.status ?? o?.messageStatus) as string | undefined;
    if (typeof id === "string" && typeof status === "string") {
      events.push({ id, status, error: (o?.error ?? o?.reason) as string | undefined });
    }
  }
  return events;
}

interface InboundEvent { id?: string; from: string; body: string }

/** Same defensive-parsing approach as extractStatusEvents — Meta nests inbound messages
 * under entry[].changes[].value.messages[], everyone else tends to post something flatter.
 * The exact shape a BSP other than Meta actually uses here is unconfirmed (no account with
 * inbound webhooks enabled to test against yet), so this accepts a handful of the most
 * common field-name variants rather than committing to one. */
function extractInboundEvents(body: unknown): InboundEvent[] {
  const events: InboundEvent[] = [];
  const b = body as Record<string, unknown> | null;
  const entries = Array.isArray(b?.entry) ? (b!.entry as Record<string, unknown>[]) : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as Record<string, unknown>[]) : [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      const messages = Array.isArray(value?.messages) ? (value!.messages as Record<string, unknown>[]) : [];
      for (const m of messages) {
        const from = m.from as string | undefined;
        const text = (m.text as { body?: string } | undefined)?.body;
        if (from && text) events.push({ id: m.id as string | undefined, from, body: text });
      }
    }
  }
  if (events.length) return events;

  const flat = Array.isArray(b?.messages) ? (b!.messages as unknown[]) : Array.isArray(body) ? (body as unknown[]) : [body];
  for (const item of flat) {
    const o = item as Record<string, unknown> | null;
    const from = (o?.from ?? o?.sender ?? o?.mobile ?? o?.waId ?? o?.wa_id) as string | undefined;
    const text = (o?.text ?? o?.body ?? o?.message) as string | undefined;
    if (typeof from === "string" && typeof text === "string") {
      events.push({ id: (o?.id ?? o?.messageId) as string | undefined, from, body: text });
    }
  }
  return events;
}

/** Last-10-digits match so "+919150349580", "919150349580", and "9150349580" all match
 * the same lead regardless of which format a BSP's webhook happens to send the sender in. */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

const AUTO_REPLY_BODY =
  "Hi! Thanks for reaching out to Thanjai Property.\nWe've received your message and our team will get back to you shortly.";

async function handleInboundMessages(events: InboundEvent[]) {
  if (!events.length) return;
  // Small lead volume for now — matching in JS after one bulk fetch is simpler and just
  // as correct as a fuzzy SQL match, and cheap at this scale.
  const leads = await prisma.lead.findMany({ select: { id: true, mobile: true, whatsappNumber: true, assignedToId: true, createdById: true } });
  for (const e of events) {
    const fromNorm = normalizePhone(e.from);
    const lead = leads.find((l) => normalizePhone(l.whatsappNumber || l.mobile) === fromNorm);
    const inbound = await prisma.whatsAppInboundMessage.create({
      data: { leadId: lead?.id, fromNumber: e.from, body: e.body, providerMessageId: e.id },
    });
    // Only auto-reply (and only log it) when the sender matches a known lead — an
    // unmatched number gets recorded for visibility but no automated response, since we
    // don't know who they are yet.
    const sentById = lead?.assignedToId ?? lead?.createdById;
    if (lead && sentById) {
      const result = await sendWhatsApp(e.from, AUTO_REPLY_BODY, undefined);
      await prisma.whatsAppLog.create({
        data: {
          leadId: lead.id,
          toNumber: e.from,
          body: AUTO_REPLY_BODY,
          sentById,
          status: result.status,
          providerMessageId: result.providerMessageId,
          error: result.error,
        },
      });
      if (result.status !== "FAILED") {
        await prisma.whatsAppInboundMessage.update({ where: { id: inbound.id }, data: { autoRepliedAt: new Date() } });
      }
    }
  }
}

router.post("/webhook/status", async (req, res, next) => {
  try {
    const settings = await getIntegrationSettings();
    const signature = req.header("x-hub-signature-256");
    if (signature) {
      if (!verifyMetaSignature(req.rawBody, signature, settings.meta.appSecret)) return res.sendStatus(401);
    } else {
      const expected = settings.whatsapp.statusWebhookSecret;
      if (!expected) return res.sendStatus(503);
      const provided = req.header("x-webhook-secret") ?? "";
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(401);
    }

    const events = extractStatusEvents(req.body);
    await Promise.all(
      events.map(async (e) => {
        const status = mapProviderStatus(e.status);
        if (!status) return;
        await prisma.whatsAppLog.updateMany({
          where: { providerMessageId: e.id },
          data: { status, ...(status === MessageStatus.FAILED && e.error ? { error: e.error } : {}) },
        });
      })
    );

    // Same webhook URL carries both event types (this is how Meta Cloud API already
    // works — one callback, differentiated by which field is present in the payload) so
    // there's only ever one URL/secret to hand a provider, not two.
    await handleInboundMessages(extractInboundEvents(req.body));
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

// Templates — read for internal staff, write for admins/managers. Partners have no
// legitimate reason to see internal message templates (same rationale used for vendor
// data in partners.routes.ts) — this was previously open to any authenticated user.
// Defaults to LEAD-audience templates (what every existing caller expects) — vendor
// templates use a different placeholder set ({{vendor_name}}, {{location}}, etc.) and
// would just confuse the lead-side send dropdown if mixed in. Settings > Templates
// passes ?audience=all to manage both from one screen.
router.get("/templates", async (req, res, next) => {
  try {
    if (req.user!.role === Role.PARTNER_USER) throw forbidden();
    const audience = req.query.audience as string | undefined;
    const where = audience === "all" ? {} : { audience: (audience === "VENDOR" ? "VENDOR" : "LEAD") as "LEAD" | "VENDOR" };
    const templates = await prisma.whatsAppTemplate.findMany({ where, orderBy: { name: "asc" } });
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
});

// CSV export of every template — for handing to a client/stakeholder to review the
// exact wording (e.g. before submitting the wrapper template to Meta for approval),
// not for re-import.
router.get("/templates/export", requireRole(Role.SALES_MANAGER), async (_req, res, next) => {
  try {
    const templates = await prisma.whatsAppTemplate.findMany({ orderBy: { name: "asc" } });
    const csv = toCsv(templates, ["key", "name", "body", "isActive", "createdAt", "updatedAt"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="whatsapp-templates-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

const templateSchema = z.object({
  key: z.string().min(2).regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - and _"),
  name: z.string().min(2),
  body: z.string().min(5),
  audience: z.enum(["LEAD", "VENDOR"]).default("LEAD"),
  isActive: z.boolean().default(true),
});

router.post("/templates", requireRole(Role.SALES_MANAGER), validate(templateSchema), async (req, res, next) => {
  try {
    const template = await prisma.whatsAppTemplate.create({ data: req.body });
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

router.put("/templates/:id", requireRole(Role.SALES_MANAGER), validate(templateSchema.partial()), async (req, res, next) => {
  try {
    const template = await prisma.whatsAppTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

// CSV export of the full message log — same PII-export governance as leads/properties
// export (Super Admin only), since this carries phone numbers and message content too.
router.get("/logs/export", requireRole(), async (req, res, next) => {
  try {
    const logs = await prisma.whatsAppLog.findMany({
      include: {
        lead: { select: { fullName: true } },
        sentBy: { select: { name: true } },
        template: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const rows = logs.map((log) => ({
      createdAt: log.createdAt,
      leadName: log.lead.fullName,
      toNumber: log.toNumber,
      sentBy: log.sentBy.name,
      // The template's own name already conveys why this was sent (e.g. "Property
      // shortlist", "Site visit confirmation (auto)") — falling back to whether any
      // properties were attached for the few sends that used neither a template nor
      // shared properties (a fully custom, freeform message).
      purpose: log.template?.name ?? (log.propertyIds.length ? "Property shortlist (custom message)" : "Custom message"),
      body: log.body,
      status: log.status,
      error: log.error ?? "",
    }));
    const csv = toCsv(rows, ["createdAt", "leadName", "toNumber", "sentBy", "purpose", "body", "status", "error"]);
    await audit(req.user!.id, "whatsapp_logs_exported", "whatsapp_log", undefined, { count: logs.length });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="whatsapp-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// Message log review (managers see all, staff see their own)
router.get("/logs", async (req, res, next) => {
  try {
    const { leadId, page = "1", pageSize = "25" } = req.query as Record<string, string>;
    const isManager = req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.SALES_MANAGER;
    const where = {
      ...(leadId ? { leadId } : {}),
      ...(isManager ? {} : { sentById: req.user!.id }),
    };
    const take = Math.min(Number(pageSize) || 25, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [total, data] = await Promise.all([
      prisma.whatsAppLog.count({ where }),
      prisma.whatsAppLog.findMany({
        where,
        include: {
          lead: { select: { id: true, fullName: true } },
          sentBy: { select: { name: true } },
          template: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    res.json({ data, total, page: Number(page), pageSize: take });
  } catch (err) {
    next(err);
  }
});

export default router;
