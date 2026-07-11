import { Router } from "express";
import { z } from "zod";
import { ActivityType, NotificationType, PartnerCompanyStatus, PartnerShareStatus, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { forbidden, notFound } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { audit } from "../../services/audit.service";
import { logActivity } from "../../services/activity.service";
import { notify } from "../../services/notification.service";
import { runStageAutomation } from "../../services/pipelineAutomation.service";
import { maskPhone } from "../../lib/mask";

const router = Router();
router.use(requireAuth);

/** Property staff have no legitimate reason to see lead/partner-share data — this
 * app's only other lead-touching roles are sales staff, so gate on those explicitly
 * rather than the inverse "not a partner user" check, which let PROPERTY_STAFF (and
 * any future non-sales role) through too. */
function isSalesStaff(role: Role) {
  return role === Role.SALES_MANAGER || role === Role.SALES_EXECUTIVE || role === Role.SUPER_ADMIN;
}

// Letters, spaces, and the handful of punctuation marks real names/places use (O'Brien, St. Anne's).
const namePattern = /^[a-zA-Z\s'.-]+$/;
// Digits plus the punctuation a phone number is actually written with.
const phonePattern = /^[\d+\s().-]{5,}$/;

const partnerSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().regex(namePattern, "Contact person cannot contain numbers").optional().nullable().or(z.literal("")),
  phone: z.string().regex(phonePattern, "Enter a valid phone number").optional().nullable().or(z.literal("")),
  whatsapp: z.string().regex(phonePattern, "Enter a valid phone number").optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  city: z.string().regex(namePattern, "City cannot contain numbers").optional().nullable().or(z.literal("")),
  country: z.string().regex(namePattern, "Country cannot contain numbers").optional().nullable().or(z.literal("")),
  status: z.nativeEnum(PartnerCompanyStatus).default(PartnerCompanyStatus.ACTIVE),
  notes: z.string().optional().nullable(),
});

