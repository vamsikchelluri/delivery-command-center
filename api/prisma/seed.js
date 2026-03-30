// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ── MODULES & FIELD KEYS ──────────────────────────────────────────────────────
const MODULES    = ['dashboard','resources','projects','pipeline','team','financials','settings'];
const FIELD_KEYS = ['resource_cost','resource_rate','sow_billrate','sow_margin','pipeline_margin','payment_terms'];

// ── ROLES ─────────────────────────────────────────────────────────────────────
const ROLES = [
  {
    name: 'SUPER_ADMIN', label: 'Super Admin',
    description: 'Full system access including user management',
    isSystem: true,
    permissions: { dashboard:'FULL', resources:'FULL', projects:'FULL', pipeline:'FULL', team:'FULL', financials:'FULL', settings:'FULL' },
    fieldPerms:  { resource_cost:true, resource_rate:true, sow_billrate:true, sow_margin:true, pipeline_margin:true, payment_terms:true },
  },
  {
    name: 'COO', label: 'COO / Director',
    description: 'Full access to all modules and financials',
    isSystem: true,
    permissions: { dashboard:'FULL', resources:'FULL', projects:'FULL', pipeline:'FULL', team:'FULL', financials:'FULL', settings:'FULL' },
    fieldPerms:  { resource_cost:true, resource_rate:true, sow_billrate:true, sow_margin:true, pipeline_margin:true, payment_terms:true },
  },
  {
    name: 'DELIVERY_MANAGER', label: 'Delivery Manager',
    description: 'Full access to assigned projects and resources. Read-only pipeline.',
    isSystem: true,
    permissions: { dashboard:'FULL', resources:'FULL', projects:'FULL', pipeline:'READ', team:'READ', financials:'NONE', settings:'NONE' },
    fieldPerms:  { resource_cost:true, resource_rate:true, sow_billrate:true, sow_margin:true, pipeline_margin:false, payment_terms:true },
  },
  {
    name: 'ACCOUNT_MANAGER', label: 'Account Manager',
    description: 'Full pipeline access. Read-only projects. No cost rates.',
    isSystem: true,
    permissions: { dashboard:'FULL', resources:'READ', projects:'READ', pipeline:'FULL', team:'READ', financials:'NONE', settings:'NONE' },
    fieldPerms:  { resource_cost:false, resource_rate:false, sow_billrate:true, sow_margin:true, pipeline_margin:true, payment_terms:false },
  },
  {
    name: 'PROJECT_MANAGER', label: 'Project Manager',
    description: 'Resource allocation on assigned projects. No financials.',
    isSystem: true,
    permissions: { dashboard:'FULL', resources:'READ', projects:'FULL', pipeline:'NONE', team:'READ', financials:'NONE', settings:'NONE' },
    fieldPerms:  { resource_cost:false, resource_rate:false, sow_billrate:false, sow_margin:false, pipeline_margin:false, payment_terms:false },
  },
  {
    name: 'FINANCE_VIEWER', label: 'Finance Viewer',
    description: 'Read-only financials and P&L. No editing.',
    isSystem: true,
    permissions: { dashboard:'READ', resources:'NONE', projects:'READ', pipeline:'NONE', team:'NONE', financials:'READ', settings:'NONE' },
    fieldPerms:  { resource_cost:true, resource_rate:true, sow_billrate:true, sow_margin:true, pipeline_margin:true, payment_terms:true },
  },
  {
    name: 'READ_ONLY', label: 'Read Only',
    description: 'View-only access to all non-sensitive modules.',
    isSystem: true,
    permissions: { dashboard:'READ', resources:'READ', projects:'READ', pipeline:'READ', team:'READ', financials:'NONE', settings:'NONE' },
    fieldPerms:  { resource_cost:false, resource_rate:false, sow_billrate:false, sow_margin:false, pipeline_margin:false, payment_terms:false },
  },
];

