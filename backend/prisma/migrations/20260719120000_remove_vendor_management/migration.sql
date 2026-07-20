-- Vendor management removed entirely (feature was soft-disabled, now dropped for good
-- along with its data). VENDOR-audience templates existed only to serve vendor stage
-- automation, which no longer exists, so they're removed too. The TemplateAudience enum
-- value "VENDOR" itself is left in place (dropping an enum value requires recreating the
-- type; not worth the risk for an enum value nothing will select going forward).

-- DropForeignKey
ALTER TABLE "VendorWhatsAppLog" DROP CONSTRAINT IF EXISTS "VendorWhatsAppLog_vendorId_fkey";
ALTER TABLE "VendorWhatsAppLog" DROP CONSTRAINT IF EXISTS "VendorWhatsAppLog_templateId_fkey";
ALTER TABLE "VendorWhatsAppLog" DROP CONSTRAINT IF EXISTS "VendorWhatsAppLog_sentById_fkey";
ALTER TABLE "Vendor" DROP CONSTRAINT IF EXISTS "Vendor_createdById_fkey";

-- DropTable
DROP TABLE IF EXISTS "VendorWhatsAppLog";
DROP TABLE IF EXISTS "Vendor";

-- DropEnum
DROP TYPE IF EXISTS "VendorStage";

-- Remove orphaned vendor-audience templates (vendor_property_request, vendor_more_details,
-- vendor_shortlisted, vendor_site_visit, vendor_negotiation, vendor_thank_you,
-- vendor_availability) — nothing can reference them anymore.
DELETE FROM "WhatsAppTemplate" WHERE "audience" = 'VENDOR';
