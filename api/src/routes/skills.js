// api/src/routes/skills.js
const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(skills);
});

router.post('/', async (req, res) => {
  const { name, submods = [] } = req.body;
  const max = await prisma.skill.aggregate({ _max: { sortOrder: true } });
  const skill = await prisma.skill.create({
    data: { name, submods, sortOrder: (max._max.sortOrder || 0) + 1 },
  });
  res.status(201).json(skill);
});

router.patch('/:id', async (req, res) => {
  const { name, submods } = req.body;
  const skill = await prisma.skill.update({
    where: { id: req.params.id },
    data: { ...(name && { name }), ...(submods && { submods }) },
  });
  res.json(skill);
});

router.delete('/:id', async (req, res) => {
  await prisma.skill.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