// ── SEED ROLES & PERMISSIONS ──────────────────────────────────────────────────
async function seedRolesAndPerms() {
  console.log('Seeding roles and permissions...');
  for (const r of ROLES) {
    const role = await prisma.appRole.upsert({
      where:  { name: r.name },
      update: { label: r.label, description: r.description },
      create: { name: r.name, label: r.label, description: r.description, isSystem: r.isSystem },
    });
    for (const [module, access] of Object.entries(r.permissions)) {
      await prisma.permission.upsert({
        where:  { roleId_module: { roleId: role.id, module } },
        update: { access },
        create: { roleId: role.id, module, access },
      });
    }
    for (const [fieldKey, visible] of Object.entries(r.fieldPerms)) {
      await prisma.fieldPermission.upsert({
        where:  { roleId_fieldKey: { roleId: role.id, fieldKey } },
        update: { visible },
        create: { roleId: role.id, fieldKey, visible },
      });
    }
    console.log(`  ✓ ${r.label}`);
  }
}

// ── SEED SKILLS ───────────────────────────────────────────────────────────────
async function seedSkills() {
  console.log('Seeding skills...');
  const skills = [
    { name:'SAP FICO',    submods:['GL','AP','AR','AA','CO-PA','CCA','PCA','COPA','Treasury'],          sortOrder:1  },
    { name:'SAP SD',      submods:['Order Mgmt','Billing','Pricing','Credit Mgmt','Delivery'],          sortOrder:2  },
    { name:'SAP MM',      submods:['Procurement','Inventory','Vendor Mgmt','Invoice Verify'],           sortOrder:3  },
    { name:'SAP HCM',     submods:['Payroll','Time Mgmt','OM','PA','Recruitment'],                      sortOrder:4  },
    { name:'SAP Basis',   submods:['System Admin','Transport','Security','Performance'],                 sortOrder:5  },
    { name:'SAP ABAP',    submods:['Reports','BADIs','BAPIs','SmartForms','ALV','Enhancements'],         sortOrder:6  },
    { name:'SAP S/4HANA', submods:['Migration','Fiori','CDS Views','RAP','BTP'],                        sortOrder:7  },
    { name:'SAP WM/EWM',  submods:['Storage','Picking','Packing','Labour Mgmt'],                        sortOrder:8  },
    { name:'SAP PM',      submods:['Maintenance Orders','Work Centres','Notifications'],                 sortOrder:9  },
    { name:'SAP QM',      submods:['Inspection Lots','Quality Plans','Notifications'],                   sortOrder:10 },
    { name:'Project Mgmt',submods:['PMO','Agile','Waterfall','Stakeholder Mgmt'],                       sortOrder:11 },
  ];
  for (const s of skills) {
    await prisma.skill.upsert({
      where:  { name: s.name },
      update: { submods: s.submods, sortOrder: s.sortOrder },
      create: s,
    });
  }
  console.log(`  ✓ ${skills.length} skills`);
}

// ── SEED CURRENCIES ───────────────────────────────────────────────────────────
async function seedCurrencies() {
  console.log('Seeding currencies...');
  const currencies = [
    { code:'USD', symbol:'$',  name:'US Dollar',     rateVsUSD:1,    isBase:true  },
    { code:'INR', symbol:'₹',  name:'Indian Rupee',  rateVsUSD:88,   isBase:false },
    { code:'GBP', symbol:'£',  name:'British Pound', rateVsUSD:0.79, isBase:false },
    { code:'EUR', symbol:'€',  name:'Euro',          rateVsUSD:0.93, isBase:false },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({
      where:  { code: c.code },
      update: { rateVsUSD: c.rateVsUSD },
      create: c,
    });
  }
  console.log(`  ✓ ${currencies.length} currencies`);
}

// ── SEED SYSTEM CONFIG ────────────────────────────────────────────────────────
async function seedConfig() {
  console.log('Seeding system config...');
  const configs = [
    { key:'fxRate',       value:'83'   },  // INR/USD exchange rate
    { key:'hoursPerYear', value:'2008' },  // offshore billable hours/year
    { key:'wdPerMonth',   value:'21'   },
    { key:'hpd',          value:'8'    },
    { key:'overhead',     value:'1.2'  },
  ];
  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where:  { key: c.key },
      update: { value: c.value },
      create: c,
    });
  }
  console.log(`  ✓ ${configs.length} config keys`);
}

