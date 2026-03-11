// api/src/routes/financials.js
const router = require('express').Router();
const prisma  = require('../lib/prisma');

// ── OVERHEAD FORMULAS ────────────────────────────────────────────────
function calcOverhead(location, employmentType, payRateUSD) {
  if (employmentType === 'FT_EMPLOYEE' || employmentType === 'PT_EMPLOYEE')
    return payRateUSD * 0.125 + 2.5 + 1.5;          // W2
  if (employmentType === 'CONTRACTOR' && location === 'OFFSHORE')
    return payRateUSD * 0.25;                         // Offshore Payroll
  return 2;                                           // C2C / Offshore C2C / Intern
}

function workStatusLabel(location, employmentType) {
  if (employmentType === 'FT_EMPLOYEE' || employmentType === 'PT_EMPLOYEE') return 'W2';
  if (employmentType === 'CONTRACTOR') return location === 'OFFSHORE' ? 'Offshore Payroll' : 'C2C';
  if (employmentType === 'C2C')        return location === 'OFFSHORE' ? 'Offshore C2C'     : 'C2C';
  return employmentType;
}

function toUSDHourly(resource, fxRate, annualHrs) {
  if (resource.location === 'OFFSHORE')
    return resource.costInput / (annualHrs * fxRate);
  if (resource.employmentType === 'FT_EMPLOYEE' || resource.employmentType === 'PT_EMPLOYEE')
    return resource.costInput / annualHrs;
  return resource.costInput;
}

