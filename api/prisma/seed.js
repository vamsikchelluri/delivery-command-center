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

  // ── SAMPLE SOWs ──
  // Fetch resource IDs by empId so we can assign deployments
  const res = {};
  for (const empId of ['EMP-001','EMP-002','EMP-003','EMP-004','EMP-005','EMP-006','EMP-007','CTR-001','CTR-002']) {
    const r = await prisma.resource.findFirst({ where: { empId } });
    if (r) res[empId] = r.id;
  }

  const sowsData = [
    // ── SOW 1: T&M, Active, Coca-Cola S/4HANA ──
    {
      key: 'SOW-2024-001',
      data: {
        name:          'S/4HANA Finance Rollout',
        client:        'Coca-Cola North America',
        sowNumber:     'SOW-2024-001',
        sowType:       'TM',
        currency:      'USD',
        status:        'ACTIVE',
        startDate:     new Date('2024-06-01'),
        endDate:       new Date('2025-09-30'),
        totalValue:    650000,
        deliveryMgr:   'Priya Iyer',
        accountMgr:    'James Miller',
        clientContact: 'David Walsh',
        clientRef:     'PO-CC-2024-88',
        notes:         'Phase 1 covers GL, AP, AR and Cost Center Accounting. Phase 2 (COPA, Product Costing) starts Q3 2025.',
      },
      roles: [
        {
          title: 'SAP FICO Lead', skillName: 'SAP FICO', billingType: 'TM', billRate: 145,
          planStart: new Date('2024-06-01'), planEnd: new Date('2025-09-30'),
          deployment: { empId: 'EMP-001', allocation: 100, start: '2024-06-01', end: '2025-09-30' },
        },
        {
          title: 'SAP SD Consultant', skillName: 'SAP SD', billingType: 'TM', billRate: 125,
          planStart: new Date('2024-08-01'), planEnd: new Date('2025-09-30'),
          deployment: { empId: 'EMP-003', allocation: 100, start: '2024-08-01', end: '2025-09-30' },
        },
        {
          title: 'ABAP Developer', skillName: 'ABAP', billingType: 'TM', billRate: 110,
          planStart: new Date('2024-09-01'), planEnd: new Date('2025-06-30'),
          deployment: { empId: 'CTR-001', allocation: 100, start: '2024-09-01', end: '2025-06-30' },
        },
      ],
      milestones: [],
      actuals: [
        // Ravi Kumar (EMP-001) — 6 months of actuals
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2024-09', hours: 168 },
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2024-10', hours: 172 },
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2024-11', hours: 160 },
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2024-12', hours: 152 },
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2025-01', hours: 168 },
        { empId: 'EMP-001', roleTitle: 'SAP FICO Lead',     month: '2025-02', hours: 160 },
        // Vikram (EMP-003)
        { empId: 'EMP-003', roleTitle: 'SAP SD Consultant', month: '2024-09', hours: 160 },
        { empId: 'EMP-003', roleTitle: 'SAP SD Consultant', month: '2024-10', hours: 168 },
        { empId: 'EMP-003', roleTitle: 'SAP SD Consultant', month: '2024-11', hours: 155 },
        // Kiran (CTR-001)
        { empId: 'CTR-001', roleTitle: 'ABAP Developer',    month: '2024-10', hours: 168 },
        { empId: 'CTR-001', roleTitle: 'ABAP Developer',    month: '2024-11', hours: 160 },
        { empId: 'CTR-001', roleTitle: 'ABAP Developer',    month: '2024-12', hours: 148 },
      ],
    },

    // ── SOW 2: Fixed Price, Active, Pepsi EWM ──
    {
      key: 'SOW-2024-002',
      data: {
        name:          'EWM Implementation — DC Automation',
        client:        'PepsiCo Supply Chain',
        sowNumber:     'SOW-2024-002',
        sowType:       'FIXED',
        currency:      'USD',
        status:        'ACTIVE',
        startDate:     new Date('2024-10-01'),
        endDate:       new Date('2025-06-30'),
        totalValue:    420000,
        deliveryMgr:   'Priya Iyer',
        accountMgr:    'James Miller',
        clientContact: 'Sandra Lee',
        clientRef:     'PO-PEP-2024-12',
        notes:         'Fixed price EWM rollout across 3 DCs. Milestone billing.',
      },
      roles: [
        {
          title: 'ABAP Developer', skillName: 'ABAP', billingType: 'TM', billRate: 115,
          planStart: new Date('2024-10-01'), planEnd: new Date('2025-06-30'),
          deployment: { empId: 'EMP-002', allocation: 100, start: '2024-10-01', end: '2025-06-30' },
        },
        {
          title: 'Basis Consultant', skillName: 'Basis/Infra', billingType: 'TM', billRate: 105,
          planStart: new Date('2024-10-01'), planEnd: new Date('2025-03-31'),
          deployment: { empId: 'EMP-004', allocation: 75, start: '2024-10-01', end: '2025-03-31' },
        },
      ],
      milestones: [
        { name: 'DC1 Blueprint Sign-off',     plannedDate: new Date('2024-12-15'), plannedAmount: 105000, actualDate: new Date('2024-12-18'), invoiceDate: new Date('2024-12-20'), paymentDate: new Date('2025-01-15'), status: 'RECEIVED' },
        { name: 'DC1 Go-Live',                plannedDate: new Date('2025-02-28'), plannedAmount: 105000, actualDate: new Date('2025-03-05'), invoiceDate: new Date('2025-03-07'), paymentDate: null,                   status: 'INVOICED' },
        { name: 'DC2 + DC3 Blueprint',        plannedDate: new Date('2025-04-30'), plannedAmount: 105000, actualDate: null,                  invoiceDate: null,                   paymentDate: null,                   status: 'UPCOMING' },
        { name: 'DC2 + DC3 Go-Live & Closure',plannedDate: new Date('2025-06-30'), plannedAmount: 105000, actualDate: null,                  invoiceDate: null,                   paymentDate: null,                   status: 'UPCOMING' },
      ],
      actuals: [
        { empId: 'EMP-002', roleTitle: 'ABAP Developer',  month: '2024-10', hours: 168 },
        { empId: 'EMP-002', roleTitle: 'ABAP Developer',  month: '2024-11', hours: 172 },
        { empId: 'EMP-002', roleTitle: 'ABAP Developer',  month: '2024-12', hours: 160 },
        { empId: 'EMP-002', roleTitle: 'ABAP Developer',  month: '2025-01', hours: 168 },
        { empId: 'EMP-004', roleTitle: 'Basis Consultant', month: '2024-10', hours: 126 },
        { empId: 'EMP-004', roleTitle: 'Basis Consultant', month: '2024-11', hours: 130 },
        { empId: 'EMP-004', roleTitle: 'Basis Consultant', month: '2024-12', hours: 122 },
      ],
    },

    // ── SOW 3: T&M, Active, JPMorgan Onsite ──
    {
      key: 'SOW-2025-001',
      data: {
        name:          'SAP FICO Support & Enhancements',
        client:        'JPMorgan Chase',
        sowNumber:     'SOW-2025-001',
        sowType:       'TM',
        currency:      'USD',
        status:        'ACTIVE',
        startDate:     new Date('2025-01-01'),
        endDate:       new Date('2025-12-31'),
        totalValue:    320000,
        deliveryMgr:   'James Miller',
        accountMgr:    'James Miller',
        clientContact: 'Michael Torres',
        clientRef:     'PO-JPM-2025-04',
        notes:         'Ongoing AMS support plus quarterly enhancement sprints.',
      },
      roles: [
        {
          title: 'Sr. SAP FICO Consultant', skillName: 'SAP FICO', billingType: 'TM', billRate: 175,
          planStart: new Date('2025-01-01'), planEnd: new Date('2025-12-31'),
          deployment: { empId: 'EMP-007', allocation: 100, start: '2025-01-01', end: '2025-12-31' },
        },
        {
          title: 'SAP SD Consultant', skillName: 'SAP SD', billingType: 'TM', billRate: 155,
          planStart: new Date('2025-03-01'), planEnd: new Date('2025-09-30'),
          deployment: { empId: 'CTR-002', allocation: 100, start: '2025-03-01', end: '2025-09-30' },
        },
      ],
      milestones: [],
      actuals: [
        { empId: 'EMP-007', roleTitle: 'Sr. SAP FICO Consultant', month: '2025-01', hours: 160 },
        { empId: 'EMP-007', roleTitle: 'Sr. SAP FICO Consultant', month: '2025-02', hours: 152 },
        { empId: 'CTR-002', roleTitle: 'SAP SD Consultant',       month: '2025-03', hours: 168 },
      ],
    },

    // ── SOW 4: Fixed Price, Completed ──
    {
      key: 'SOW-2023-003',
      data: {
        name:          'SAP BW/4HANA Migration',
        client:        'Unilever Analytics',
        sowNumber:     'SOW-2023-003',
        sowType:       'FIXED',
        currency:      'USD',
        status:        'COMPLETED',
        startDate:     new Date('2023-07-01'),
        endDate:       new Date('2024-03-31'),
        totalValue:    280000,
        deliveryMgr:   'Priya Iyer',
        accountMgr:    'Priya Iyer',
        clientContact: 'Claire Nguyen',
        clientRef:     'PO-UL-2023-07',
        notes:         'Full BW classic to BW/4HANA migration. Delivered on time.',
      },
      roles: [
        {
          title: 'Project Manager', skillName: 'Project Management', billingType: 'FIXED_MONTHLY', fixedAmount: 18000,
          planStart: new Date('2023-07-01'), planEnd: new Date('2024-03-31'),
          deployment: { empId: 'EMP-005', allocation: 100, start: '2023-07-01', end: '2024-03-31' },
        },
        {
          title: 'SD Analyst', skillName: 'SAP SD', billingType: 'TM', billRate: 120,
          planStart: new Date('2023-07-01'), planEnd: new Date('2024-01-31'),
          deployment: { empId: 'EMP-006', allocation: 100, start: '2023-07-01', end: '2024-01-31' },
        },
      ],
      milestones: [
        { name: 'Data Assessment & Mapping',  plannedDate: new Date('2023-09-30'), plannedAmount: 70000,  actualDate: new Date('2023-09-28'), invoiceDate: new Date('2023-10-02'), paymentDate: new Date('2023-10-30'), status: 'RECEIVED' },
        { name: 'Migration Execution',        plannedDate: new Date('2023-12-31'), plannedAmount: 70000,  actualDate: new Date('2024-01-05'), invoiceDate: new Date('2024-01-08'), paymentDate: new Date('2024-02-05'), status: 'RECEIVED' },
        { name: 'UAT Sign-off',               plannedDate: new Date('2024-02-29'), plannedAmount: 70000,  actualDate: new Date('2024-02-27'), invoiceDate: new Date('2024-03-01'), paymentDate: new Date('2024-03-28'), status: 'RECEIVED' },
        { name: 'Go-Live & Hypercare',        plannedDate: new Date('2024-03-31'), plannedAmount: 70000,  actualDate: new Date('2024-03-31'), invoiceDate: new Date('2024-04-01'), paymentDate: new Date('2024-04-29'), status: 'RECEIVED' },
      ],
      actuals: [],
    },
  ];

  for (const sow of sowsData) {
    const existingProj = await prisma.project.findFirst({ where: { sowNumber: sow.key } });
    if (existingProj) { console.log(`  skip SOW ${sow.key} (exists)`); continue; }

    // Create project with milestones
    const project = await prisma.project.create({
      data: {
        ...sow.data,
        milestones: sow.milestones.length > 0 ? { create: sow.milestones } : undefined,
      },
    });

    // Create roles + deployments + actuals
    for (const roleSpec of sow.roles) {
      const skill = await prisma.skill.findFirst({ where: { name: roleSpec.skillName } });
      const role = await prisma.role.create({
        data: {
          projectId:   project.id,
          title:       roleSpec.title,
          skillId:     skill?.id || null,
          billingType: roleSpec.billingType,
          billRate:    roleSpec.billRate    || null,
          fixedAmount: roleSpec.fixedAmount || null,
          planStart:   roleSpec.planStart,
          planEnd:     roleSpec.planEnd,
        },
      });

      if (roleSpec.deployment && res[roleSpec.deployment.empId]) {
        const dep = await prisma.deployment.create({
          data: {
            roleId:     role.id,
            resourceId: res[roleSpec.deployment.empId],
            allocation: roleSpec.deployment.allocation,
            startDate:  new Date(roleSpec.deployment.start),
            endDate:    new Date(roleSpec.deployment.end),
          },
        });

        // Actuals for this deployment
        const depActuals = sow.actuals.filter(a => a.empId === roleSpec.deployment.empId && a.roleTitle === roleSpec.title);
        for (const act of depActuals) {
          await prisma.actual.upsert({
            where:  { deploymentId_month: { deploymentId: dep.id, month: act.month } },
            update: { actualHours: act.hours },
            create: { deploymentId: dep.id, month: act.month, actualHours: act.hours },
          });
        }
      }
    }
    console.log(`  ✓ SOW ${sow.key} — ${sow.data.client}`);
  }
  console.log('✓ SOWs');

  console.log('\n✅ Seed complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
