// api/src/routes/projects.js — updated to support pmResourceId
const router = require('express').Router();
const prisma  = require('../lib/prisma');

const PROJECT_INCLUDE = {
  dm:         { select: { id:true, name:true } },
  am:         { select: { id:true, name:true } },
  pm:         { select: { id:true, name:true } },         // pmUserId → User (legacy)
  pmResource: { select: { id:true, name:true,             // pmResourceId → Resource (new)
    primarySkill: { select: { name:true } } } },
  roles: {
    include: {
      deployments: {
        include: {
          resource: { select: { id:true, name:true, status:true,
            primarySkill: { select: { name:true } } } },
          actuals: { orderBy: { month: 'desc' } },
        },
        orderBy: { startDate: 'asc' },
      },
    },
    orderBy: { planStart: 'asc' },
  },
  milestones: { orderBy: { plannedDate: 'asc' } },
  addendums:  { select: { id:true, name:true, status:true, totalValue:true } },
  parent:     { select: { id:true, name:true } },
};

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, client, dmUserId, amUserId } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (client)   where.client   = { contains: client, mode: 'insensitive' };
    if (dmUserId) where.dmUserId = dmUserId;
    if (amUserId) where.amUserId = amUserId;

    const projects = await prisma.project.findMany({
      where,
      include: {
        dm:         { select: { id:true, name:true } },
        am:         { select: { id:true, name:true } },
        pmResource: { select: { id:true, name:true } },
        roles: {
          include: {
            deployments: {
              where:   { endDate: { gte: new Date() } },
              include: { resource: { select: { id:true, name:true, status:true } } },
              take: 5,
            },
          },
        },
        milestones: { orderBy: { plannedDate: 'asc' } },
      },
      orderBy: [{ client: 'asc' }, { name: 'asc' }],
    });
    res.json(projects);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where:   { id: req.params.id },
      include: PROJECT_INCLUDE,
    });
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      client, name, sowNumber, sowType, currency,
      startDate, endDate, status, clientRef, clientContact,
      dmUserId, amUserId, pmUserId, pmResourceId,
      notes, totalValue, parentId,
    } = req.body;

    const project = await prisma.project.create({
      data: {
        client, name, sowType, currency: currency || 'USD',
        startDate:   new Date(startDate),
        endDate:     new Date(endDate),
        status:      status || 'DRAFT',
        sowNumber:   sowNumber   || null,
        clientRef:   clientRef   || null,
        clientContact: clientContact || null,
        dmUserId:    dmUserId    || null,
        amUserId:    amUserId    || null,
        pmUserId:    pmUserId    || null,
        pmResourceId: pmResourceId || null,
        notes:       notes       || null,
        totalValue:  totalValue  ? parseFloat(totalValue) : null,
        parentId:    parentId    || null,
      },
      include: PROJECT_INCLUDE,
    });
    res.status(201).json(project);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const {
      client, name, sowNumber, sowType, currency,
      startDate, endDate, status, clientRef, clientContact,
      dmUserId, amUserId, pmUserId, pmResourceId,
      notes, totalValue,
    } = req.body;

    const data = {};
    if (client       !== undefined) data.client       = client;
    if (name         !== undefined) data.name         = name;
    if (sowNumber    !== undefined) data.sowNumber     = sowNumber    || null;
    if (sowType      !== undefined) data.sowType       = sowType;
    if (currency     !== undefined) data.currency      = currency;
    if (startDate    !== undefined) data.startDate     = new Date(startDate);
    if (endDate      !== undefined) data.endDate       = new Date(endDate);
    if (status       !== undefined) data.status        = status;
    if (clientRef    !== undefined) data.clientRef     = clientRef    || null;
    if (clientContact !== undefined) data.clientContact = clientContact || null;
    if (dmUserId     !== undefined) data.dmUserId      = dmUserId     || null;
    if (amUserId     !== undefined) data.amUserId      = amUserId     || null;
    if (pmUserId     !== undefined) data.pmUserId      = pmUserId     || null;
    if (pmResourceId !== undefined) data.pmResourceId  = pmResourceId || null;
    if (notes        !== undefined) data.notes         = notes        || null;
    if (totalValue   !== undefined) data.totalValue    = totalValue ? parseFloat(totalValue) : null;

    const project = await prisma.project.update({
      where:   { id: req.params.id },
      data,
      include: PROJECT_INCLUDE,
    });
    res.json(project);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// ── STATUS CHANGE ─────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data:  { status },
      include: { dm: { select:{id:true,name:true} }, am: { select:{id:true,name:true} } },
    });
    res.json(project);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── ROLES ─────────────────────────────────────────────────────────────────────
