// routes/users.js — User CRUD (Super Admin only)
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const prisma  = require('../lib/prisma');
const { authenticate, requireSuperAdmin, auditLog } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: { select: { id:true, name:true, label:true } } },
      orderBy: { name: 'asc' },
    });
    // Never return password hashes
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.params.id },
      include: { role: { select: { id:true, name:true, label:true } } },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ ...user, passwordHash: undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — Super Admin only
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, roleId, mustChangePwd } = req.body;
    if (!name || !email || !password || !roleId) return res.status(400).json({ error: 'name, email, password, roleId required' });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase().trim(), passwordHash: hash, roleId, mustChangePwd: mustChangePwd ?? true },
      include: { role: { select: { id:true, name:true, label:true } } },
    });
    await auditLog(req, 'CREATE', 'users', user.id, user.email, null, { name, email, roleId });
    res.json({ ...user, passwordHash: undefined });
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — Super Admin only
router.patch('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, roleId, active, mustChangePwd, password } = req.body;
    const data = {};
    if (name          != null) data.name          = name;
    if (email         != null) data.email         = email.toLowerCase().trim();
    if (roleId        != null) data.roleId        = roleId;
    if (active        != null) data.active        = active;
    if (mustChangePwd != null) data.mustChangePwd = mustChangePwd;
    if (password)              data.passwordHash  = await bcrypt.hash(password, 12);

    const old  = await prisma.user.findUnique({ where: { id: req.params.id } });
    const user = await prisma.user.update({
      where: { id: req.params.id }, data,
      include: { role: { select: { id:true, name:true, label:true } } },
    });
    await auditLog(req, 'UPDATE', 'users', user.id, user.email, old, data);
    res.json({ ...user, passwordHash: undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id — Super Admin only, can't delete yourself
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "Can't delete your own account" });
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    // Soft delete — deactivate instead of hard delete to preserve audit trail
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
    await auditLog(req, 'DELETE', 'users', req.params.id, user?.email, null, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
