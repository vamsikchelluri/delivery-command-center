// api/src/routes/pipeline.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res) => {
  const opps = await prisma.opportunity.findMany({
    include: { roles: true, project: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(opps);
});

router.post('/', async (req, res) => {
  const d = req.body;
  const opp = await prisma.opportunity.create({
    data: {
      client:      d.client,
      name:        d.name,
      stage:       d.stage       || 'DISCOVERY',
      probability: d.probability ?? 50,
      closeDate:   d.closeDate   ? new Date(d.closeDate) : null,
      owner:       d.owner       || null,
      notes:       d.notes       || null,
      roles: d.roles?.length ? {
        create: d.roles.map(r => ({
          title:          r.title,
          skillId:        r.skillId       || null,
          billRate:       r.billRate      ? parseFloat(r.billRate) : null,
          estStartDate:   r.estStartDate  ? new Date(r.estStartDate) : null,
          durationMonths: r.durationMonths || 6,
          hoursPerMonth:  r.hoursPerMonth  || 168,
        })),
      } : undefined,
    },
    include: { roles: true },
  });
  res.status(201).json(opp);
});

router.patch('/:id', async (req, res) => {
  const d = req.body;
  const opp = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: {
      ...(d.stage       && { stage: d.stage }),
      ...(d.probability !== undefined && { probability: d.probability }),
      ...(d.closeDate   && { closeDate: new Date(d.closeDate) }),
      ...(d.notes       !== undefined && { notes: d.notes }),
    },
    include: { roles: true },
  });
  res.json(opp);
});

router.delete('/:id', async (req, res) => {
  await prisma.opportunity.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
