ALTER TABLE "public"."User"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_active_idx" ON "public"."User"("active");
