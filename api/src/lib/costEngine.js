// api/src/lib/costEngine.js
// All cost rate calculations — single source of truth

/**
 * Compute USD/hr and INR/hr cost rate for a resource
 * @param {string} location     - ONSITE | OFFSHORE
 * @param {string} empType      - FT_EMPLOYEE | PT_EMPLOYEE | CONTRACTOR | C2C
 * @param {number} inputValue   - CTC (annual) or hourly rate
 * @param {string} inputCurrency- INR | USD
 * @param {number} fxRate       - INR per 1 USD (e.g. 88)
 * @param {number} hrsYear      - standard hours per year (default 1800)
 * @param {number} overhead     - overhead multiplier for employees (default 1.2)
 * @returns {{ usd: number, inr: number|null, formula: string }}
 */
function computeCostRate({ location, empType, inputValue, inputCurrency = 'INR', fxRate = 88, hrsYear = 1800, overhead = 1.2 }) {
  const isEmployee = empType === 'FT_EMPLOYEE' || empType === 'PT_EMPLOYEE';
  const isOffshore  = location === 'OFFSHORE';
  let usd = 0, inr = null, formula = '';

  if (isOffshore && isEmployee) {
    // CTC always INR for offshore employees
    usd     = (inputValue / fxRate / hrsYear) * overhead;
    inr     = usd * fxRate;
    formula = `(₹${inputValue.toLocaleString()} ÷ ${fxRate} ÷ ${hrsYear}) × ${overhead}`;

  } else if (isOffshore && !isEmployee) {
    // Offshore contractor/C2C — rate in INR or USD
    if (inputCurrency === 'INR') {
      inr     = inputValue;
      usd     = inputValue / fxRate;
      formula = `₹${inputValue}/hr ÷ ${fxRate} (no overhead)`;
    } else {
      usd     = inputValue;
      inr     = inputValue * fxRate;
      formula = `$${inputValue}/hr USD as-is (no overhead) → ₹${(inputValue * fxRate).toFixed(0)}/hr`;
    }

  } else if (!isOffshore && isEmployee) {
    // Onsite employee — annual salary in USD
    usd     = (inputValue / hrsYear) * overhead;
    formula = `($${inputValue.toLocaleString()} ÷ ${hrsYear}) × ${overhead}`;

  } else {
    // Onsite contractor/C2C — USD hourly, no overhead
    usd     = inputValue;
    formula = `$${inputValue}/hr USD (no overhead)`;
  }

  return {
    usd:     +usd.toFixed(4),
    inr:     inr ? +inr.toFixed(2) : null,
    formula,
  };
}

/**
 * Get the cost rate for a resource for a specific month (point-in-time)
 * Uses the locked computedUSDhr from cost history — never recomputes from current data
 * @param {Array}  costHistory - array of CostHistory records
 * @param {string} month       - "2025-06"
 * @returns {number} USD/hr at that point in time
 */
function getCostRateForMonth(costHistory, month) {
  const targetDate = new Date(month + '-01');

  const record = costHistory.find(h => {
    const from = new Date(h.effectiveFrom);
    const to   = h.effectiveTo ? new Date(h.effectiveTo) : new Date('2099-12-31');
    return from <= targetDate && targetDate <= to;
  });

  return record ? record.computedUSDhr : 0;
}

/**
 * Compute planned hours for a deployment in a given month
 * @param {number} allocation  - percentage 0-100
 * @param {number} workingDays - working days in that month (default 21)
 * @param {number} hoursPerDay - hours per day (default 8)
 */
function plannedHours(allocation, workingDays = 21, hoursPerDay = 8) {
  return workingDays * hoursPerDay * (allocation / 100);
}

/**
 * Compute monthly P&L for a single deployment
 */
function deploymentPL({ billRate, billingType, fixedAmount, allocation, actualHours, costUSDhr, workingDays = 21, hoursPerDay = 8 }) {
  const planned = plannedHours(allocation, workingDays, hoursPerDay);

  let revenue = 0;
  if (billingType === 'FIXED_MONTHLY') {
    revenue = fixedAmount || 0;
  } else {
    revenue = (actualHours ?? planned) * (billRate || 0);
  }

  const cost   = (actualHours ?? planned) * costUSDhr;
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

  return {
    plannedHours:  +planned.toFixed(2),
    actualHours:   actualHours ?? null,
    revenue:       +revenue.toFixed(2),
    cost:          +cost.toFixed(2),
    margin:        +margin.toFixed(2),
    marginPct:     +marginPct.toFixed(1),
  };
}

module.exports = { computeCostRate, getCostRateForMonth, plannedHours, deploymentPL };
