// routes/team.js — CRUD for Person (Account Managers, Delivery Managers)
const { Router } = require('express');
const prisma = require('../lib/prisma');
const router = Router();

// GET /api/team
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) where.role = role;
    const people = await prisma.person.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(people);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/team
router.post('/', async (req, res) => {
  try {
    const { name, role, email, phone, notes } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'name and role required' });
    const person = await prisma.person.create({ data: { name, role, email, phone, notes } });
    res.json(person);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/team/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, role, email, phone, notes, active } = req.body;
    const person = await prisma.person.update({
      where: { id: req.params.id },
      data: { name, role, email, phone, notes, active },
    });
    res.json(person);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/team/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.person.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
