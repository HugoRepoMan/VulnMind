ALTER TABLE "knowledge"."KnowledgeRule"
ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "KnowledgeRule_code_key"
ON "knowledge"."KnowledgeRule"("code");
