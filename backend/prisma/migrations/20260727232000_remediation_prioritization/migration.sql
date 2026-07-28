ALTER TABLE "public"."Asset"
ADD COLUMN "criticality" TEXT NOT NULL DEFAULT 'MEDIUM';

ALTER TABLE "knowledge"."KnowledgeRule"
ADD COLUMN "remediationEffort" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "dependencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Asset_criticality_idx"
ON "public"."Asset"("criticality");

CREATE INDEX "KnowledgeRule_remediationEffort_idx"
ON "knowledge"."KnowledgeRule"("remediationEffort");
