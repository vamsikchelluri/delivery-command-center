// api/src/routes/pipeline.js
const router = require('express').Router();
const prisma  = require('../lib/prisma');

// DB PipelineStage enum: DISCOVERY | QUALIFIED | PROPOSAL | NEGOTIATION | WON | LOST
const STAGE_MAP = {
  QUALIFYING:  'DISCOVERY',
  PROPOSED:    'PROPOSAL',
  NEGOTIATING: 'NEGOTIATION',
  WON:         'WON',
  LOST:        'LOST',
  DISCOVERY:   'DISCOVERY',
  QUALIFIED:   'QUALIFIED',
  PROPOSAL:    'PROPOSAL',
  NEGOTIATION: 'NEGOTIATION',
};
function toDBStage(s) { return STAGE_MAP[s] || 'DISCOVERY'; }

// Check which optional columns exist
let _hasNewCols = null;
async function hasNewCols() {
  if (_hasNewCols !== null) return _hasNewCols;
  try {
    await prisma.$queryRaw`SELECT "source" FROM "Opportunity" LIMIT 1`;
    _hasNewCols = true;
  } catch { _hasNewCols = false; }
  return _hasNewCols;
}

const BASE_INCLUDE = {
  roles:   true,
  project: { select: { id:true, name:true, sowNumber:true } },
};

router.get('/', async (req, res) => {
  const { stage } = req.query;
  const opps = await prisma.opportunity.findMany({
    where:   stage ? { stage: toDBStage(stage) } : {},
    include: BASE_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(opps);
});

router.get('/:id', async (req, res) => {
  const opp = await prisma.opportunity.findUniqueOrThrow({
    where:   { id: req.params.id },
    include: BASE_INCLUDE,
  });
  res.json(opp);
});

router.post('/', async (req, res) => {
  const d = req.body;
  const newCols = await hasNewCols();

  const data = {
    client:      d.client,
    name:        d.name,
    stage:       toDBStage(d.stage || 'DISCOVERY'),
    probability: d.probability != null ? parseInt(d.probability) : 20,
    notes:       d.notes || null,
    ...(newCols && {
      source:           d.source           || null,
      accountManagerId: d.accountManagerId || null,
      startDate:        d.startDate        ? new Date(d.startDate) : null,
      endDate:          d.endDate          ? new Date(d.endDate)   : null,
      targetMargin:     d.targetMargin     != null ? parseFloat(d.targetMargin) : 30,
      currency:         d.currency         || 'USD',
    }),
  };

  const opp = await prisma.opportunity.create({ data, include: BASE_INCLUDE });
  res.status(201).json(opp);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const newCols = await hasNewCols();

  const data = {
    ...(d.client      != null && { client:      d.client }),
    ...(d.name        != null && { name:        d.name }),
    ...(d.stage       != null && { stage:       toDBStage(d.stage) }),
    ...(d.probability != null && { probability: parseInt(d.probability) }),
    ...(d.notes       !== undefined && { notes: d.notes || null }),
    ...(newCols && d.source           !== undefined && { source:           d.source || null }),
    ...(newCols && d.accountManagerId !== undefined && { accountManagerId: d.accountManagerId || null }),
    ...(newCols && d.startDate        != null && { startDate:   new Date(d.startDate) }),
    ...(newCols && d.endDate          != null && { endDate:     new Date(d.endDate) }),
    ...(newCols && d.targetMargin     != null && { targetMargin: parseFloat(d.targetMargin) }),
    ...(newCols && d.currency         != null && { currency:    d.currency }),
  };

  const opp = await prisma.opportunity.update({
    where: { id: req.params.id },
    data,
    include: BASE_INCLUDE,
  });
  res.json(opp);
});

router.delete('/:id', async (req, res) => {
  await prisma.opportunity.update({ where: { id: req.params.id }, data: { stage: 'LOST' } });
  res.json({ ok: true });
});

// ── OPP ROLES ─────────────────────────────────────────────────────────────────

router.post('/:id/roles', async (req, res) => {
  const d = req.body;
  const newCols = await hasNewCols();

  const data = {
    opportunityId: req.params.id,
    title:         d.title,
    billRate:      d.billRate ? parseFloat(d.billRate) : null,
    ...(newCols && {
      location:        d.location        || 'OFFSHORE',
      ftPt:            d.ftPt            || 'FT',
      experienceLevel: d.experienceLevel || null,
      yearsExp:        d.yearsExp        ? parseInt(d.yearsExp) : null,
      totalHours:      d.totalHours      ? parseFloat(d.totalHours) : null,
      costGuidance:    d.costGuidance    ? parseFloat(d.costGuidance) : null,
      costOverride:    d.costOverride    || false,
      status:          d.status          || 'OPEN',
      resourceId:      d.resourceId      || null,
      resourceName:    d.resourceName    || null,
      notes:           d.notes           || null,
    }),
  };

  const role = await prisma.oppRole.create({ data });
  res.status(201).json(role);
});

router.patch('/roles/:roleId', async (req, res) => {
  const d = req.body;
  const newCols = await hasNewCols();

  const data = {
    ...(d.title    != null && { title:    d.title }),
    ...(d.billRate !== undefined && { billRate: d.billRate ? parseFloat(d.billRate) : null }),
    ...(newCols && d.status        != null && { status:        d.status }),
    ...(newCols && d.location      != null && { location:      d.location }),
    ...(newCols && d.totalHours    !== undefined && { totalHours: d.totalHours ? parseFloat(d.totalHours) : null }),
    ...(newCols && d.costGuidance  !== undefined && { costGuidance: d.costGuidance ? parseFloat(d.costGuidance) : null }),
    ...(newCols && d.resourceId    !== undefined && { resourceId: d.resourceId || null }),
    ...(newCols && d.notes         !== undefined && { notes: d.notes || null }),
  };

  const role = await prisma.oppRole.update({ where: { id: req.params.roleId }, data });
  res.json(role);
});

router.delete('/roles/:roleId', async (req, res) => {
  await prisma.oppRole.delete({ where: { id: req.params.roleId } });
  res.json({ ok: true });
});

// ── CONVERT TO SOW ────────────────────────────────────────────────────────────

router.post('/:id/convert', async (req, res) => {
  const opp = await prisma.opportunity.findUniqueOrThrow({
    where:   { id: req.params.id },
    include: { roles: true },
  });

  if (opp.project) return res.status(400).json({ error: 'Already converted to SOW' });

  const newCols = await hasNewCols();

  const project = await prisma.project.create({
    data: {
      client:        opp.client,
      name:          opp.name,
      sowType:       'TM',
      currency:      (newCols && opp.currency) || 'USD',
      startDate:     (newCols && opp.startDate) || new Date(),
      endDate:       (newCols && opp.endDate)   || new Date(Date.now() + 365 * 86400000),
      status:        'DRAFT',
      opportunityId: opp.id,
      notes:         opp.notes || null,
      roles: opp.roles.length ? {
        create: opp.roles.map(r => ({
          title:       r.title,
          billRate:    r.billRate || null,
          billingType: 'TM',
          planStart:   (newCols && opp.startDate) || new Date(),
          planEnd:     (newCols && opp.endDate)   || new Date(Date.now() + 365 * 86400000),
        })),
      } : undefined,
    },
  });

  if (newCols) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { convertedAt: new Date(), stage: 'WON' },
    });
  } else {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { stage: 'WON' },
    });
  }

  res.json(project);
});

module.exports = router;
