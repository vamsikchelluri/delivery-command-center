// api/src/routes/actuals.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

// Upsert actuals for a deployment+month
router.post('/', async (req, res) => {
  const { deploymentId, month, actualHours, enteredBy, notes } = req.body;
  const actual = await prisma.actual.upsert({
    where:  { deploymentId_month: { deploymentId, month } },
    update: { actualHours: parseFloat(actualHours), enteredBy, notes },
    create: { deploymentId, month, actualHours: parseFloat(actualHours), enteredBy, notes },
  });
  res.json(actual);
});

router.delete('/:id', async (req, res) => {
  await prisma.actual.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
