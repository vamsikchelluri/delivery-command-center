-- Step 2: New enums (fresh transaction — safe to use immediately)
DO $$ BEGIN
  CREATE TYPE "PersonRole" AS ENUM ('ACCOUNT_MANAGER', 'DELIVERY_MANAGER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "RoleStatus" AS ENUM ('OPEN', 'IDENTIFIED', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ExperienceLevel" AS ENUM ('JUNIOR', 'MEDIUM', 'SENIOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OppSource" AS ENUM ('EXISTING_ACCOUNT', 'REFERRAL', 'RFP', 'COLD_OUTREACH', 'PARTNER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable Person
CREATE TABLE IF NOT EXISTS "Person" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "role"      "PersonRole" NOT NULL,
    "email"     TEXT,
    "phone"     TEXT,
    "notes"     TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Person_role_idx" ON "Person"("role");

-- Drop old OppRole table if exists
DROP TABLE IF EXISTS "OppRole";

-- Alter Opportunity table
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "source"            "OppSource" NOT NULL DEFAULT 'EXISTING_ACCOUNT',
  ADD COLUMN IF NOT EXISTS "accountManagerId"  TEXT,
  ADD COLUMN IF NOT EXISTS "startDate"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "targetMargin"      DOUBLE PRECISION NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS "currency"          TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "convertedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "probability"       INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "Opportunity"
  DROP COLUMN IF EXISTS "closeDate",
  DROP COLUMN IF EXISTS "owner";

ALTER TABLE "Opportunity" ALTER COLUMN "stage" SET DEFAULT 'QUALIFYING';

-- CreateTable OppRole
CREATE TABLE IF NOT EXISTS "OppRole" (
    "id"              TEXT NOT NULL,
    "opportunityId"   TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "location"        "Location" NOT NULL DEFAULT 'OFFSHORE',
    "ftPt"            TEXT NOT NULL DEFAULT 'Full-Time',
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'MEDIUM',
    "yearsExp"        TEXT,
    "totalHours"      DOUBLE PRECISION,
    "billRate"        DOUBLE PRECISION,
    "costGuidance"    DOUBLE PRECISION,
    "costOverride"    BOOLEAN NOT NULL DEFAULT false,
    "status"          "RoleStatus" NOT NULL DEFAULT 'OPEN',
    "resourceName"    TEXT,
    "resourceId"      TEXT,
    "notes"           TEXT,
    "sortOrder"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OppRole_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OppRole_opportunityId_idx" ON "OppRole"("opportunityId");

ALTER TABLE "OppRole" DROP CONSTRAINT IF EXISTS "OppRole_opportunityId_fkey";
ALTER TABLE "OppRole" ADD CONSTRAINT "OppRole_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