router.post('/:id/roles', async (req, res) => {
  try {
    const { title, skillId, billRate, billingType, fixedAmount, planStart, planEnd } = req.body;
    const role = await prisma.role.create({
      data: {
        projectId:   req.params.id,
        title,
        skillId:     skillId     || null,
        billRate:    billRate    ? parseFloat(billRate)    : null,
        billingType: billingType || 'TM',
        fixedAmount: fixedAmount ? parseFloat(fixedAmount) : null,
        planStart:   new Date(planStart),
        planEnd:     new Date(planEnd),
      },
    });
    res.status(201).json(role);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/roles/:roleId', async (req, res) => {
  try {
    const { title, skillId, billRate, billingType, fixedAmount, planStart, planEnd } = req.body;
    const data = {};
    if (title       !== undefined) data.title       = title;
    if (skillId     !== undefined) data.skillId     = skillId     || null;
    if (billRate    !== undefined) data.billRate    = billRate    ? parseFloat(billRate)    : null;
    if (billingType !== undefined) data.billingType = billingType;
    if (fixedAmount !== undefined) data.fixedAmount = fixedAmount ? parseFloat(fixedAmount) : null;
    if (planStart   !== undefined) data.planStart   = new Date(planStart);
    if (planEnd     !== undefined) data.planEnd     = new Date(planEnd);
    const role = await prisma.role.update({ where: { id: req.params.roleId }, data });
    res.json(role);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/roles/:roleId', async (req, res) => {
  try {
    await prisma.role.update({
      where: { id: req.params.roleId },
      data:  { title: `[REMOVED] ${(await prisma.role.findUnique({where:{id:req.params.roleId}}))?.title}` },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── MILESTONES ────────────────────────────────────────────────────────────────
router.post('/:id/milestones', async (req, res) => {
  try {
    const { name, plannedDate, plannedAmount, actualDate, actualAmount, invoiceDate, paymentDate, status } = req.body;
    const ms = await prisma.milestone.create({
      data: {
        projectId:     req.params.id,
        name,
        plannedDate:   new Date(plannedDate),
        plannedAmount: parseFloat(plannedAmount),
        actualDate:    actualDate    ? new Date(actualDate)    : null,
        actualAmount:  actualAmount  ? parseFloat(actualAmount) : null,
        invoiceDate:   invoiceDate   ? new Date(invoiceDate)   : null,
        paymentDate:   paymentDate   ? new Date(paymentDate)   : null,
        status:        status        || 'UPCOMING',
      },
    });
    res.status(201).json(ms);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/milestones/:mid', async (req, res) => {
  try {
    const { name, plannedDate, plannedAmount, actualDate, actualAmount, invoiceDate, paymentDate, status } = req.body;
    const data = {};
    if (name          !== undefined) data.name          = name;
    if (plannedDate   !== undefined) data.plannedDate   = new Date(plannedDate);
    if (plannedAmount !== undefined) data.plannedAmount = parseFloat(plannedAmount);
    if (actualDate    !== undefined) data.actualDate    = actualDate    ? new Date(actualDate)    : null;
    if (actualAmount  !== undefined) data.actualAmount  = actualAmount  ? parseFloat(actualAmount) : null;
    if (invoiceDate   !== undefined) data.invoiceDate   = invoiceDate   ? new Date(invoiceDate)   : null;
    if (paymentDate   !== undefined) data.paymentDate   = paymentDate   ? new Date(paymentDate)   : null;
    if (status        !== undefined) data.status        = status;
    const ms = await prisma.milestone.update({ where: { id: req.params.mid }, data });
    res.json(ms);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/milestones/:mid', async (req, res) => {
  try {
    await prisma.milestone.update({
      where: { id: req.params.mid },
      data:  { status: 'REMOVED' },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
