-- Add PM/DM/AM user FK fields to Project, drop old text fields
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pmUserId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "dmUserId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "amUserId" TEXT;
ALTER TABLE "Project" DROP COLUMN IF EXISTS "deliveryMgr";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "accountMgr";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "pmId";
