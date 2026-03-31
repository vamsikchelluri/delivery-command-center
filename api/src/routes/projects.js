// api/src/routes/projects.js
const router = require('express').Router();
const prisma  = require('../lib/prisma');

// Build include - try to include pm/dm/am if columns exist
const PROJECT_INCLUDE = {
  roles: {
    include: {
      deployments: {
        include: {
          resource: { select: { id:true, name:true, empId:true, primarySkillId:true, primarySkill:true } },
          actuals: true,
        },
      },
    },
  },
  milestones: { orderBy: { plannedDate: 'asc' } },
  addendums:  { select: { id:true, name:true, sowNumber:true, status:true } },
  parent:     { select: { id:true, name:true, sowNumber:true } },
};

// Safely try to include pm/dm/am — these columns may not exist yet
async function getProjectInclude() {
  try {
    // Test if pmUserId column exists
    await prisma.$queryRaw`SELECT "pmUserId" FROM "Project" LIMIT 1`;
    return {
      ...PROJECT_INCLUDE,
      pm: { select: { id:true, name:true, email:true } },
      dm: { select: { id:true, name:true, email:true } },
      am: { select: { id:true, name:true, email:true } },
    };
  } catch {
    return PROJECT_INCLUDE;
  }
}

// ── PROJECTS ──────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { status, client } = req.query;
  const include = await getProjectInclude();
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(client ? { client: { contains: client, mode: 'insensitive' } } : {}),
      parentId: null,
    },
    include,
    orderBy: { startDate: 'desc' },
  });
  res.json(projects);
});

router.get('/:id', async (req, res) => {
  const include = await getProjectInclude();
  const p = await prisma.project.findUniqueOrThrow({ where: { id: req.params.id }, include });
  res.json(p);
});

router.post('/', async (req, res) => {
  const d = req.body;
  const include = await getProjectInclude();
  const hasPmCol = 'pm' in include;

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
      ...(hasPmCol && {
        pmUserId: d.pmUserId || null,
        dmUserId: d.dmUserId || null,
        amUserId: d.amUserId || null,
      }),
      totalValue:    d.totalValue    ? parseFloat(d.totalValue) : null,
      parentId:      d.parentId      || null,
      notes:         d.notes         || null,
    },
    include,
  });
  res.status(201).json(project);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const include = await getProjectInclude();
  const hasPmCol = 'pm' in include;

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(d.client        != null && { client:        d.client }),
      ...(d.name          != null && { name:          d.name }),
      ...(d.sowNumber     !== undefined && { sowNumber:     d.sowNumber || null }),
      ...(d.sowType       != null && { sowType:       d.sowType }),
      ...(d.currency      != null && { currency:      d.currency }),
      ...(d.status        != null && { status:        d.status }),
      ...(d.startDate     != null && { startDate:     new Date(d.startDate) }),
      ...(d.endDate       != null && { endDate:       new Date(d.endDate) }),
      ...(d.clientRef     !== undefined && { clientRef:     d.clientRef     || null }),
      ...(d.clientContact !== undefined && { clientContact: d.clientContact || null }),
      ...(hasPmCol && d.pmUserId !== undefined && { pmUserId: d.pmUserId || null }),
      ...(hasPmCol && d.dmUserId !== undefined && { dmUserId: d.dmUserId || null }),
      ...(hasPmCol && d.amUserId !== undefined && { amUserId: d.amUserId || null }),
      ...(d.totalValue    !== undefined && { totalValue: d.totalValue ? parseFloat(d.totalValue) : null }),
      ...(d.notes         !== undefined && { notes:      d.notes || null }),
    },
    include,
  });
  res.json(project);
});

router.delete('/:id', async (req, res) => {
  await prisma.project.update({ where: { id: req.params.id }, data: { status: 'TERMINATED' } });
  res.json({ ok: true });
});

// ── ROLES ─────────────────────────────────────────────────────────────────────

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
      ...(d.title       != null && { title:       d.title }),
      ...(d.skillId     !== undefined && { skillId:     d.skillId || null }),
      ...(d.billRate    !== undefined && { billRate:    d.billRate ? parseFloat(d.billRate) : null }),
      ...(d.billingType != null && { billingType: d.billingType }),
      ...(d.fixedAmount !== undefined && { fixedAmount: d.fixedAmount ? parseFloat(d.fixedAmount) : null }),
      ...(d.planStart   != null && { planStart:   new Date(d.planStart) }),
      ...(d.planEnd     != null && { planEnd:     new Date(d.planEnd) }),
    },
    include: { deployments: { include: { resource: true, actuals: true } } },
  });
  res.json(role);
});

router.delete('/roles/:roleId', async (req, res) => {
  await prisma.role.delete({ where: { id: req.params.roleId } });
  res.json({ ok: true });
});

// ── MILESTONES ────────────────────────────────────────────────────────────────

router.post('/:id/milestones', async (req, res) => {
  const d = req.body;
  const m = await prisma.milestone.create({
    data: {
      projectId:     req.params.id,
      name:          d.name,
      plannedDate:   new Date(d.plannedDate),
      plannedAmount: parseFloat(d.plannedAmount),
      status:        d.status || 'UPCOMING',
    },
  });
  res.status(201).json(m);
});

router.patch('/milestones/:mid', async (req, res) => {
  const d = req.body;
  const m = await prisma.milestone.update({
    where: { id: req.params.mid },
    data: {
      ...(d.name          != null && { name:          d.name }),
      ...(d.plannedDate   != null && { plannedDate:   new Date(d.plannedDate) }),
      ...(d.plannedAmount != null && { plannedAmount: parseFloat(d.plannedAmount) }),
      ...(d.actualDate    != null && { actualDate:    new Date(d.actualDate) }),
      ...(d.actualAmount  !== undefined && { actualAmount: d.actualAmount ? parseFloat(d.actualAmount) : null }),
      ...(d.invoiceDate   != null && { invoiceDate:   new Date(d.invoiceDate) }),
      ...(d.paymentDate   != null && { paymentDate:   new Date(d.paymentDate) }),
      ...(d.status        != null && { status:        d.status }),
    },
  });
  res.json(m);
});

router.delete('/milestones/:mid', async (req, res) => {
  await prisma.milestone.delete({ where: { id: req.params.mid } });
  res.json({ ok: true });
});

module.exports = router;