// ── SEED USERS ────────────────────────────────────────────────────────────────
async function seedUsers() {
  console.log('Seeding users...');
  const hash = await bcrypt.hash('IntraEdge2026@', 12);

  const superAdminRole    = await prisma.appRole.findUnique({ where: { name: 'SUPER_ADMIN'      } });
  const deliveryMgrRole   = await prisma.appRole.findUnique({ where: { name: 'DELIVERY_MANAGER' } });
  const accountMgrRole    = await prisma.appRole.findUnique({ where: { name: 'ACCOUNT_MANAGER'  } });

  if (!superAdminRole || !deliveryMgrRole || !accountMgrRole) {
    throw new Error('Required roles not found — run seedRolesAndPerms first');
  }

  const users = [
    {
      name:          'IntraEdge Admin',
      email:         'admin@intraedge.com',
      roleId:        superAdminRole.id,
      mustChangePwd: false,
    },
    {
      name:          'Dibyendu Ray',
      email:         'dibyendu.ray@intraedge.com',
      roleId:        deliveryMgrRole.id,
      mustChangePwd: true,
    },
    {
      name:          'Rahul Sethi',
      email:         'rahul.sethi@intraedge.com',
      roleId:        accountMgrRole.id,
      mustChangePwd: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: { ...u, passwordHash: hash, active: true },
    });
    console.log(`  ✓ ${u.name} (${u.email})`);
  }
}

// ── SEED EBAY PROJECT ─────────────────────────────────────────────────────────
async function seedEbayProject() {
  console.log('Seeding eBay project...');

  const dibyendu  = await prisma.user.findUnique({ where: { email: 'dibyendu.ray@intraedge.com'  } });
  const rahulS    = await prisma.user.findUnique({ where: { email: 'rahul.sethi@intraedge.com'   } });
  const ficoSkill = await prisma.skill.findFirst({ where: { name: { contains: 'FICO' } } });

  if (!dibyendu || !rahulS) {
    throw new Error('DM/AM users not found — run seedUsers first');
  }

  const existing = await prisma.project.findUnique({ where: { sowNumber: 'SOW-EBAY-2025-001' } });

  if (!existing) {
    await prisma.project.create({
      data: {
        client:     'eBay',
        name:       'SAP Staff Augmentation Q3/Q4 2025',
        sowNumber:  'SOW-EBAY-2025-001',
        sowType:    'TM',
        currency:   'USD',
        startDate:  new Date('2025-07-01'),
        endDate:    new Date('2025-12-31'),
        status:     'ACTIVE',
        totalValue: 2390530,
        dmUserId:   dibyendu.id,
        amUserId:   rahulS.id,
        notes:      'eBay SAP staff augmentation — 36 resources, Q3+Q4 2025. Total revenue $2,390,530.',
        roles: ficoSkill ? {
          create: [{
            title:      'SAP Consultant',
            skillId:    ficoSkill.id,
            billRate:   80,
            billingType:'TM',
            planStart:  new Date('2025-07-01'),
            planEnd:    new Date('2025-12-31'),
          }],
        } : undefined,
      },
    });
    console.log('  ✓ eBay — SOW-EBAY-2025-001 (DM: Dibyendu Ray, AM: Rahul Sethi)');
  } else {
    // Always keep DM/AM up to date on re-seed
    await prisma.project.update({
      where: { sowNumber: 'SOW-EBAY-2025-001' },
      data:  { dmUserId: dibyendu.id, amUserId: rahulS.id },
    });
    console.log('  ✓ eBay project DM/AM updated');
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting seed...\n');
  await seedRolesAndPerms();
  await seedSkills();
  await seedCurrencies();
  await seedConfig();
  await seedUsers();
  await seedEbayProject();
  console.log('\n✅ Seed complete');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