// ── QUARTER HELPERS ──────────────────────────────────────────────────
function quarterRange(q) {
  // q = "2025-Q1" | "2025-Q2" | "2025-Q3" | "2025-Q4"
  if (!q) return null;
  const [yr, qx] = q.split('-');
  const year = parseInt(yr);
  const qn   = parseInt(qx.replace('Q',''));
  const startMonth = (qn - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end   = new Date(year, startMonth + 3, 0, 23, 59, 59);
  return { start, end };
}

// ── BUILD REPORT ROWS ────────────────────────────────────────────────
function buildRows(projects, fxRate, annualHrs, dateStart, dateEnd) {
  const rows = [];
  for (const proj of projects) {
    for (const role of proj.roles) {
      for (const dep of role.deployments) {
        const res = dep.resource;

        // Date-range overlap
        const depS = new Date(dep.startDate);
        const depE = new Date(dep.endDate);
        const effS = dateStart ? new Date(Math.max(depS, dateStart)) : depS;
        const effE = dateEnd   ? new Date(Math.min(depE, dateEnd))   : depE;
        if (effS > effE) continue;

        // Hours: actuals filtered by date range, else derived
        let billableHrs;
        const filteredActuals = dep.actuals.filter(a => {
          if (!dateStart && !dateEnd) return true;
          const m = new Date(a.month + '-01');
          return (!dateStart || m >= dateStart) && (!dateEnd || m <= dateEnd);
        });
        const actualHrs = filteredActuals.reduce((s, a) => s + (a.actualHours || 0), 0);

        if (actualHrs > 0) {
          billableHrs = actualHrs;
        } else {
          const days  = Math.max(0, (effE - effS) / 86400000);
          billableHrs = Math.round((days / 7) * 40 * (dep.allocation / 100));
        }

        // Full deployment prov hours (no date filter for reference)
        const fullDays = Math.max(0, (depE - depS) / 86400000);
        const provHrs  = Math.round((fullDays / 7) * 40 * (dep.allocation / 100));

        const billRate      = role.billRate || 0;
        const payRateUSD    = toUSDHourly(res, fxRate, annualHrs);
        const overhead      = calcOverhead(res.location, res.employmentType, payRateUSD);
        const totalHrlyCost = payRateUSD + overhead;
        const revenue       = billableHrs * billRate;
        const totalCost     = billableHrs * totalHrlyCost;
        const profit        = revenue - totalCost;
        const fixedBidProfit = (role.billingType === 'FIXED' && role.fixedAmount)
          ? role.fixedAmount - totalCost : 0;

        const isOffshore     = res.location === 'OFFSHORE';
        const offshorePayCost = isOffshore ? billableHrs * payRateUSD : null;
        const intraEdgeMargin = isOffshore ? revenue - (offshorePayCost || 0) : null;

        rows.push({
          projectId: proj.id, projectName: proj.name, client: proj.client,
          sowNumber: proj.sowNumber || '',
          dmName: proj.dm?.name || '—', amName: proj.am?.name || '—', pmName: proj.pm?.name || '—',
          projectStatus: proj.status,
          resourceId: res.id, fullName: res.name,
          firstName: res.name.split(' ')[0],
          lastName:  res.name.split(' ').slice(1).join(' '),
          workStatus: workStatusLabel(res.location, res.employmentType),
          location: res.location, employmentType: res.employmentType,
          roleTitle: role.title,
          depStart: dep.startDate, depEnd: dep.endDate,
          allocation: dep.allocation,
          provisionedHrs: provHrs, billableHrs,
          hasActuals: actualHrs > 0,
          billRate, payRate: payRateUSD, overhead, totalHrlyCost,
          revenue, totalCost, profit,
          marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
          fixedBidProfit,
          isOffshore, offshorePayCost, intraEdgeMargin,
          inrCTC: isOffshore ? res.costInput : null,
          fxRate, annualHrs,
        });
      }
    }
  }
  return rows;
}

// ── GET SYSTEM CONFIG ─────────────────────────────────────────────────
async function getConfig() {
  const rows = await prisma.systemConfig.findMany().catch(() => []);
  const cfg  = Object.fromEntries(rows.map(r => [r.key, parseFloat(r.value)]));
  return { fxRate: cfg.fxRate || 88, annualHrs: cfg.hoursPerYear || 1800 };
}

// ── PROJECT WHERE CLAUSE ─────────────────────────────────────────────
function buildProjectWhere({ dmUserId, amUserId, pmUserId, client, projectId, status }) {
  const w = {};
  if (status && status !== 'ALL') w.status = status;
  if (dmUserId)  w.dmUserId = dmUserId;
  if (amUserId)  w.amUserId = amUserId;
  if (pmUserId)  w.pmUserId = pmUserId;
  if (client)    w.client   = { contains: client, mode: 'insensitive' };
  if (projectId) w.id       = projectId;
  return w;
}

const PROJECT_INCLUDE = {
  dm: { select: { id: true, name: true } },
  am: { select: { id: true, name: true } },
  pm: { select: { id: true, name: true } },
  roles: {
    include: {
      deployments: {
        include: {
          resource: {
            select: { id:true, name:true, location:true, employmentType:true, costInput:true, rateCurrency:true }
          },
          actuals: true,
        }
      }
    }
  },
};

// ── /pl-report ───────────────────────────────────────────────────────
router.get('/pl-report', async (req, res) => {
  try {
    const { dmUserId, amUserId, pmUserId, client, projectId,
            status = 'ACTIVE', quarter, dateFrom, dateTo } = req.query;

    const { fxRate, annualHrs } = await getConfig();

    const qr  = quarterRange(quarter);
    const dateStart = qr ? qr.start : (dateFrom ? new Date(dateFrom) : null);
    const dateEnd   = qr ? qr.end   : (dateTo   ? new Date(dateTo)   : null);

    const projects = await prisma.project.findMany({
      where:   buildProjectWhere({ dmUserId, amUserId, pmUserId, client, projectId, status }),
      include: PROJECT_INCLUDE,
      orderBy: [{ client: 'asc' }, { name: 'asc' }],
    });

    const rows    = buildRows(projects, fxRate, annualHrs, dateStart, dateEnd);
    const summary = {
      totalRevenue:   rows.reduce((s, r) => s + r.revenue, 0),
      totalCost:      rows.reduce((s, r) => s + r.totalCost, 0),
      totalProfit:    rows.reduce((s, r) => s + r.profit, 0),
      fixedBidProfit: rows.reduce((s, r) => s + r.fixedBidProfit, 0),
      headcount:      new Set(rows.map(r => r.resourceId)).size,
      projectCount:   new Set(rows.map(r => r.projectId)).size,
    };
    summary.margin = summary.totalRevenue > 0
      ? ((summary.totalProfit + summary.fixedBidProfit) / summary.totalRevenue) * 100 : 0;

    res.json({ rows, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── /pl-filters ──────────────────────────────────────────────────────
router.get('/pl-filters', async (req, res) => {
  try {
    const [clients, dms, ams, pms, projects] = await Promise.all([
      prisma.project.findMany({ select:{ client:true }, distinct:['client'], orderBy:{ client:'asc' } }),
      prisma.user.findMany({ where:{ role:{ name:'DELIVERY_MANAGER' }, active:true }, select:{ id:true, name:true }, orderBy:{ name:'asc' } }),
      prisma.user.findMany({ where:{ role:{ name:'ACCOUNT_MANAGER'  }, active:true }, select:{ id:true, name:true }, orderBy:{ name:'asc' } }),
      prisma.user.findMany({ where:{ role:{ name:'PROJECT_MANAGER'  }, active:true }, select:{ id:true, name:true }, orderBy:{ name:'asc' } }),
      prisma.project.findMany({ select:{ id:true, name:true, client:true }, where:{ status:'ACTIVE' }, orderBy:[{ client:'asc' },{ name:'asc' }] }),
    ]);
    res.json({ clients: clients.map(p => p.client), dms, ams, pms, projects });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
