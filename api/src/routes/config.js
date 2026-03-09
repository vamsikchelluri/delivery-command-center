// api/src/routes/config.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res) => {
  const rows = await prisma.systemConfig.findMany();
  const cfg = Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]));
  res.json(cfg);
});

router.patch('/', async (req, res) => {
  const updates = req.body; // { STANDARD_HOURS_YEAR: 1800, ... }
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  const rows = await prisma.systemConfig.findMany();
  res.json(Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)])));
});

module.exports = router;
