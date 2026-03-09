// api/src/routes/dashboard.js
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { getCostRateForMonth } = require('../lib/costEngine');

router.get('/', async (req, res) => {
  const today = new Date();
  const in30  = new Date(today); in30.setDate(today.getDate() + 30);
  const in60  = new Date(today); in60.setDate(today.getDate() + 60);

  const [resources, projects, cfg] = await Promise.all([
    prisma.resource.findMany({
      include: {
        costHistory: true,
        deployments: {
          where: { startDate: { lte: today }, endDate: { gte: today } },
          include: { role: { include: { project: { select: { client: true, name: true } } } } },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: { roles: { include: { deployments: { include: { actuals: true } } } }, milestones: true },
    }),
    prisma.systemConfig.findMany(),
  ]);

  const config = Object.fromEntries(cfg.map(c => [c.key, parseFloat(c.value)]));
  const wdays  = config.DEFAULT_WORKING_DAYS || 21;
  const hpd    = config.WORKING_HOURS_DAY    || 8;

  // ── RESOURCE KPIs ──
  const active = resources.filter(r => r.status !== 'EXITED');

  const bench  = active.filter(r => r.status === 'ON_BENCH');
  const avgUtil = active.length
    ? Math.round(active.reduce((s, r) => s + totalAlloc(r), 0) / active.length)
    : 0;

  let benchBurnPerMonth = 0;
  bench.forEach(r => {
    const rec = currentCostRecord(r.costHistory);
    if (rec) benchBurnPerMonth += rec.computedUSDhr * wdays * hpd;
  });

  // ── ALERTS ──
  const alerts = [];
  const isEmp = t => t === 'FT_EMPLOYEE' || t === 'PT_EMPLOYEE';

  active.forEach(r => {
    if (!isEmp(r.employmentType) && r.contractEnd) {
      const days = Math.ceil((new Date(r.contractEnd) - today) / 86400000);
      if (days <= 30 && days > 0)  alerts.push({ type: 'warn',   category: 'contract',  resourceId: r.id, resourceName: r.name, msg: `Contract expiring in ${days}d`, days });
      if (days <= 0)               alerts.push({ type: 'danger', category: 'contract',  resourceId: r.id, resourceName: r.name, msg: `Contract expired`, days: 0 });
    }
    if (r.visaExpiry) {
      const days = Math.ceil((new Date(r.visaExpiry) - today) / 86400000);
      if (days <= 60 && days > 0)  alerts.push({ type: 'warn',   category: 'visa',      resourceId: r.id, resourceName: r.name, msg: `Visa expiring in ${days}d`, days });
      if (days <= 0)               alerts.push({ type: 'danger', category: 'visa',      resourceId: r.id, resourceName: r.name, msg: `Visa expired`, days: 0 });
    }
    if (r.rolloffDate) {
      const days = Math.ceil((new Date(r.rolloffDate) - today) / 86400000);
      const rec  = currentCostRecord(r.costHistory);
      const burn = rec ? rec.computedUSDhr * wdays * hpd : 0;
      if (days <= 30 && days > 0)  alerts.push({ type: 'warn',   category: 'rolloff',   resourceId: r.id, resourceName: r.name, msg: `Rolling off in ${days}d — bench burn $${Math.round(burn)}/mo`, days });
    }
    if (r.bgCheckStatus === 'EXPIRED') alerts.push({ type: 'warn', category: 'bgcheck', resourceId: r.id, resourceName: r.name, msg: `Background check expired`, days: null });
  });

  // ── PROJECT KPIs ──
  const activeProjectCount = projects.length;

  res.json({
    resources: {
      total:       active.length,
      deployed:    active.filter(r => r.status === 'DEPLOYED').length,
      partial:     active.filter(r => r.status === 'PARTIALLY_DEPLOYED').length,
      bench:       bench.length,
      available:   active.filter(r => r.status === 'AVAILABLE').length,
      avgUtil,
      benchBurnPerMonth: Math.round(benchBurnPerMonth),
    },
    projects: {
      active:      activeProjectCount,
    },
    alerts,
    computedAt:    today.toISOString(),
  });
});

function totalAlloc(resource) {
  return Math.min(resource.deployments.reduce((s, d) => s + d.allocation, 0), 100);
}

function currentCostRecord(costHistory) {
  return costHistory
    .filter(h => !h.effectiveTo)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0] || null;
}

module.exports = router;
