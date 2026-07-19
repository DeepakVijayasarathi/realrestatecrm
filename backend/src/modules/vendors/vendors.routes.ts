import { Router } from "express";
import { Role, VendorStage } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { audit } from "../../services/audit.service";
import { renderTemplate, sendWhatsApp } from "../../services/whatsapp.service";
import { runVendorStageAutomation } from "../../services/vendorPipelineAutomation.service";
import {
  changeVendorStageSchema,
  createVendorSchema,
  sendVendorWhatsAppSchema,
  updateVendorSchema,
} from "./vendors.schemas";

const router = Router();
router.use(requireAuth);

// Vendors (upstream property suppliers) are internal-staff-only — partner-company
// accounts have no relationship to this pipeline at all.
function isInternalStaff(role: Role) {
  return role !== Role.PARTNER_USER;
}

router.get("/", async (req, res, next) => {
  try {
    if (!isInternalStaff(req.user!.role)) throw forbidden();
    const { q, stage, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const where = {
      ...(stage ? { stage: stage as VendorStage } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
              { whatsapp: { contains: q } },
              { contactPerson: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [data, total] = await Promise.all([
      prisma.vendor.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.vendor.count({ where }),
    ]);
    res.json({ data, total, page: Number(page) || 1, pageSize: take });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole(Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.PROPERTY_STAFF), validate(createVendorSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.create({
      data: { ...req.body, email: req.body.email || null, createdById: req.user!.id },
    });
    await audit(req.user!.id, "vendor_created", "vendor", vendor.id, { name: vendor.name });
    res.status(201).json({ data: vendor });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!isInternalStaff(req.user!.role)) throw forbidden();
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        logs: { include: { sentBy: { select: { name: true } }, template: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        createdBy: { select: { name: true } },
      },
    });
    if (!vendor) throw notFound("Vendor");
    res.json({ data: vendor });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole(Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.PROPERTY_STAFF), validate(updateVendorSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { ...req.body, email: req.body.email || null },
    });
    await audit(req.user!.id, "vendor_updated", "vendor", vendor.id);
    res.json({ data: vendor });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole(Role.SALES_MANAGER), async (req, res, next) => {
  try {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, "vendor_deleted", "vendor", req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/change-stage", requireRole(Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.PROPERTY_STAFF), validate(changeVendorStageSchema), async (req, res, next) => {
  try {
    const { stage, templateVars, siteVisitAt } = req.body as {
      stage: VendorStage; templateVars?: Record<string, string>; siteVisitAt?: Date;
    };
    if (stage === VendorStage.SITE_VISIT_SCHEDULED && !siteVisitAt) {
      throw badRequest("Provide a site visit date/time to move to this stage");
    }
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { stage, ...(siteVisitAt ? { siteVisitAt } : {}) },
    });
    await audit(req.user!.id, "vendor_stage_changed", "vendor", vendor.id, { stage });

    const extraVars = { ...templateVars };
    if (siteVisitAt) {
      // Explicit timeZone, not just the "en-IN" locale (which only affects formatting
      // style, not which timezone the hour/date come from) — otherwise this silently
      // follows whatever the server process's ambient timezone happens to be.
      extraVars.date = siteVisitAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
      extraVars.time = siteVisitAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    }
    await runVendorStageAutomation(vendor, stage, { id: req.user!.id, name: req.user!.name }, extraVars);

    res.json({ data: vendor });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/send-whatsapp", requireRole(Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.PROPERTY_STAFF), validate(sendVendorWhatsAppSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) throw notFound("Vendor");
    const toNumber = vendor.whatsapp || vendor.phone;
    if (!toNumber) throw badRequest("Vendor has no WhatsApp number");

    const { templateKey, customMessage, templateVars } = req.body as {
      templateKey?: string; customMessage?: string; templateVars?: Record<string, string>;
    };
    const template = templateKey
      ? await prisma.whatsAppTemplate.findFirst({ where: { key: templateKey, isActive: true, audience: "VENDOR" } })
      : null;

    let body: string;
    if (template) {
      body = renderTemplate(template.body, { vendor_name: vendor.name, ...templateVars });
    } else if (customMessage) {
      body = customMessage;
    } else {
      throw badRequest("Provide a templateKey or a customMessage");
    }

    const result = await sendWhatsApp(toNumber, body, vendor.name);
    const log = await prisma.vendorWhatsAppLog.create({
      data: {
        vendorId: vendor.id,
        toNumber,
        templateId: template?.id,
        body,
        sentById: req.user!.id,
        status: result.status,
        providerMessageId: result.providerMessageId,
        error: result.error,
      },
    });

    if (result.status === "FAILED") {
      return res.status(502).json({ data: log, message: `WhatsApp send failed: ${result.error ?? "provider error"}` });
    }
    res.status(201).json({ data: log });
  } catch (err) {
    next(err);
  }
});

export default router;
