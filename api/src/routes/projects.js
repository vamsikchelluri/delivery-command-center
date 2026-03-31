// api/src/routes/projects.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

const PROJECT_INCLUDE = {
  roles: {
    include: {
      deployments: {
        include: {
          resource: { select: { id: true, name: true, empId: true, primarySkillId: true, primarySkill: true } },
          actuals: true,
        },
      },
    },
  },
  milestones: { orderBy: { plannedDate: 'asc' } },
  addendums:  { select: { id: true, name: true, sowNumber: true, status: true } },
  parent:     { select: { id: true, name: true, sowNumber: true } },
};

router.get('/', async (req, res) => {
  const { status, client } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(client ? { client: { contains: client, mode: 'insensitive' } } : {}),
      parentId: null, // top-level only; addendums come via parent
    },
    include: PROJECT_INCLUDE,
    orderBy: { startDate: 'desc' },
  });
  res.json(projects);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: req.params.id },
    include: PROJECT_INCLUDE,
  });
  res.json(p);
});

router.post('/', async (req, res) => {
  const d = req.body;
  const project = await prisma.project.create({
    data: {
      client:        d.client,
      name:          d.name,
      sowNumber:     d.sowNumber     || null,
      sowType:       d.sowType,
      currency:      d.currency      || 'USD',
      startDate:     new Date(d.startDate),
      endDate:       new Date(d.endDate),
      status:        d.status        || 'ACTIVE',
      clientRef:     d.clientRef     || null,
      clientContact: d.clientContact || null,
      totalValue:    d.totalValue    ? parseFloat(d.totalValue) : null,
      parentId:      d.parentId      || null,
      notes:         d.notes         || null,
    },
    include: PROJECT_INCLUDE,
  });
  res.status(201).json(project);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(d.client        && { client: d.client }),
      ...(d.name          && { name: d.name }),
      ...(d.sowNumber     !== undefined && { sowNumber: d.sowNumber }),
      ...(d.status        && { status: d.status }),
      ...(d.startDate     && { startDate: new Date(d.startDate) }),
      ...(d.endDate       && { endDate:   new Date(d.endDate) }),
      ...(d.totalValue    !== undefined && { totalValue: d.totalValue ? parseFloat(d.totalValue) : null }),
      ...(d.notes         !== undefined && { notes: d.notes }),
    },
    include: PROJECT_INCLUDE,
  });
  res.json(project);
});

router.delete('/:id', async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── ROLES ──
router.post('/:id/roles', async (req, res) => {
  const d = req.body;
  const role = await prisma.role.create({
    data: {
      projectId:   req.params.id,
      title:       d.title,
      skillId:     d.skillId    || null,
      billRate:    d.billRate   ? parseFloat(d.billRate)   : null,
      billingType: d.billingType || 'TM',
      fixedAmount: d.fixedAmount ? parseFloat(d.fixedAmount) : null,
      planStart:   new Date(d.planStart),
      planEnd:     new Date(d.planEnd),
    },
    include: { deployments: { include: { resource: true, actuals: true } } },
  });
  res.status(201).json(role);
});

router.patch('/roles/:roleId', async (req, res) => {
  const d = req.body;
  const role = await prisma.role.update({
    where: { id: req.params.roleId },
    data: {
      ...(d.title       && { title: d.title }),
      ...(d.billRate    !== undefined && { billRate: d.billRate ? parseFloat(d.billRate) : null }),
      ...(d.billingType && { billingType: d.billingType }),
      ...(d.fixedAmount !== undefined && { fixedAmount: d.fixedAmount ? parseFloat(d.fixedAmount) : null }),
      ...(d.planStart   && { planStart: new Date(d.planStart) }),
      ...(d.planEnd     && { planEnd:   new Date(d.planEnd) }),
    },
  });
  res.json(role);
});

// ── MILESTONES ──
router.post('/:id/milestones', async (req, res) => {
  const d = req.body;
  const m = await prisma.milestone.create({
    data: {
      projectId:     req.params.id,
      name:          d.name,
      plannedDate:   new Date(d.plannedDate),
      plannedAmount: parseFloat(d.plannedAmount),
      status:        'UPCOMING',
    },
  });
  res.status(201).json(m);
});

router.patch('/milestones/:mid', async (req, res) => {
  const d = req.body;
  const m = await prisma.milestone.update({
    where: { id: req.params.mid },
    data: {
      ...(d.name          && { name: d.name }),
      ...(d.actualDate    && { actualDate:    new Date(d.actualDate) }),
      ...(d.actualAmount  !== undefined && { actualAmount:  d.actualAmount ? parseFloat(d.actualAmount) : null }),
      ...(d.invoiceDate   && { invoiceDate:   new Date(d.invoiceDate) }),
      ...(d.paymentDate   && { paymentDate:   new Date(d.paymentDate) }),
      ...(d.status        && { status: d.status }),
    },
  });
  res.json(m);
});

module.exports = router;
