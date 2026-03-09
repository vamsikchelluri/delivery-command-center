// api/src/routes/currencies.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res) => {
  res.json(await prisma.currency.findMany({ orderBy: { isBase: 'desc' } }));
});

router.post('/', async (req, res) => {
  const { code, symbol, name, rateVsUSD } = req.body;
  const c = await prisma.currency.upsert({
    where: { code: code.toUpperCase() },
    update: { symbol, name, rateVsUSD: parseFloat(rateVsUSD) },
    create: { code: code.toUpperCase(), symbol, name, rateVsUSD: parseFloat(rateVsUSD), isBase: false },
  });
  res.json(c);
});

router.patch('/:code', async (req, res) => {
  const c = await prisma.currency.update({
    where: { code: req.params.code },
    data: { rateVsUSD: parseFloat(req.body.rateVsUSD) },
  });
  res.json(c);
});

router.delete('/:code', async (req, res) => {
  const c = await prisma.currency.findUnique({ where: { code: req.params.code } });
  if (c?.isBase) return res.status(400).json({ error: 'Cannot delete base currency' });
  await prisma.currency.delete({ where: { code: req.params.code } });
  res.json({ success: true });
});

module.exports = router;
