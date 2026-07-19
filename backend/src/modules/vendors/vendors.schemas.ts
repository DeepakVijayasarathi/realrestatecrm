import { z } from "zod";
import { VendorStage } from "@prisma/client";

const phonePattern = /^[\d+\s().-]{5,}$/;

export const createVendorSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().regex(phonePattern, "Enter a valid phone number").optional().nullable().or(z.literal("")),
  whatsapp: z.string().regex(phonePattern, "Enter a valid phone number").optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable(),
  propertyTypes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const changeVendorStageSchema = z.object({
  stage: z.nativeEnum(VendorStage),
  // Filled in by whoever triggers the move — the specific client requirement for
  // REQUIREMENT_SENT (nothing on the Vendor record itself holds this, it varies per send).
  templateVars: z.record(z.string()).optional(),
  // Required to move into SITE_VISIT_SCHEDULED — feeds both the stored siteVisitAt field
  // and the {{date}}/{{time}} template placeholders.
  siteVisitAt: z.coerce.date().optional(),
});

export const sendVendorWhatsAppSchema = z.object({
  templateKey: z.string().optional(),
  customMessage: z.string().optional(),
  templateVars: z.record(z.string()).optional(),
});
