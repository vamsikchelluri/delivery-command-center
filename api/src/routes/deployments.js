// api/src/routes/deployments.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

router.post('/', async (req, res) => {
  const d = req.body;
  const dep = await prisma.deployment.create({
    data: {
      roleId:     d.roleId,
      resourceId: d.resourceId,
      startDate:  new Date(d.startDate),
      endDate:    new Date(d.endDate),
      allocation: parseInt(d.allocation) || 100,
    },
    include: {
      resource: { select: { id: true, name: true, primarySkill: true } },
      role:     { include: { project: { select: { id: true, client: true, name: true } } } },
      actuals:  true,
    },
  });

  // Recompute resource status
  await updateResourceStatus(d.resourceId);
  res.status(201).json(dep);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const dep = await prisma.deployment.update({
    where: { id: req.params.id },
    data: {
      ...(d.startDate  && { startDate:  new Date(d.startDate) }),
      ...(d.endDate    && { endDate:    new Date(d.endDate) }),
      ...(d.allocation !== undefined && { allocation: parseInt(d.allocation) }),
    },
    include: { resource: true, role: { include: { project: true } }, actuals: true },
  });
  await updateResourceStatus(dep.resourceId);
  res.json(dep);
});

router.delete('/:id', async (req, res) => {
  const dep = await prisma.deployment.findUniqueOrThrow({ where: { id: req.params.id } });
  await prisma.deployment.delete({ where: { id: req.params.id } });
  await updateResourceStatus(dep.resourceId);
  res.json({ success: true });
});

async function updateResourceStatus(resourceId) {
  const today = new Date();
  const deps  = await prisma.deployment.findMany({
    where: {
      resourceId,
      startDate: { lte: today },
      endDate:   { gte: today },
    },
  });
  const totalAlloc = deps.reduce((s, d) => s + d.allocation, 0);

  let status = 'ON_BENCH';
  if (totalAlloc >= 90)     status = 'DEPLOYED';
  else if (totalAlloc >= 10) status = 'PARTIALLY_DEPLOYED';

  await prisma.resource.update({
    where: { id: resourceId },
    data:  { status, benchSince: status === 'ON_BENCH' ? today : null },
  });
}

module.exports = router;
