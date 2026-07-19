import { Vendor, VendorStage } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { renderTemplate, sendWhatsApp } from "./whatsapp.service";

type Agent = { id: string; name: string } | null;

const TEMPLATE_BY_STAGE: Partial<Record<VendorStage, string>> = {
  REQUIREMENT_SENT: "vendor_property_request",
  MORE_DETAILS_REQUESTED: "vendor_more_details",
  SHORTLISTED: "vendor_shortlisted",
  SITE_VISIT_SCHEDULED: "vendor_site_visit",
  NEGOTIATION: "vendor_negotiation",
  DEAL_CLOSED: "vendor_thank_you",
};
// Deliberately not auto-messaged: NEW (starting state), PROPERTY_SHARED (the vendor's own
// action, nothing for us to send), PROPERTY_VERIFIED (internal bookkeeping), DEAL_LOST (no
// message wanted). "Property Sold Elsewhere?" (vendor_availability) isn't tied to any stage
// transition at all — it's an ad-hoc check-in, sent manually only.

/**
 * Fire the automated WhatsApp message (if any) tied to a vendor stage transition. Some
 * templates need details the Vendor record doesn't itself hold (the specific client
 * requirement for REQUIREMENT_SENT, the visit date/time for SITE_VISIT_SCHEDULED) — the
 * caller passes those as extraVars, filled in by whoever triggers the stage change.
 * Best-effort — a failed send here must never break the stage-change request that
 * triggered it (same rationale as the lead-side version).
 */
export async function runVendorStageAutomation(
  vendor: Vendor,
  toStage: VendorStage,
  agent: Agent,
  extraVars: Record<string, string> = {}
): Promise<void> {
  const templateKey = TEMPLATE_BY_STAGE[toStage];
  if (!templateKey) return;
  try {
    const template = await prisma.whatsAppTemplate.findFirst({ where: { key: templateKey, isActive: true, audience: "VENDOR" } });
    if (!template) return;
    const toNumber = vendor.whatsapp || vendor.phone;
    if (!toNumber) return;

    const body = renderTemplate(template.body, {
      vendor_name: vendor.name,
      ...extraVars,
    });

    const result = await sendWhatsApp(toNumber, body, vendor.name);
    await prisma.vendorWhatsAppLog.create({
      data: {
        vendorId: vendor.id,
        toNumber,
        templateId: template.id,
        body,
        sentById: agent?.id ?? vendor.createdById!,
        status: result.status,
        providerMessageId: result.providerMessageId,
        error: result.error,
      },
    });
  } catch (err) {
    console.error(`[vendorPipelineAutomation] stage trigger failed for vendor ${vendor.id} → ${toStage}:`, err instanceof Error ? err.message : err);
  }
}
