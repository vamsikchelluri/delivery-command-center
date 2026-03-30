// routes/financials.js — P&L Report engine
const router = require('express').Router();
const prisma  = require('../lib/prisma');

function calcOverhead(location, employmentType, payRateUSD) {
  if (employmentType === 'FT_EMPLOYEE' || employmentType === 'PT_EMPLOYEE') {
    return payRateUSD * 0.125 + 2.5 + 1.5;
  }
  if (employmentType === 'C2C') return 2;
  if (employmentType === 'CONTRACTOR') return location === 'OFFSHORE' ? payRateUSD * 0.25 : 2;
  return 2;
}

function workStatusLabel(location, employmentType) {
  if (employmentType === 'FT_EMPLOYEE' || employmentType === 'PT_EMPLOYEE') return 'W2';
  if (employmentType === 'C2C') return location === 'OFFSHORE' ? 'Offshore C2C' : 'C2C';
  if (employmentType === 'CONTRACTOR') return location === 'OFFSHORE' ? 'Offshore Payroll' : 'C2C';
  return employmentType;
}

function toUSDHourly(resource, fxRate = 83, annualHrs = 2008) {
  if (resource.location === 'OFFSHORE') {
    return resource.costInput / (annualHrs * fxRate);
  } else {
    if (resource.employmentType === 'FT_EMPLOYEE' || resource.employmentType === 'PT_EMPLOYEE') {
      return resource.costInput / annualHrs;
    }
    return resource.costInput;
  }
}

router.get('/pl-report', async (req, res) => {
  try {
    const { dmUserId, amUserId, client, projectId, status = 'ACTIVE' } = req.query;

    const cfg = await prisma.systemConfig.findMany();
    const cfgMap = Object.fromEntries(cfg.map(c => [c.key, parseFloat(c.value)]));
    const fxRate    = cfgMap.fxRate    || 83;
    const annualHrs = cfgMap.hoursPerYear || 2008;

    const projectWhere = {};
    if (status && status !== 'ALL') projectWhere.status = status;
    if (dmUserId)  projectWhere.dmUserId = dmUserId;
    if (amUserId)  projectWhere.amUserId = amUserId;
    if (client)    projectWhere.client   = { contains: client, mode: 'insensitive' };
    if (projectId) projectWhere.id       = projectId;

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        dm: { select: { id: true, name: true } },
        am: { select: { id: true, name: true } },
        roles: {
          include: {
            deployments: {
              include: {
                resource: { select: { id: true, name: true, location: true, employmentType: true, costInput: true, rateCurrency: true } },
                actuals: true,
              }
            }
          }
        },
      },
      orderBy: [{ client: 'asc' }, { name: 'asc' }],
    });

    const rows = [];
    for (const proj of projects) {
      for (const role of proj.roles) {
        for (const dep of role.deployments) {
          const resource = dep.resource;
          const totalActualHrs = dep.actuals.reduce((s, a) => s + (a.actualHours || 0), 0);
          const depDays  = Math.max(0, (new Date(dep.endDate) - new Date(dep.startDate)) / 86400000);
          const depHrs   = Math.round((depDays / 7) * 40 * (dep.allocation / 100));
          const billableHrs = totalActualHrs > 0 ? totalActualHrs : depHrs;
          const billRate    = role.billRate || 0;
          const payRateUSD  = toUSDHourly(resource, fxRate, annualHrs);
          const overhead    = calcOverhead(resource.location, resource.employmentType, payRateUSD);
          const totalHrlyCost = payRateUSD + overhead;
          const revenue  = billableHrs * billRate;
          const totalCost = billableHrs * totalHrlyCost;
          const profit   = revenue - totalCost;
          const isOffshore = resource.location === 'OFFSHORE';

          rows.push({
            projectId: proj.id, projectName: proj.name, client: proj.client,
            sowNumber: proj.sowNumber, dmName: proj.dm?.name || '—', amName: proj.am?.name || '—',
            resourceId: resource.id, fullName: resource.name,
            firstName: resource.name.split(' ')[0], lastName: resource.name.split(' ').slice(1).join(' '),
            workStatus: workStatusLabel(resource.location, resource.employmentType),
            location: resource.location, roleTitle: role.title,
            provisionedHrs: depHrs, billableHrs, hasActuals: totalActualHrs > 0,
            billRate, payRate: payRateUSD, overhead, totalHrlyCost,
            revenue, totalCost, profit,
            marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
            isOffshore,
            offshorePayCost: isOffshore ? billableHrs * payRateUSD : null,
            intraEdgeMargin: isOffshore ? revenue - billableHrs * payRateUSD : null,
            inrCTC: resource.location === 'OFFSHORE' ? resource.costInput : null,
            fxRate, annualHrs,
          });
        }
      }
    }

    const summary = {
      totalRevenue:  rows.reduce((s, r) => s + r.revenue, 0),
      totalCost:     rows.reduce((s, r) => s + r.totalCost, 0),
      totalProfit:   rows.reduce((s, r) => s + r.profit, 0),
      headcount:     new Set(rows.map(r => r.resourceId)).size,
      projectCount:  new Set(rows.map(r => r.projectId)).size,
    };
    summary.margin = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0;

    res.json({ rows, summary, filters: { dmUserId, amUserId, client, projectId, status } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/pl-filters', async (req, res) => {
  try {
    const [projects, dms, ams] = await Promise.all([
      prisma.project.findMany({ select: { client: true }, distinct: ['client'], orderBy: { client: 'asc' } }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ clients: projects.map(p => p.client), dms, ams });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
