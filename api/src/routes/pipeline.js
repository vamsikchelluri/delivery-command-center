// routes/pipeline.js — Opportunities + OppRoles CRUD
const { Router } = require('express');
const prisma = require('../lib/prisma');
const router = Router();

const oppInclude = {
  roles: { orderBy: { sortOrder: 'asc' } },
};

// GET /api/pipeline
router.get('/', async (req, res) => {
  try {
    const { stage, client } = req.query;
    const where = {};
    if (stage)  where.stage  = stage;
    if (client) where.client = { contains: client, mode: 'insensitive' };
    const opps = await prisma.opportunity.findMany({
      where,
      include: oppInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(opps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/pipeline/:id
router.get('/:id', async (req, res) => {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      include: oppInclude,
    });
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pipeline
router.post('/', async (req, res) => {
  try {
    const {
      client, name, source, accountManagerId,
      stage, probability, startDate, endDate,
      targetMargin, currency, notes,
    } = req.body;
    if (!client || !name) return res.status(400).json({ error: 'client and name required' });

    // Default probability by stage
    const probMap = { QUALIFYING: 20, PROPOSED: 40, NEGOTIATING: 70, WON: 100, LOST: 0 };
    const prob = probability != null ? parseInt(probability) : (probMap[stage] || 20);

    const opp = await prisma.opportunity.create({
      data: {
        client, name,
        source:          source          || 'EXISTING_ACCOUNT',
        accountManagerId: accountManagerId || null,
        stage:           stage           || 'QUALIFYING',
        probability:     prob,
        startDate:       startDate ? new Date(startDate) : null,
        endDate:         endDate   ? new Date(endDate)   : null,
        targetMargin:    parseFloat(targetMargin) || 35,
        currency:        currency        || 'USD',
        notes:           notes           || null,
      },
      include: oppInclude,
    });
    res.json(opp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/pipeline/:id
router.patch('/:id', async (req, res) => {
  try {
    const {
      client, name, source, accountManagerId,
      stage, probability, startDate, endDate,
      targetMargin, currency, notes, convertedAt,
    } = req.body;

    const data = {};
    if (client           != null) data.client           = client;
    if (name             != null) data.name             = name;
    if (source           != null) data.source           = source;
    if (accountManagerId != null) data.accountManagerId = accountManagerId;
    if (stage            != null) data.stage            = stage;
    if (probability      != null) data.probability      = parseInt(probability);
    if (startDate        != null) data.startDate        = startDate ? new Date(startDate) : null;
    if (endDate          != null) data.endDate          = endDate   ? new Date(endDate)   : null;
    if (targetMargin     != null) data.targetMargin     = parseFloat(targetMargin);
    if (currency         != null) data.currency         = currency;
    if (notes            != null) data.notes            = notes;
    if (convertedAt      != null) data.convertedAt      = new Date(convertedAt);

    const opp = await prisma.opportunity.update({
      where: { id: req.params.id },
      data,
      include: oppInclude,
    });
    res.json(opp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/pipeline/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.opportunity.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── OppRole CRUD ──────────────────────────────────────────

// POST /api/pipeline/:id/roles
router.post('/:id/roles', async (req, res) => {
  try {
    const {
      title, location, ftPt, experienceLevel, yearsExp,
      totalHours, billRate, costGuidance, costOverride,
      status, resourceName, resourceId, notes, sortOrder,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const role = await prisma.oppRole.create({
      data: {
        opportunityId:   req.params.id,
        title,
        location:        location        || 'OFFSHORE',
        ftPt:            ftPt            || 'Full-Time',
        experienceLevel: experienceLevel || 'MEDIUM',
        yearsExp:        yearsExp        || null,
        totalHours:      totalHours      ? parseFloat(totalHours) : null,
        billRate:        billRate        ? parseFloat(billRate)   : null,
        costGuidance:    costGuidance    ? parseFloat(costGuidance) : null,
        costOverride:    !!costOverride,
        status:          status          || 'OPEN',
        resourceName:    resourceName    || null,
        resourceId:      resourceId      || null,
        notes:           notes           || null,
        sortOrder:       parseInt(sortOrder) || 0,
      },
    });
    res.json(role);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/pipeline/roles/:roleId
router.patch('/roles/:roleId', async (req, res) => {
  try {
    const fields = [
      'title','location','ftPt','experienceLevel','yearsExp',
      'totalHours','billRate','costGuidance','costOverride',
      'status','resourceName','resourceId','notes','sortOrder',
    ];
    const data = {};
    for (const f of fields) {
      if (req.body[f] != null) {
        if (['totalHours','billRate','costGuidance','sortOrder'].includes(f)) data[f] = parseFloat(req.body[f]);
        else if (f === 'costOverride') data[f] = !!req.body[f];
        else data[f] = req.body[f];
      }
    }
    const role = await prisma.oppRole.update({ where: { id: req.params.roleId }, data });
    res.json(role);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/pipeline/roles/:roleId
router.delete('/roles/:roleId', async (req, res) => {
  try {
    await prisma.oppRole.delete({ where: { id: req.params.roleId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pipeline/:id/convert  — convert WON opportunity to SOW
router.post('/:id/convert', async (req, res) => {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      include: { roles: true },
    });
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    if (opp.stage !== 'WON') return res.status(400).json({ error: 'Opportunity must be WON to convert' });
    if (opp.project) return res.status(400).json({ error: 'Already converted' });

    // Build project with roles pre-filled
    const project = await prisma.project.create({
      data: {
        client:       opp.client,
        name:         opp.name,
        sowType:      'TM',
        currency:     opp.currency,
        startDate:    opp.startDate || new Date(),
        endDate:      opp.endDate   || new Date(Date.now() + 90 * 86400000),
        status:       'DRAFT',
        amUserId:     opp.accountManagerId || null,
        notes:        opp.notes,
        opportunityId: opp.id,
        roles: {
          create: opp.roles.map(r => ({
            title:     r.title,
            billRate:  r.billRate   || null,
            planStart: opp.startDate || new Date(),
            planEnd:   opp.endDate   || new Date(Date.now() + 90 * 86400000),
          })),
        },
      },
      include: { roles: true },
    });

    // Mark opportunity as converted
    await prisma.opportunity.update({
      where: { id: opp.id },
      data:  { convertedAt: new Date() },
    });

    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
