// cleanup.js — run from dcc/api folder
// node cleanup.js

process.env.DATABASE_URL = 'postgresql://postgres:vBhcRrtlmaVDSuJnFDDZCIannZWOcxiC@yamanote.proxy.rlwy.net:20105/railway';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning old data...');

  const d1 = await prisma.actual.deleteMany();
  console.log(`  deleted ${d1.count} actuals`);

  const d2 = await prisma.deployment.deleteMany();
  console.log(`  deleted ${d2.count} deployments`);

  const d3 = await prisma.costHistory.deleteMany();
  console.log(`  deleted ${d3.count} cost history`);

  const d4 = await prisma.resourceSkill.deleteMany();
  console.log(`  deleted ${d4.count} resource skills`);

  const d5 = await prisma.resource.deleteMany();
  console.log(`  deleted ${d5.count} resources`);

  const d6 = await prisma.milestone.deleteMany();
  console.log(`  deleted ${d6.count} milestones`);

  const d7 = await prisma.role.deleteMany({
    where: { project: { sowNumber: { not: 'SOW-EBAY-2025-001' } } }
  });
  console.log(`  deleted ${d7.count} roles (non-eBay)`);

  const d8 = await prisma.project.deleteMany({
    where: { sowNumber: { not: 'SOW-EBAY-2025-001' } }
  });
  console.log(`  deleted ${d8.count} projects (non-eBay)`);

  console.log('\nDone. DB is clean.');
}

clean()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
