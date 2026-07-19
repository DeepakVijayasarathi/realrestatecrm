-- CreateEnum
CREATE TYPE "VendorStage" AS ENUM ('NEW', 'REQUIREMENT_SENT', 'PROPERTY_SHARED', 'MORE_DETAILS_REQUESTED', 'PROPERTY_VERIFIED', 'SHORTLISTED', 'SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'DEAL_CLOSED', 'DEAL_LOST');

-- CreateEnum
CREATE TYPE "TemplateAudience" AS ENUM ('LEAD', 'VENDOR');

-- AlterTable
ALTER TABLE "WhatsAppTemplate" ADD COLUMN     "audience" "TemplateAudience" NOT NULL DEFAULT 'LEAD';

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "city" TEXT,
    "propertyTypes" TEXT,
    "notes" TEXT,
    "stage" "VendorStage" NOT NULL DEFAULT 'NEW',
    "siteVisitAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorWhatsAppLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "body" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorWhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_stage_idx" ON "Vendor"("stage");

-- CreateIndex
CREATE INDEX "Vendor_createdAt_idx" ON "Vendor"("createdAt");

-- CreateIndex
CREATE INDEX "VendorWhatsAppLog_vendorId_idx" ON "VendorWhatsAppLog"("vendorId");

-- CreateIndex
CREATE INDEX "VendorWhatsAppLog_sentById_idx" ON "VendorWhatsAppLog"("sentById");

-- CreateIndex
CREATE INDEX "VendorWhatsAppLog_createdAt_idx" ON "VendorWhatsAppLog"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_audience_idx" ON "WhatsAppTemplate"("audience");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorWhatsAppLog" ADD CONSTRAINT "VendorWhatsAppLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorWhatsAppLog" ADD CONSTRAINT "VendorWhatsAppLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorWhatsAppLog" ADD CONSTRAINT "VendorWhatsAppLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
