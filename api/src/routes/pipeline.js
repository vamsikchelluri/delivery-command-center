// api/src/routes/pipeline.js
const router = require('express').Router();
const prisma  = require('../lib/prisma');

const OPP_INCLUDE = {
  roles:   true,
  project: { select: { id:true, name:true, sowNumber:true } },
};

// ── OPPORTUNITIES ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { stage } = req.query;
  const opps = await prisma.opportunity.findMany({
    where:   stage ? { stage } : {},
    include: OPP_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(opps);
});

router.get('/:id', async (req, res) => {
  const opp = await prisma.opportunity.findUniqueOrThrow({
    where:   { id: req.params.id },
    include: OPP_INCLUDE,
  });
  res.json(opp);
});

router.post('/', async (req, res) => {
  const d = req.body;
  const opp = await prisma.opportunity.create({
    data: {
      client:           d.client,
      name:             d.name,
      stage:            d.stage            || 'QUALIFYING',
      probability:      d.probability      ?? 20,
      source:           d.source           || null,
      accountManagerId: d.accountManagerId || null,
      startDate:        d.startDate        ? new Date(d.startDate) : null,
      endDate:          d.endDate          ? new Date(d.endDate)   : null,
      targetMargin:     d.targetMargin     ? parseFloat(d.targetMargin) : 30,
      currency:         d.currency         || 'USD',
      notes:            d.notes            || null,
    },
    include: OPP_INCLUDE,
  });
  res.status(201).json(opp);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const opp = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: {
      ...(d.client           != null && { client:           d.client }),
      ...(d.name             != null && { name:             d.name }),
      ...(d.stage            != null && { stage:            d.stage }),
      ...(d.probability      != null && { probability:      parseInt(d.probability) }),
      ...(d.source           !== undefined && { source:           d.source || null }),
      ...(d.accountManagerId !== undefined && { accountManagerId: d.accountManagerId || null }),
      ...(d.startDate        != null && { startDate:        new Date(d.startDate) }),
      ...(d.endDate          != null && { endDate:          new Date(d.endDate) }),
      ...(d.targetMargin     != null && { targetMargin:     parseFloat(d.targetMargin) }),
      ...(d.currency         != null && { currency:         d.currency }),
      ...(d.notes            !== undefined && { notes:            d.notes || null }),
    },
    include: OPP_INCLUDE,
  });
  res.json(opp);
});

router.delete('/:id', async (req, res) => {
  // Soft delete — mark as LOST instead of destroying data
  const opp = await prisma.opportunity.update({
    where: { id: req.params.id },
    data:  { stage: 'LOST' },
  });
  res.json(opp);
});

// ── OPP ROLES ─────────────────────────────────────────────────────────────────

router.post('/:id/roles', async (req, res) => {
  const d = req.body;
  const role = await prisma.oppRole.create({
    data: {
      opportunityId:   req.params.id,
      title:           d.title,
      location:        d.location        || 'OFFSHORE',
      ftPt:            d.ftPt            || 'FT',
      experienceLevel: d.experienceLevel || null,
      yearsExp:        d.yearsExp        ? parseInt(d.yearsExp) : null,
      totalHours:      d.totalHours      ? parseFloat(d.totalHours) : null,
      billRate:        d.billRate        ? parseFloat(d.billRate) : null,
      costGuidance:    d.costGuidance    ? parseFloat(d.costGuidance) : null,
      costOverride:    d.costOverride    || false,
      status:          d.status          || 'OPEN',
      resourceId:      d.resourceId      || null,
      resourceName:    d.resourceName    || null,
      notes:           d.notes           || null,
    },
  });
  res.status(201).json(role);
});

router.patch('/roles/:roleId', async (req, res) => {
  const d = req.body;
  const role = await prisma.oppRole.update({
    where: { id: req.params.roleId },
    data: {
      ...(d.title           != null && { title:           d.title }),
      ...(d.location        != null && { location:        d.location }),
      ...(d.ftPt            != null && { ftPt:            d.ftPt }),
      ...(d.experienceLevel !== undefined && { experienceLevel: d.experienceLevel || null }),
      ...(d.yearsExp        !== undefined && { yearsExp:        d.yearsExp ? parseInt(d.yearsExp) : null }),
      ...(d.totalHours      !== undefined && { totalHours:      d.totalHours ? parseFloat(d.totalHours) : null }),
      ...(d.billRate        !== undefined && { billRate:        d.billRate ? parseFloat(d.billRate) : null }),
      ...(d.costGuidance    !== undefined && { costGuidance:    d.costGuidance ? parseFloat(d.costGuidance) : null }),
      ...(d.costOverride    !== undefined && { costOverride:    d.costOverride }),
      ...(d.status          != null && { status:          d.status }),
      ...(d.resourceId      !== undefined && { resourceId:      d.resourceId || null }),
      ...(d.resourceName    !== undefined && { resourceName:    d.resourceName || null }),
      ...(d.notes           !== undefined && { notes:           d.notes || null }),
    },
  });
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

  if (opp.project) {
    return res.status(400).json({ error: 'Already converted to SOW' });
  }

  // Create project from opportunity
  const project = await prisma.project.create({
    data: {
      client:       opp.client,
      name:         opp.name,
      sowType:      'TM',
      currency:     opp.currency || 'USD',
      startDate:    opp.startDate || new Date(),
      endDate:      opp.endDate   || new Date(Date.now() + 365 * 86400000),
      status:       'DRAFT',
      opportunityId: opp.id,
      notes:        opp.notes || null,
      // Create roles from opp roles
      roles: opp.roles.length ? {
        create: opp.roles.map(r => ({
          title:       r.title,
          billRate:    r.billRate   || null,
          billingType: 'TM',
          planStart:   opp.startDate || new Date(),
          planEnd:     opp.endDate   || new Date(Date.now() + 365 * 86400000),
        })),
      } : undefined,
    },
  });

  // Mark opportunity as converted
  await prisma.opportunity.update({
    where: { id: opp.id },
    data:  { convertedAt: new Date(), stage: 'WON' },
  });

  res.json(project);
});

module.exports = router;
