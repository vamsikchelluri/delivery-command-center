// api/src/routes/resources.js
const router  = require('express').Router();
const prisma  = require('../lib/prisma');
const { computeCostRate } = require('../lib/costEngine');

const RESOURCE_INCLUDE = {
  primarySkill:    true,
  secondarySkills: { include: { skill: true } },
  costHistory:     { orderBy: { effectiveFrom: 'asc' } },
  deployments: {
    include: {
      role: { include: { project: { select: { id: true, client: true, name: true } } } },
    },
    orderBy: { startDate: 'desc' },
  },
};

// GET /api/resources — list with filters
router.get('/', async (req, res) => {
  const { location, employmentType, status, search, skillId } = req.query;

  const where = {
    AND: [
      location       ? { location }                                                  : {},
      employmentType ? { employmentType }                                            : {},
      status         ? { status }                                                    : {},
      skillId        ? { primarySkillId: skillId }                                  : {},
      search ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' } },
          { empId: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      } : {},
    ],
  };

  const resources = await prisma.resource.findMany({
    where,
    include: RESOURCE_INCLUDE,
    orderBy: { name: 'asc' },
  });

  // Attach computed cost rate to each resource
  const withRates = resources.map(r => attachComputedRate(r));
  res.json(withRates);
});

// GET /api/resources/:id
router.get('/:id', async (req, res) => {
  const r = await prisma.resource.findUniqueOrThrow({
    where: { id: req.params.id },
    include: RESOURCE_INCLUDE,
  });
  res.json(attachComputedRate(r));
});

// POST /api/resources
router.post('/', async (req, res) => {
  const data    = req.body;
  const today   = new Date().toISOString().split('T')[0];
  const fxRate  = await getCurrentFX();
  const cfg     = await getSystemConfig();

  const rate = computeCostRate({
    location:      data.location,
    empType:       data.employmentType,
    inputValue:    data.costInput,
    inputCurrency: data.rateCurrency || 'INR',
    fxRate,
    hrsYear:  cfg.STANDARD_HOURS_YEAR,
    overhead: cfg.OVERHEAD_MULTIPLIER,
  });

  const startDate = data.joiningDate || data.contractStart || today;

  const resource = await prisma.resource.create({
    data: {
      name:           data.name,
      empId:          data.empId          || null,
      email:          data.email          || null,
      phone:          data.phone          || null,
      location:       data.location,
      employmentType: data.employmentType,
      joiningDate:    data.joiningDate    ? new Date(data.joiningDate)    : null,
      contractStart:  data.contractStart  ? new Date(data.contractStart)  : null,
      contractEnd:    data.contractEnd    ? new Date(data.contractEnd)    : null,
      rolloffDate:    data.rolloffDate    ? new Date(data.rolloffDate)    : null,
      noticePeriod:   data.noticePeriod   ? parseInt(data.noticePeriod)  : null,
      visaType:       data.visaType       || null,
      visaExpiry:     data.visaExpiry     ? new Date(data.visaExpiry)     : null,
      bgCheckStatus:  data.bgCheckStatus  || 'NOT_REQUIRED',
      primarySkillId: data.primarySkillId,
      primarySubmods: data.primarySubmods || [],
      costInput:      parseFloat(data.costInput),
      rateCurrency:   data.rateCurrency   || 'INR',
      paymentTerms:   data.paymentTerms   || 'Monthly Payroll',
      payCurrency:    data.payCurrency    || 'INR',
      status:         'AVAILABLE',
      costHistory: {
        create: [{
          effectiveFrom: new Date(startDate),
          effectiveTo:   null,
          inputValue:    parseFloat(data.costInput),
          inputCurrency: data.rateCurrency || 'INR',
          fxSnapshot:    fxRate,
          computedUSDhr: rate.usd,
          reason:        'Joining',
        }],
      },
      secondarySkills: data.secondarySkills?.length ? {
        create: data.secondarySkills.map(ss => ({
          skillId: ss.skillId,
          submods: ss.submods || [],
        })),
      } : undefined,
    },
    include: RESOURCE_INCLUDE,
  });

  res.status(201).json(attachComputedRate(resource));
});

