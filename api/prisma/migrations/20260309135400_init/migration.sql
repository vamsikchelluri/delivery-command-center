-- CreateEnum
CREATE TYPE "Location" AS ENUM ('ONSITE', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FT_EMPLOYEE', 'PT_EMPLOYEE', 'CONTRACTOR', 'C2C');

-- CreateEnum
CREATE TYPE "BgCheckStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CLEARED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DEPLOYED', 'PARTIALLY_DEPLOYED', 'AVAILABLE', 'ON_BENCH', 'EXITED');

-- CreateEnum
CREATE TYPE "SowType" AS ENUM ('TM', 'FIXED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('TM', 'FIXED_MONTHLY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('DISCOVERY', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submods" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateVsUSD" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "empId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" "Location" NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "joiningDate" TIMESTAMP(3),
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "noticePeriod" INTEGER,
    "rolloffDate" TIMESTAMP(3),
    "visaType" TEXT,
    "visaExpiry" TIMESTAMP(3),
    "bgCheckStatus" "BgCheckStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "primarySkillId" TEXT NOT NULL,
    "primarySubmods" TEXT[],
    "costInput" DOUBLE PRECISION NOT NULL,
    "rateCurrency" TEXT NOT NULL DEFAULT 'INR',
    "paymentTerms" TEXT NOT NULL,
    "payCurrency" TEXT NOT NULL DEFAULT 'INR',
    "status" "ResourceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "benchSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceSkill" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "submods" TEXT[],

    CONSTRAINT "ResourceSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostHistory" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "inputValue" DOUBLE PRECISION NOT NULL,
    "inputCurrency" TEXT NOT NULL,
    "fxSnapshot" DOUBLE PRECISION NOT NULL,
    "computedUSDhr" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sowNumber" TEXT,
    "sowType" "SowType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientRef" TEXT,
    "clientContact" TEXT,
    "deliveryMgr" TEXT,
    "accountMgr" TEXT,
    "notes" TEXT,
    "totalValue" DOUBLE PRECISION,
    "parentId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skillId" TEXT,
    "billRate" DOUBLE PRECISION,
    "billingType" "BillingType" NOT NULL DEFAULT 'TM',
    "fixedAmount" DOUBLE PRECISION,
    "planStart" TIMESTAMP(3) NOT NULL,
    "planEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL,
    "actualDate" TIMESTAMP(3),
    "actualAmount" DOUBLE PRECISION,
    "invoiceDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allocation" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actual" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "actualHours" DOUBLE PRECISION NOT NULL,
    "enteredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'DISCOVERY',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "closeDate" TIMESTAMP(3),
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OppRole" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skillId" TEXT,
    "billRate" DOUBLE PRECISION,
    "estStartDate" TIMESTAMP(3),
    "durationMonths" INTEGER NOT NULL DEFAULT 6,
    "hoursPerMonth" INTEGER NOT NULL DEFAULT 168,

    CONSTRAINT "OppRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "Resource_status_idx" ON "Resource"("status");

-- CreateIndex
CREATE INDEX "Resource_primarySkillId_idx" ON "Resource"("primarySkillId");

-- CreateIndex
CREATE INDEX "Resource_location_employmentType_idx" ON "Resource"("location", "employmentType");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceSkill_resourceId_skillId_key" ON "ResourceSkill"("resourceId", "skillId");

-- CreateIndex
CREATE INDEX "CostHistory_resourceId_effectiveFrom_idx" ON "CostHistory"("resourceId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Project_sowNumber_key" ON "Project"("sowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_opportunityId_key" ON "Project"("opportunityId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_client_idx" ON "Project"("client");

-- CreateIndex
CREATE INDEX "Role_projectId_idx" ON "Role"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Deployment_resourceId_idx" ON "Deployment"("resourceId");

-- CreateIndex
CREATE INDEX "Deployment_roleId_idx" ON "Deployment"("roleId");

-- CreateIndex
CREATE INDEX "Actual_month_idx" ON "Actual"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Actual_deploymentId_month_key" ON "Actual"("deploymentId", "month");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_primarySkillId_fkey" FOREIGN KEY ("primarySkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceSkill" ADD CONSTRAINT "ResourceSkill_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceSkill" ADD CONSTRAINT "ResourceSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostHistory" ADD CONSTRAINT "CostHistory_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OppRole" ADD CONSTRAINT "OppRole_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
