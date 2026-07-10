-- The properties list defaults to sorting by createdAt desc (same as Lead, which
-- already has this index) but had no index to back that sort.

CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");
