-- CreateTable
CREATE TABLE "WhatsAppInboundMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "fromNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "autoRepliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_leadId_idx" ON "WhatsAppInboundMessage"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_fromNumber_idx" ON "WhatsAppInboundMessage"("fromNumber");

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_createdAt_idx" ON "WhatsAppInboundMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppInboundMessage" ADD CONSTRAINT "WhatsAppInboundMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
