// routes/roles.js — Role list + configurable permission matrix
const { Router } = require('express');
const prisma = require('../lib/prisma');
const { requireSuperAdmin } = require('../middleware/auth');

const router = Router();

// GET /api/roles
router.get('/', async (req, res) => {
  try {
    const roles = await prisma.appRole.findMany({
      include: { permissions: true, fieldPerms: true, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/roles/:id/permissions
router.patch('/:id/permissions', requireSuperAdmin, async (req, res) => {
  try {
    const { module, access } = req.body;
    if (!module || !access) return res.status(400).json({ error: 'module and access required' });
    const perm = await prisma.permission.upsert({
      where:  { roleId_module: { roleId: req.params.id, module } },
      update: { access },
      create: { roleId: req.params.id, module, access },
    });
    res.json(perm);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/roles/:id/field-permissions
router.patch('/:id/field-permissions', requireSuperAdmin, async (req, res) => {
  try {
    const { fieldKey, visible } = req.body;
    if (!fieldKey || visible == null) return res.status(400).json({ error: 'fieldKey and visible required' });
    const fp = await prisma.fieldPermission.upsert({
      where:  { roleId_fieldKey: { roleId: req.params.id, fieldKey } },
      update: { visible },
      create: { roleId: req.params.id, fieldKey, visible },
    });
    res.json(fp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
