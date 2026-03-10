// routes/audit.js — Audit log viewer
const { Router } = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const router = Router();
router.use(authenticate, requireSuperAdmin);

// GET /api/audit?module=&userId=&action=&from=&to=&limit=100
router.get('/', async (req, res) => {
  try {
    const { module, userId, action, from, to, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (module) where.module = module;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name:true, email:true } } },
        orderBy: { createdAt: 'desc' },
        take:    parseInt(limit),
        skip:    parseInt(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
