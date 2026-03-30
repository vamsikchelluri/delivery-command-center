-- Add pmResourceId to Project (PM is a resource/billed consultant, not a user)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pmResourceId" TEXT;
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_pmResourceId_fkey"
  FOREIGN KEY ("pmResourceId") REFERENCES "Resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Project_pmResourceId_idx" ON "Project"("pmResourceId");
