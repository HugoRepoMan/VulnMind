ALTER TABLE "Finding"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT;

ALTER TABLE "knowledge"."FindingAnalysis"
ADD COLUMN "riskBreakdown" JSONB,
ADD COLUMN "engineVersion" TEXT NOT NULL DEFAULT '1.0';

CREATE UNIQUE INDEX "Finding_idempotencyKey_key" ON "Finding"("idempotencyKey");