router.get("/", async (req, res, next) => {
  try {
    // Same rationale as isSalesStaff() above — property staff have no legitimate reason
    // to see vendor contact/notes data either.
    if (req.user!.role !== Role.PARTNER_USER && !isSalesStaff(req.user!.role)) throw forbidden();
    // Partner users only see their own company
    const where =
      req.user!.role === Role.PARTNER_USER ? { id: req.user!.partnerCompanyId ?? "__none__" } : {};
    const partners = await prisma.partnerCompany.findMany({
      where,
      include: { _count: { select: { shares: true, users: true } } },
      orderBy: { name: "asc" },
      // No pagination UI on this list (it's a compact company picker, not a searchable
      // table like Leads/Properties) — a high safety cap keeps the query bounded as the
      // vendor list grows without needing to build pagination for what's usually a
      // short list.
      take: 500,
    });
    res.json({ data: partners });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole(Role.SALES_MANAGER), validate(partnerSchema), async (req, res, next) => {
  try {
    const partner = await prisma.partnerCompany.create({
      data: { ...req.body, email: req.body.email || null },
    });
    await audit(req.user!.id, "partner_created", "partner", partner.id, { name: partner.name });
    res.status(201).json({ data: partner });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.user!.role === Role.PARTNER_USER && req.user!.partnerCompanyId !== req.params.id) {
      throw forbidden();
    }
    if (req.user!.role !== Role.PARTNER_USER && !isSalesStaff(req.user!.role)) throw forbidden();
    const partner = await prisma.partnerCompany.findUnique({
      where: { id: req.params.id },
      include: { users: { select: { id: true, name: true, email: true, isActive: true } } },
    });
    if (!partner) throw notFound("Partner company");
    res.json({ data: partner });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole(Role.SALES_MANAGER), validate(partnerSchema.partial()), async (req, res, next) => {
  try {
    const partner = await prisma.partnerCompany.update({
      where: { id: req.params.id },
      data: { ...req.body, ...(req.body.email !== undefined ? { email: req.body.email || null } : {}) },
    });
    await audit(req.user!.id, "partner_updated", "partner", partner.id);
    res.json({ data: partner });
  } catch (err) {
    next(err);
  }
});

// Leads shared with a partner (partner portal + manager tracking view)
router.get("/:id/leads", async (req, res, next) => {
  try {
    if (req.user!.role === Role.PARTNER_USER && req.user!.partnerCompanyId !== req.params.id) {
      throw forbidden();
    }
    if (req.user!.role !== Role.PARTNER_USER && !isSalesStaff(req.user!.role)) {
      throw forbidden();
    }
    const shares = await prisma.partnerLeadShare.findMany({
      where: { partnerId: req.params.id },
      include: {
        lead: {
          select: {
            id: true, fullName: true, mobile: true, whatsappNumber: true, email: true,
            city: true, budgetMin: true, budgetMax: true, currency: true,
            propertyType: true, bedrooms: true, visaType: true, status: true,
          },
        },
        sharedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // Partners see masked numbers to protect the centralized database from bulk
    // extraction; they reveal a specific client's number one at a time via /reveal-phone,
    // which is audited. Internal staff always see full numbers.
    const data = req.user!.role === Role.PARTNER_USER
      ? shares.map((s) => ({
          ...s,
          lead: { ...s.lead, mobile: maskPhone(s.lead.mobile), whatsappNumber: s.lead.whatsappNumber ? maskPhone(s.lead.whatsappNumber) : null },
        }))
      : shares;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Reveal a shared lead's real phone number for a specific partner share — a discrete,
// audited action rather than the number being visible in the list response at all times.
router.post("/shares/:shareId/reveal-phone", async (req, res, next) => {
  try {
    const share = await prisma.partnerLeadShare.findUnique({
      where: { id: req.params.shareId },
      include: { lead: { select: { mobile: true, whatsappNumber: true, fullName: true } } },
    });
    if (!share) throw notFound("Shared lead");
    const user = req.user!;
    const isPartnerOwner = user.role === Role.PARTNER_USER && user.partnerCompanyId === share.partnerId;
    if (!isPartnerOwner && !isSalesStaff(user.role)) throw forbidden();
    await audit(user.id, "partner_revealed_phone", "partner_lead_share", share.id, { leadName: share.lead.fullName });
    res.json({ data: { mobile: share.lead.mobile, whatsappNumber: share.lead.whatsappNumber } });
  } catch (err) {
    next(err);
  }
});

// Partner-side status update on a shared lead
const shareStatusSchema = z.object({
  status: z.nativeEnum(PartnerShareStatus),
  conversionNote: z.string().optional().nullable(),
  commissionNote: z.string().optional().nullable(),
});

router.put("/shares/:shareId", validate(shareStatusSchema), async (req, res, next) => {
  try {
    const share = await prisma.partnerLeadShare.findUnique({
      where: { id: req.params.shareId },
      include: { lead: true, partner: true, sharedBy: { select: { name: true } } },
    });
    if (!share) throw notFound("Shared lead");
    const user = req.user!;
    const isPartnerOwner = user.role === Role.PARTNER_USER && user.partnerCompanyId === share.partnerId;
    const isInternal = isSalesStaff(user.role);
    if (!isPartnerOwner && !isInternal) throw forbidden();

    const updated = await prisma.partnerLeadShare.update({
      where: { id: share.id },
      data: req.body,
      include: { partner: { select: { id: true, name: true } } },
    });
    await logActivity(share.leadId, user.id, ActivityType.PARTNER_STATUS_UPDATED,
      `${share.partner.name} updated status to ${req.body.status}`);

    // Notify the internal staff who shared the lead
    if (isPartnerOwner) {
      await notify({
        userId: share.sharedById,
        type: NotificationType.PARTNER_STATUS_UPDATED,
        title: `${share.partner.name} updated "${share.lead.fullName}" to ${req.body.status}`,
        meta: { leadId: share.leadId, shareId: share.id },
      });
    }
    if (req.body.status === PartnerShareStatus.CONVERTED && share.status !== PartnerShareStatus.CONVERTED) {
      const lead = await prisma.lead.update({
        where: { id: share.leadId },
        data: { status: "CONVERTED", stage: "REGISTRATION", convertedAt: new Date() },
      });
      // Partner-side closes go through the same Registration automation (testimonial +
      // referral ask) as internal stage moves — credited to the staff member who shared.
      await runStageAutomation(lead, "REGISTRATION", { id: share.sharedById, name: share.sharedBy?.name ?? "our team" });
    }
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
