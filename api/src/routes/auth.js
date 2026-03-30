// routes/auth.js — login, logout, refresh, me
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authenticate, JWT_SECRET, auditLog } = require('../middleware/auth');

const router = Router();
const ACCESS_TTL  = 15 * 60;       // 15 minutes
const REFRESH_TTL = 7 * 24 * 3600; // 7 days

function signAccess(userId)  { return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TTL  }); }
function signRefresh(userId) { return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TTL }); }

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { role: { include: { permissions: true, fieldPerms: true } } }
    });

    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken  = signAccess(user.id);
    const refreshToken = signRefresh(user.id);

    await prisma.session.create({
      data: {
        userId:       user.id,
        refreshToken,
        ipAddress:    req.ip,
        userAgent:    req.headers['user-agent'] || null,
        expiresAt:    new Date(Date.now() + REFRESH_TTL * 1000),
      }
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await auditLog(req, 'LOGIN', 'auth', user.id, user.email, null, null);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:            user.id,
        name:          user.name,
        email:         user.email,
        role:          user.role.name,
        roleLabel:     user.role.label,
        mustChangePwd: user.mustChangePwd,
        permissions:   Object.fromEntries(user.role.permissions.map(p => [p.module, p.access])),
        fieldPerms:    Object.fromEntries(user.role.fieldPerms.map(f => [f.fieldKey, f.visible])),
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try { payload = jwt.verify(refreshToken, JWT_SECRET); }
    catch (e) { return res.status(401).json({ error: 'Refresh token expired' }); }

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }

    const accessToken = signAccess(payload.userId);
    res.json({ accessToken });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.session.deleteMany({ where: { refreshToken } });
    await auditLog(req, 'LOGOUT', 'auth', req.user.id, req.user.email, null, null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/logout-all
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    await prisma.session.deleteMany({ where: { userId: req.user.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const u = req.user;
  res.json({
    id:            u.id,
    name:          u.name,
    email:         u.email,
    role:          u.role.name,
    roleLabel:     u.role.label,
    mustChangePwd: u.mustChangePwd,
    lastLogin:     u.lastLogin,
    permissions:   req.permissions,
    fieldPerms:    req.fieldPerms,
  });
});

// GET /api/auth/sessions
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where:   { userId: req.user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
    });
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/auth/change-password
router.patch('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash, mustChangePwd: false } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
