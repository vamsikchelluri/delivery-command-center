-- Migration: Add PM/DM/AM to Project, enrich OppRole, add convertedAt to Opportunity

-- Project: PM/DM/AM user links
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pmUserId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "dmUserId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "amUserId" TEXT;

-- FK constraints (safe — uses IF NOT EXISTS equivalent via DO block)
DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_pmUserId_fkey"
    FOREIGN KEY ("pmUserId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_dmUserId_fkey"
    FOREIGN KEY ("dmUserId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_amUserId_fkey"
    FOREIGN KEY ("amUserId") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Opportunity: add richer fields
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source"           TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "accountManagerId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "startDate"        TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "endDate"          TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "targetMargin"     DOUBLE PRECISION NOT NULL DEFAULT 30;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "currency"         TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "convertedAt"      TIMESTAMP(3);

-- OppRole: replace simple fields with rich staffing fields
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "location"        TEXT NOT NULL DEFAULT 'OFFSHORE';
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "ftPt"            TEXT NOT NULL DEFAULT 'FT';
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "experienceLevel" TEXT;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "yearsExp"        INTEGER;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "totalHours"      DOUBLE PRECISION;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "costGuidance"    DOUBLE PRECISION;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "costOverride"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "resourceId"      TEXT;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "resourceName"    TEXT;
ALTER TABLE "OppRole" ADD COLUMN IF NOT EXISTS "notes"           TEXT;
