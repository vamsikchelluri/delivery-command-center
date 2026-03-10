-- Run this directly against Railway DB to create missing auth tables

DO $$ BEGIN CREATE TYPE "AccessLevel" AS ENUM ('FULL', 'READ', 'NONE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AppRole" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL UNIQUE,
  "label"       TEXT NOT NULL,
  "description" TEXT,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Permission" (
  "id"       TEXT NOT NULL,
  "roleId"   TEXT NOT NULL,
  "module"   TEXT NOT NULL,
  "access"   "AccessLevel" NOT NULL DEFAULT 'NONE',
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Permission_roleId_module_key" UNIQUE ("roleId", "module")
);

CREATE TABLE IF NOT EXISTS "FieldPermission" (
  "id"       TEXT NOT NULL,
  "roleId"   TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "visible"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "FieldPermission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldPermission_roleId_fieldKey_key" UNIQUE ("roleId", "fieldKey")
);

CREATE TABLE IF NOT EXISTS "User" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL UNIQUE,
  "passwordHash"  TEXT NOT NULL,
  "roleId"        TEXT NOT NULL,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "mustChangePwd" BOOLEAN NOT NULL DEFAULT false,
  "mfaEnabled"    BOOLEAN NOT NULL DEFAULT false,
  "mfaSecret"     TEXT,
  "lastLogin"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL UNIQUE,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "userEmail"   TEXT,
  "action"      "AuditAction" NOT NULL,
  "module"      TEXT NOT NULL,
  "recordId"    TEXT,
  "recordLabel" TEXT,
  "oldValues"   JSONB,
  "newValues"   JSONB,
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Permission"      DROP CONSTRAINT IF EXISTS "Permission_roleId_fkey";
ALTER TABLE "Permission"      ADD CONSTRAINT "Permission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE CASCADE;

ALTER TABLE "FieldPermission" DROP CONSTRAINT IF EXISTS "FieldPermission_roleId_fkey";
ALTER TABLE "FieldPermission" ADD CONSTRAINT "FieldPermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE CASCADE;

ALTER TABLE "User"            DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
ALTER TABLE "User"            ADD CONSTRAINT "User_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AppRole"("id");

ALTER TABLE "Session"         DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Session"         ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "AuditLog"        DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog"        ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pmId" TEXT;

-- Mark migration as applied in Prisma's tracking table
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual',
  NOW(),
  '20250309_auth_rbac',
  NULL,
  NULL,
  NOW(),
  1
) ON CONFLICT DO NOTHING;
