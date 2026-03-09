// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── CURRENCIES ──
  await prisma.currency.upsert({ where: { code: 'USD' }, update: {}, create: { code: 'USD', symbol: '$', name: 'US Dollar',    rateVsUSD: 1,  isBase: true } });
  await prisma.currency.upsert({ where: { code: 'INR' }, update: {}, create: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateVsUSD: 88, isBase: false } });
  console.log('✓ Currencies');

  // ── SYSTEM CONFIG ──
  const configs = [
    { key: 'STANDARD_HOURS_YEAR', value: '1800' },
    { key: 'OVERHEAD_MULTIPLIER',  value: '1.2' },
    { key: 'DEFAULT_WORKING_DAYS', value: '21' },
    { key: 'WORKING_HOURS_DAY',    value: '8' },
  ];
  for (const c of configs) {
    await prisma.systemConfig.upsert({ where: { key: c.key }, update: { value: c.value }, create: c });
  }
  console.log('✓ System config');

  // ── SKILLS ──
  const skillsData = [
    { name: 'SAP FICO',             sortOrder: 1,  submods: ['GL','AP','AR','Asset Accounting','Cost Center Accounting','Profit Center Accounting','Internal Orders','Product Costing','COPA','Tax','Banking/Treasury','Special Purpose Ledger'] },
    { name: 'SAP SD',               sortOrder: 2,  submods: ['Order Management','Pricing','Billing','Credit Management','Rebates','Consignment','Third Party','Intercompany','Foreign Trade','Transportation'] },
    { name: 'SAP MM',               sortOrder: 3,  submods: ['Procurement','Inventory Management','Vendor Evaluation','Invoice Verification','Consignment','Subcontracting','STO','Service Procurement'] },
    { name: 'SAP PP',               sortOrder: 4,  submods: ['Discrete Manufacturing','Process Manufacturing','MRP','Capacity Planning','Production Orders','QM Integration'] },
    { name: 'SAP WM/EWM',           sortOrder: 5,  submods: ['Warehouse Structure','Transfer Orders','EWM Advanced','Labour Management','Slotting'] },
    { name: 'SAP QM',               sortOrder: 6,  submods: ['Inspection Plans','Usage Decision','Quality Notifications','Certificates'] },
    { name: 'SAP PM',               sortOrder: 7,  submods: ['Equipment Master','Maintenance Orders','Preventive Maintenance','Work Clearance'] },
    { name: 'ABAP',                 sortOrder: 8,  submods: ['Core ABAP','OOP','BAPI/RFC','BAdI/Enhancement','SmartForms/Adobe Forms','ALV','Workflow','ABAP on HANA','CDS Views','OData/REST'] },
    { name: 'Basis/Infra',          sortOrder: 9,  submods: ['System Administration','Transport Management','Performance Tuning','SAP Router','SSO','HANA Administration','BTP/RISE Cloud'] },
    { name: 'SAP BW/BI',            sortOrder: 10, submods: ['BW Classic','BW/4HANA','SAC','Analysis for Office','BEx'] },
    { name: 'SAP HCM',              sortOrder: 11, submods: ['PA','OM','Time Management','Payroll','ESS/MSS'] },
    { name: 'SAP SuccessFactors',   sortOrder: 12, submods: ['Employee Central','Recruiting','Onboarding','Learning','Performance & Goals','Compensation','Workforce Analytics'] },
    { name: 'SAP Ariba/SRM',        sortOrder: 13, submods: ['Procurement','Sourcing','Contracts','Supplier Management','Guided Buying'] },
    { name: 'SAP Concur',           sortOrder: 14, submods: ['Travel','Expense','Invoice','Integration'] },
    { name: 'SAP Fieldglass',       sortOrder: 15, submods: ['Vendor Management','SOW Management','Worker Tracking'] },
    { name: 'SAP IBP',              sortOrder: 16, submods: ['Demand Planning','Supply Planning','S&OP','Inventory Optimization','Response Planning'] },
    { name: 'SAP C4C/CX',           sortOrder: 17, submods: ['Sales Cloud','Service Cloud','Marketing Cloud','Commerce Cloud','CDP'] },
    { name: 'SAP BTP',              sortOrder: 18, submods: ['Integration Suite','Extension Suite','Data & Analytics','ABAP Environment','Build Apps'] },
    { name: 'SAP S/4HANA Migration',sortOrder: 19, submods: ['Assessment','Data Migration','Cutover','RISE Migration','Brownfield','Greenfield','Selective Data Transition'] },
    { name: 'Project Management',   sortOrder: 20, submods: ['Waterfall','Agile/Scrum','SAP Activate','MS Project','RAID Management','Executive Reporting'] },
    { name: 'Other',                sortOrder: 21, submods: [] },
  ];

  const skillMap = {};
  for (const s of skillsData) {
    const skill = await prisma.skill.upsert({
      where: { name: s.name },
      update: { submods: s.submods, sortOrder: s.sortOrder },
      create: s,
    });
    skillMap[s.name] = skill.id;
  }
  console.log('✓ Skills & sub-modules');

  // ── SAMPLE RESOURCES ──
  function computeUSDhr(loc, type, input, currency, fxRate = 88, hrsYear = 1800, overhead = 1.2) {
    const isEmp = type === 'FT_EMPLOYEE' || type === 'PT_EMPLOYEE';
    const isOff = loc === 'OFFSHORE';
    if (isOff && isEmp)                        return (input / fxRate / hrsYear) * overhead;
    if (isOff && !isEmp && currency === 'INR') return input / fxRate;
    if (isOff && !isEmp && currency === 'USD') return input;
    if (!isOff && isEmp)                       return (input / hrsYear) * overhead;
    return input; // onsite contractor
  }

  const resources = [
    {
      name: 'Ravi Kumar',    empId: 'EMP-001', email: 'ravi.kumar@intraedge.com',    phone: '+91 98400 12345',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'SAP FICO', primarySubmods: ['GL','AP','AR','Cost Center Accounting','COPA'],
      secSkills: [{ skill: 'SAP S/4HANA Migration', submods: ['Assessment','Data Migration','Cutover'] }],
      joiningDate: '2021-04-01', noticePeriod: 30,
      costInput: 2400000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [
        { from: '2021-04-01', to: '2022-03-31', input: 1800000, cur: 'INR', fx: 74, reason: 'Joining' },
        { from: '2022-04-01', to: '2023-03-31', input: 2000000, cur: 'INR', fx: 82, reason: 'Increment' },
        { from: '2023-04-01', to: '2024-03-31', input: 2200000, cur: 'INR', fx: 83, reason: 'Increment' },
        { from: '2024-04-01', to: null,          input: 2400000, cur: 'INR', fx: 88, reason: 'Increment' },
      ],
    },
    {
      name: 'Anita Sharma',  empId: 'EMP-002', email: 'anita.sharma@intraedge.com',  phone: '+91 99010 23456',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'ABAP', primarySubmods: ['Core ABAP','OOP','ABAP on HANA','CDS Views','OData/REST'],
      secSkills: [{ skill: 'Basis/Infra', submods: ['Transport Management','HANA Administration'] }],
      joiningDate: '2019-08-15', noticePeriod: 60, rolloffDate: '2025-07-31',
      costInput: 1800000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [
        { from: '2019-08-15', to: '2023-03-31', input: 1200000, cur: 'INR', fx: 70, reason: 'Joining' },
        { from: '2023-04-01', to: '2024-03-31', input: 1500000, cur: 'INR', fx: 83, reason: 'Increment' },
        { from: '2024-04-01', to: null,          input: 1800000, cur: 'INR', fx: 88, reason: 'Increment' },
      ],
    },
    {
      name: 'Vikram Nair',   empId: 'EMP-003', email: 'vikram.nair@intraedge.com',   phone: '+91 90000 34567',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'SAP SD', primarySubmods: ['Order Management','Pricing','Billing','Credit Management'],
      secSkills: [{ skill: 'SAP MM', submods: ['Procurement','STO'] }],
      joiningDate: '2020-03-01', noticePeriod: 30, rolloffDate: '2025-09-15',
      costInput: 2000000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [{ from: '2020-03-01', to: null, input: 2000000, cur: 'INR', fx: 88, reason: 'Joining' }],
    },
    {
      name: 'Deepak Rao',    empId: 'EMP-004', email: 'deepak.rao@intraedge.com',    phone: '+91 88000 45678',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'Basis/Infra', primarySubmods: ['System Administration','Transport Management','Performance Tuning','HANA Administration'],
      secSkills: [],
      joiningDate: '2022-06-01', noticePeriod: 30,
      costInput: 1600000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [{ from: '2022-06-01', to: null, input: 1600000, cur: 'INR', fx: 88, reason: 'Joining' }],
    },
    {
      name: 'Priya Iyer',    empId: 'EMP-005', email: 'priya.iyer@intraedge.com',    phone: '+91 77000 56789',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'Project Management', primarySubmods: ['SAP Activate','Agile/Scrum','RAID Management','Executive Reporting'],
      secSkills: [
        { skill: 'SAP FICO', submods: ['GL','AR'] },
        { skill: 'SAP SD',   submods: ['Order Management'] },
      ],
      joiningDate: '2018-01-10', noticePeriod: 60,
      costInput: 2800000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [{ from: '2018-01-10', to: null, input: 2800000, cur: 'INR', fx: 88, reason: 'Joining' }],
    },
    {
      name: 'Rahul Mehta',   empId: 'EMP-006', email: 'rahul.mehta@intraedge.com',   phone: '+91 66000 67890',
      location: 'OFFSHORE',  employmentType: 'FT_EMPLOYEE',
      primarySkill: 'SAP SD', primarySubmods: ['Order Management','Pricing','Transportation'],
      secSkills: [],
      joiningDate: '2023-09-01', noticePeriod: 15,
      costInput: 1900000, rateCurrency: 'INR', paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [{ from: '2023-09-01', to: null, input: 1900000, cur: 'INR', fx: 88, reason: 'Joining' }],
    },
    {
      name: 'Kiran Joshi',   empId: 'CTR-001', email: 'kiran.joshi@contractor.com',  phone: '+91 55000 78901',
      location: 'OFFSHORE',  employmentType: 'CONTRACTOR',
      primarySkill: 'ABAP', primarySubmods: ['Core ABAP','BAdI/Enhancement','CDS Views'],
      secSkills: [],
      contractStart: '2025-01-15', contractEnd: '2025-12-31',
      costInput: 900, rateCurrency: 'INR', paymentTerms: 'Net 30', payCurrency: 'INR',
      visaType: 'NA', bgCheckStatus: 'NOT_REQUIRED',
      history: [{ from: '2025-01-15', to: null, input: 900, cur: 'INR', fx: 88, reason: 'Joining' }],
    },
    {
      name: 'James Miller',  empId: 'EMP-007', email: 'james.miller@intraedge.com',  phone: '+1 214 555 0100',
      location: 'ONSITE',    employmentType: 'FT_EMPLOYEE',
      primarySkill: 'SAP FICO', primarySubmods: ['GL','AP','AR','Tax','Banking/Treasury'],
      secSkills: [{ skill: 'SAP S/4HANA Migration', submods: ['Greenfield','Assessment'] }],
      joiningDate: '2020-07-01', noticePeriod: 30,
      costInput: 130000, rateCurrency: 'USD', paymentTerms: 'Monthly Payroll', payCurrency: 'USD',
      visaType: 'Citizen', bgCheckStatus: 'CLEARED',
      history: [
        { from: '2020-07-01', to: '2023-06-30', input: 110000, cur: 'USD', fx: 1, reason: 'Joining' },
        { from: '2023-07-01', to: null,          input: 130000, cur: 'USD', fx: 1, reason: 'Increment' },
      ],
    },
    {
      name: 'Sarah Chen',    empId: 'CTR-002', email: 'sarah.chen@contractor.com',   phone: '+1 972 555 0200',
      location: 'ONSITE',    employmentType: 'CONTRACTOR',
      primarySkill: 'SAP SD', primarySubmods: ['Order Management','Pricing','Billing','Intercompany'],
      secSkills: [],
      contractStart: '2025-03-01', contractEnd: '2025-09-30', rolloffDate: '2025-09-30',
      costInput: 95, rateCurrency: 'USD', paymentTerms: 'Net 60', payCurrency: 'USD',
      visaType: 'GC', bgCheckStatus: 'CLEARED',
      history: [{ from: '2025-03-01', to: null, input: 95, cur: 'USD', fx: 1, reason: 'Joining' }],
    },
  ];

  for (const r of resources) {
    const existing = await prisma.resource.findFirst({ where: { empId: r.empId } });
    if (existing) { console.log(`  skip ${r.name} (exists)`); continue; }

    const currentHistory = r.history[r.history.length - 1];
    const usd = computeUSDhr(r.location, r.employmentType, currentHistory.input, currentHistory.cur, currentHistory.fx);

    const created = await prisma.resource.create({
      data: {
        name:           r.name,
        empId:          r.empId,
        email:          r.email,
        phone:          r.phone,
        location:       r.location,
        employmentType: r.employmentType,
        joiningDate:    r.joiningDate   ? new Date(r.joiningDate)   : null,
        contractStart:  r.contractStart ? new Date(r.contractStart) : null,
        contractEnd:    r.contractEnd   ? new Date(r.contractEnd)   : null,
        rolloffDate:    r.rolloffDate   ? new Date(r.rolloffDate)   : null,
        noticePeriod:   r.noticePeriod  || null,
        visaType:       r.visaType,
        bgCheckStatus:  r.bgCheckStatus,
        primarySkillId: skillMap[r.primarySkill],
        primarySubmods: r.primarySubmods,
        costInput:      r.costInput,
        rateCurrency:   r.rateCurrency,
        paymentTerms:   r.paymentTerms,
        payCurrency:    r.payCurrency,
        status:         'AVAILABLE',
        costHistory: {
          create: r.history.map(h => ({
            effectiveFrom: new Date(h.from),
            effectiveTo:   h.to ? new Date(h.to) : null,
            inputValue:    h.input,
            inputCurrency: h.cur,
            fxSnapshot:    h.fx,
            computedUSDhr: computeUSDhr(r.location, r.employmentType, h.input, h.cur, h.fx),
            reason:        h.reason,
          })),
        },
      },
    });

    // Secondary skills
    for (const ss of r.secSkills) {
      if (!skillMap[ss.skill]) continue;
      await prisma.resourceSkill.create({
        data: { resourceId: created.id, skillId: skillMap[ss.skill], submods: ss.submods },
      });
    }
    console.log(`  ✓ ${r.name}`);
  }
  console.log('✓ Resources');

  console.log('\n✅ Seed complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
