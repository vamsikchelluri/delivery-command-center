// api/src/routes/projects.js
const router = require('express').Router();
const prisma  = require('../lib/prisma');
const { auditLog } = require('../middleware/auth');

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
  pm:         { select: { id:true, name:true, email:true } },
  dm:         { select: { id:true, name:true, email:true } },
  am:         { select: { id:true, name:true, email:true } },
};

router.get('/', async (req, res) => {
  const { status, client } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(client ? { client: { contains: client, mode: 'insensitive' } } : {}),
      parentId: null,
    },
    include: PROJECT_INCLUDE,
    orderBy: { startDate: 'desc' },
  });
  res.json(projects);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: req.params.id }, include: PROJECT_INCLUDE });
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
      pmUserId:      d.pmUserId      || null,
      dmUserId:      d.dmUserId      || null,
      amUserId:      d.amUserId      || null,
      totalValue:    d.totalValue    ? parseFloat(d.totalValue) : null,
      parentId:      d.parentId      || null,
      notes:         d.notes         || null,
    },
    include: PROJECT_INCLUDE,
  });
  await auditLog(req, 'CREATE', 'projects', project.id, `${project.client} — ${project.name}`, null, d);
  res.status(201).json(project);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const old = await prisma.project.findUnique({ where: { id: req.params.id } });
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
      ...(d.pmUserId      !== undefined && { pmUserId:      d.pmUserId      || null }),
      ...(d.dmUserId      !== undefined && { dmUserId:      d.dmUserId      || null }),
      ...(d.amUserId      !== undefined && { amUserId:      d.amUserId      || null }),
      ...(d.totalValue    !== undefined && { totalValue:    d.totalValue ? parseFloat(d.totalValue) : null }),
      ...(d.notes         !== undefined && { notes:         d.notes || null }),
    },
    include: PROJECT_INCLUDE,
  });
  await auditLog(req, 'UPDATE', 'projects', project.id, `${project.client} — ${project.name}`, old, d);
  res.json(project);
});

router.delete('/:id', async (req, res) => {
  const p = await prisma.project.findUnique({ where: { id: req.params.id } });
  await prisma.project.delete({ where: { id: req.params.id } });
  await auditLog(req, 'DELETE', 'projects', req.params.id, `${p?.client} — ${p?.name}`, p, null);
  res.json({ success: true });
});

// ── ROLES
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
  res.json({ success: true });
});

// ── MILESTONES
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
      ...(d.actualAmount  !== undefined && { actualAmount:  d.actualAmount ? parseFloat(d.actualAmount) : null }),
      ...(d.invoiceDate   != null && { invoiceDate:   new Date(d.invoiceDate) }),
      ...(d.paymentDate   != null && { paymentDate:   new Date(d.paymentDate) }),
      ...(d.status        != null && { status:        d.status }),
    },
  });
  res.json(m);
});

router.delete('/milestones/:mid', async (req, res) => {
  await prisma.milestone.delete({ where: { id: req.params.mid } });
  res.json({ success: true });
});

module.exports = router;
