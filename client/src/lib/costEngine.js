// src/lib/costEngine.js — mirrors API logic for live preview in forms

export function computeCostRate({ location, empType, inputValue, inputCurrency = 'INR', fxRate = 88, hrsYear = 1800, overhead = 1.2 }) {
  const isEmployee = empType === 'FT_EMPLOYEE' || empType === 'PT_EMPLOYEE';
  const isOffshore  = location === 'OFFSHORE';
  let usd = 0, inr = null, formula = '';

  if (isOffshore && isEmployee) {
    usd     = (inputValue / fxRate / hrsYear) * overhead;
    inr     = usd * fxRate;
    formula = `(₹${inputValue.toLocaleString()} ÷ ${fxRate} ÷ ${hrsYear}) × ${overhead}`;
  } else if (isOffshore && !isEmployee) {
    if (inputCurrency === 'INR') {
      inr = inputValue; usd = inputValue / fxRate;
      formula = `₹${inputValue}/hr ÷ ${fxRate} (no overhead)`;
    } else {
      usd = inputValue; inr = inputValue * fxRate;
      formula = `$${inputValue}/hr as-is → ₹${(inputValue * fxRate).toFixed(0)}/hr`;
    }
  } else if (!isOffshore && isEmployee) {
    usd     = (inputValue / hrsYear) * overhead;
    formula = `($${inputValue.toLocaleString()} ÷ ${hrsYear}) × ${overhead}`;
  } else {
    usd     = inputValue;
    formula = `$${inputValue}/hr (no overhead)`;
  }

  return { usd: +usd.toFixed(4), inr: inr ? +inr.toFixed(2) : null, formula };
}

export function statusBadgeClass(status) {
  return {
    DEPLOYED:           'badge-green',
    PARTIALLY_DEPLOYED: 'badge-yellow',
    AVAILABLE:          'badge-blue',
    ON_BENCH:           'badge-gray',
    LONG_LEAVE:         'badge-purple',
    VACATION:           'badge-purple',
    NOTICE_PERIOD:      'badge-red',
    EXITED:             'badge-gray',
    INACTIVE:           'badge-gray',
  }[status] || 'badge-gray';
}

export function statusLabel(status) {
  return {
    DEPLOYED:           'Deployed',
    PARTIALLY_DEPLOYED: 'Partial',
    AVAILABLE:          'Available',
    ON_BENCH:           'On Bench',
    LONG_LEAVE:         'Long Leave',
    VACATION:           'Vacation',
    NOTICE_PERIOD:      'Notice Period',
    EXITED:             'Exited',
    INACTIVE:           'Inactive',
  }[status] || status;
}

export function allocColor(pct) {
  if (pct >= 85) return 'var(--accent)';
  if (pct >= 60) return 'var(--accent3)';
  return 'var(--danger)';
}

export function fmtUSD(n)  { return '$' + Math.round(n || 0).toLocaleString(); }
export function fmtRate(n) { return '$' + (n || 0).toFixed(2); }
export function fmtNum(n)  { return Number(n || 0).toLocaleString(); }

export function getInitials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function currentCostRecord(costHistory = []) {
  return [...costHistory]
    .filter(h => !h.effectiveTo)
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0] || null;
}

export function getCurrentUSDRate(resource) {
  const rec = currentCostRecord(resource.costHistory || []);
  return rec?.computedUSDhr || 0;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
