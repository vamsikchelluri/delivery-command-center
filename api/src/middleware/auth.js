// middleware/auth.js — JWT verification + RBAC enforcement
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'dcc-jwt-secret-change-in-prod';

// Verify JWT and attach user + permissions to req
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        role: {
          include: {
            permissions:  true,
            fieldPerms:   true,
          }
        }
      }
    });

    if (!user || !user.active) return res.status(401).json({ error: 'User not found or inactive' });

    req.user = user;
    req.permissions = Object.fromEntries(user.role.permissions.map(p => [p.module, p.access]));
    req.fieldPerms  = Object.fromEntries(user.role.fieldPerms.map(f => [f.fieldKey, f.visible]));
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Check module access — usage: requireAccess('resources', 'FULL') or requireAccess('projects')
function requireAccess(module, level = 'READ') {
  return (req, res, next) => {
    const access = req.permissions?.[module] || 'NONE';
    const levels = { NONE: 0, READ: 1, FULL: 2 };
    if (levels[access] >= levels[level]) return next();
    if (access === 'NONE') return res.status(403).json({ error: `Access denied to ${module}` });
    return res.status(403).json({ error: `Read-only access to ${module}` });
  };
}

// Super admin only
function requireSuperAdmin(req, res, next) {
  if (req.user?.role?.name === 'SUPER_ADMIN') return next();
  return res.status(403).json({ error: 'Super admin only' });
}

// Audit log helper — call from routes
async function auditLog(req, action, module, recordId, recordLabel, oldValues, newValues) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:      req.user?.id      || null,
        userEmail:   req.user?.email   || null,
        action,
        module,
        recordId:    recordId    || null,
        recordLabel: recordLabel || null,
        oldValues:   oldValues   || null,
        newValues:   newValues   || null,
        ipAddress:   req.ip      || null,
      }
    });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

module.exports = { authenticate, requireAccess, requireSuperAdmin, auditLog, JWT_SECRET };