// PATCH /api/resources/:id
router.patch('/:id', async (req, res) => {
  const data   = req.body;
  const id     = req.params.id;
  const today  = new Date().toISOString().split('T')[0];
  const fxRate = await getCurrentFX();
  const cfg    = await getSystemConfig();

  const existing = await prisma.resource.findUniqueOrThrow({
    where: { id },
    include: { costHistory: true, secondarySkills: true },
  });

  // Cost rate changed — close old history, open new one
  const costChanged =
    parseFloat(data.costInput) !== existing.costInput ||
    data.rateCurrency !== existing.rateCurrency;

  if (costChanged) {
    const rate = computeCostRate({
      location:      data.location      || existing.location,
      empType:       data.employmentType || existing.employmentType,
      inputValue:    parseFloat(data.costInput),
      inputCurrency: data.rateCurrency  || existing.rateCurrency,
      fxRate,
      hrsYear:  cfg.STANDARD_HOURS_YEAR,
      overhead: cfg.OVERHEAD_MULTIPLIER,
    });

    // Close current active record
    await prisma.costHistory.updateMany({
      where: { resourceId: id, effectiveTo: null },
      data:  { effectiveTo: new Date(today) },
    });

    // Create new record
    await prisma.costHistory.create({
      data: {
        resourceId:    id,
        effectiveFrom: new Date(today),
        effectiveTo:   null,
        inputValue:    parseFloat(data.costInput),
        inputCurrency: data.rateCurrency || existing.rateCurrency,
        fxSnapshot:    fxRate,
        computedUSDhr: rate.usd,
        reason:        data.costChangeReason || 'Correction',
      },
    });
  }

  // Update secondary skills — replace all
  if (data.secondarySkills !== undefined) {
    await prisma.resourceSkill.deleteMany({ where: { resourceId: id } });
    if (data.secondarySkills?.length) {
      await prisma.resourceSkill.createMany({
        data: data.secondarySkills.map(ss => ({ resourceId: id, skillId: ss.skillId, submods: ss.submods || [] })),
      });
    }
  }

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      name:           data.name           ?? undefined,
      empId:          data.empId          ?? undefined,
      email:          data.email          ?? undefined,
      phone:          data.phone          ?? undefined,
      location:       data.location       ?? undefined,
      employmentType: data.employmentType ?? undefined,
      joiningDate:    data.joiningDate    !== undefined ? (data.joiningDate   ? new Date(data.joiningDate)   : null) : undefined,
      contractStart:  data.contractStart  !== undefined ? (data.contractStart ? new Date(data.contractStart) : null) : undefined,
      contractEnd:    data.contractEnd    !== undefined ? (data.contractEnd   ? new Date(data.contractEnd)   : null) : undefined,
      rolloffDate:    data.rolloffDate    !== undefined ? (data.rolloffDate   ? new Date(data.rolloffDate)   : null) : undefined,
      noticePeriod:   data.noticePeriod   !== undefined ? (data.noticePeriod  ? parseInt(data.noticePeriod) : null) : undefined,
      visaType:       data.visaType       ?? undefined,
      visaExpiry:     data.visaExpiry     !== undefined ? (data.visaExpiry    ? new Date(data.visaExpiry)    : null) : undefined,
      bgCheckStatus:  data.bgCheckStatus  ?? undefined,
      primarySkillId: data.primarySkillId ?? undefined,
      primarySubmods: data.primarySubmods ?? undefined,
      costInput:      data.costInput      !== undefined ? parseFloat(data.costInput) : undefined,
      rateCurrency:   data.rateCurrency   ?? undefined,
      paymentTerms:   data.paymentTerms   ?? undefined,
      payCurrency:    data.payCurrency    ?? undefined,
    },
    include: RESOURCE_INCLUDE,
  });

  res.json(attachComputedRate(updated));
});

// PATCH /api/resources/:id/status — update computed status
router.patch('/:id/status', async (req, res) => {
  const { status, benchSince } = req.body;
  const updated = await prisma.resource.update({
    where: { id: req.params.id },
    data: {
      status,
      benchSince: benchSince ? new Date(benchSince) : undefined,
    },
  });
  res.json(updated);
});

// DELETE /api/resources/:id
router.delete('/:id', async (req, res) => {
  await prisma.resource.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── HELPERS ──
async function getCurrentFX() {
  const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
  return inr?.rateVsUSD || 88;
}

async function getSystemConfig() {
  const configs = await prisma.systemConfig.findMany();
  return Object.fromEntries(configs.map(c => [c.key, parseFloat(c.value)]));
}

function attachComputedRate(r) {
  // Find current active cost history record
  const current = r.costHistory
    ?.filter(h => !h.effectiveTo)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0];

  return {
    ...r,
    computedRate: current ? {
      usd: current.computedUSDhr,
      inr: r.location === 'OFFSHORE' ? null : null, // computed on frontend from usd * fxRate
    } : null,
    currentCostRecord: current || null,
  };
}

module.exports = router;
