// pages/PLReport.jsx — P&L Staffing Report
// Filters: DM · AM · PM · Client · Status · Quarter / Date Range
// Views: Resource (flat) · Group by Client · Group by DM
// Export: Excel (.xlsx) matching the eBay report format

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialsApi } from '../lib/api';
import { fmtUSD } from '../lib/costEngine';

// ── FORMAT HELPERS ────────────────────────────────────────────────────────────
const fmt$    = v => v == null ? '—' : fmtUSD(v);
const fmtRate = v => v == null ? '—' : `$${Number(v).toFixed(2)}`;
const fmtNum  = v => v == null ? '—' : Number(v).toLocaleString();
const fmtPct  = v => v == null ? '—' : `${Number(v).toFixed(1)}%`;

// ── STATUS BADGE ─────────────────────────────────────────────────────────────
const BADGE = {
  'C2C':              { bg:'#EBF3FF', text:'#5B21B6' },
  'Offshore C2C':     { bg:'#F3ECFF', text:'#0052CC' },
  'W2':               { bg:'#EBF9F0', text:'#065F46' },
  'Offshore Payroll': { bg:'#FFF8E8', text:'#92400E' },
  'Intern':           { bg:'#F5F5F5', text:'#4B5563' },
};
function WorkBadge({ s }) {
  const b = BADGE[s] || { bg:'#F0F0F0', text:'#555' };
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20,
      fontSize:11, fontWeight:700, background:b.bg, color:b.text, whiteSpace:'nowrap' }}>
      {s}
    </span>
  );
}
function MarginBadge({ v }) {
  const color = v >= 35 ? '#059669' : v >= 20 ? '#D97706' : v >= 0 ? '#64748B' : '#DC2626';
  return <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13, color }}>{fmtPct(v)}</span>;
}

// ── QUARTER OPTIONS ───────────────────────────────────────────────────────────
function quarterOptions() {
  const opts = [];
  const now = new Date();
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) {
    for (let q = 4; q >= 1; q--) opts.push(`${y}-Q${q}`);
  }
  return opts;
}

// ── EXCEL EXPORT ─────────────────────────────────────────────────────────────
// Uses SheetJS (xlsx) loaded via CDN script tag at runtime
async function exportExcel(rows, summary, filterLabel, quarterLabel) {
  // Lazy-load SheetJS
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();

  // ── Sheet 1: Detail ──────────────────────────────────────────────────
  const HDR = [
    'First Name','Last Name','Work Status','Role Title','Client','SOW / Project','SOW #',
    'DM','AM','PM',
    'Prov. Hours','Billable Hrs','Bill Rate ($)','Pay Rate ($/hr)','OH ($/hr)',
    'Total Hrly Cost','Revenue ($)','Total Cost ($)','Profit ($)','Margin %',
    'Fixed Bid Profit','Offshore Pay Cost','IntraEdge Margin',
  ];

  const dataRows = rows.map(r => [
    r.firstName, r.lastName, r.workStatus, r.roleTitle, r.client, r.projectName, r.sowNumber,
    r.dmName, r.amName, r.pmName,
    r.provisionedHrs, r.billableHrs, r.billRate,
    +r.payRate.toFixed(4), +r.overhead.toFixed(4), +r.totalHrlyCost.toFixed(4),
    +r.revenue.toFixed(2), +r.totalCost.toFixed(2), +r.profit.toFixed(2),
    r.marginPct / 100,   // will format as %
    r.fixedBidProfit != null ? +r.fixedBidProfit.toFixed(2) : 0,
    r.offshorePayCost != null ? +r.offshorePayCost.toFixed(2) : '',
    r.intraEdgeMargin != null ? +r.intraEdgeMargin.toFixed(2) : '',
  ]);

  // Totals row
  const totRow = [
    'TOTAL','','','','','','','','','',
    '',                                       // prov hrs
    rows.reduce((s,r) => s+r.billableHrs, 0),
    '',
    '','','',
    +summary.totalRevenue.toFixed(2),
    +summary.totalCost.toFixed(2),
    +summary.totalProfit.toFixed(2),
    summary.totalRevenue > 0 ? summary.totalProfit / summary.totalRevenue : 0,
    +summary.fixedBidProfit.toFixed(2),
    '','',
  ];

  const wsData  = [HDR, ...dataRows, [], totRow];
  const ws      = XLSX.utils.aoa_to_sheet(wsData);
  const lastRow = wsData.length;

  // Column widths
  ws['!cols'] = [
    {wch:14},{wch:16},{wch:18},{wch:22},{wch:18},{wch:24},{wch:12},
    {wch:18},{wch:18},{wch:18},
    {wch:11},{wch:11},{wch:11},{wch:13},{wch:10},
    {wch:13},{wch:14},{wch:14},{wch:14},{wch:10},
    {wch:14},{wch:16},{wch:16},
  ];

  // ── Sheet 2: Summary ─────────────────────────────────────────────────
  const sumData = [
    ['IntraEdge P&L Summary'],
    ['Report', filterLabel],
    ['Period', quarterLabel || 'All Time'],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Total Revenue',    +summary.totalRevenue.toFixed(2)],
    ['Total Cost',       +summary.totalCost.toFixed(2)],
    ['Gross Profit',     +summary.totalProfit.toFixed(2)],
    ['Fixed Bid Profit', +summary.fixedBidProfit.toFixed(2)],
    ['Net Profit',       +(summary.totalProfit + summary.fixedBidProfit).toFixed(2)],
    ['Margin %',         summary.margin / 100],
    [],
    ['Headcount',       summary.headcount],
    ['SOWs / Projects', summary.projectCount],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(sumData);
  wsSummary['!cols'] = [{wch:20},{wch:18}];

  XLSX.utils.book_append_sheet(wb, ws, 'P&L Detail');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sheet 3: Overhead Reference ──────────────────────────────────────
  const ohData = [
    ['Work Status','Overhead Formula','Notes'],
    ['W2',              'Pay Rate × 12.5% + $2.50 + $1.50', 'FICA + admin overhead'],
    ['C2C',             '$2.00 / hr fixed',                 'Admin cost only'],
    ['Offshore C2C',    '$2.00 / hr fixed',                 'Admin cost only'],
    ['Offshore Payroll','Pay Rate × 25%',                   '25% of INR-derived hourly cost'],
    ['Intern',          '$0.00',                            'No overhead'],
    [],
    ['Offshore Pay Rate','INR Annual CTC ÷ (Annual Hrs × FX Rate)',''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ohData), 'OH Reference');

  const filename = `PL_Report_${filterLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function PLReport() {
  const [filters, setFilters] = useState({
    dmUserId:'', amUserId:'', pmUserId:'', client:'', projectId:'', status:'ACTIVE',
    quarter:'', dateFrom:'', dateTo:'',
  });
  const [groupBy,   setGroupBy]   = useState('resource');
  const [showRates, setShowRates] = useState(true);
  const [showOff,   setShowOff]   = useState(true);
  const [sortCol,   setSortCol]   = useState('client');
  const [sortDir,   setSortDir]   = useState('asc');
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(false);

  const f = useCallback((k, v) => setFilters(p => ({ ...p, [k]: v })), []);

  // Clear date fields when quarter is set and vice versa
  const setQuarter  = v => setFilters(p => ({ ...p, quarter:v, dateFrom:'', dateTo:'' }));
  const setDateFrom = v => setFilters(p => ({ ...p, dateFrom:v, quarter:'' }));
  const setDateTo   = v => setFilters(p => ({ ...p, dateTo:v,   quarter:'' }));

  const { data: opts } = useQuery({
    queryKey:['pl-filters'], queryFn: financialsApi.filters, staleTime:60000,
  });

  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([,v]) => v && v !== 'ALL')
  );

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey:['pl-report', filters],
    queryFn:  () => financialsApi.report(activeFilters),
    staleTime: 30000,
    keepPreviousData: true,
  });

  const rows    = data?.rows    || [];
  const summary = data?.summary || {};

  // Search
  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.fullName.toLowerCase().includes(q) ||
      r.client.toLowerCase().includes(q) ||
      r.projectName.toLowerCase().includes(q) ||
      r.roleTitle.toLowerCase().includes(q) ||
      r.dmName.toLowerCase().includes(q) ||
      r.pmName?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Sort
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir==='asc' ? -1 : 1;
    if (av > bv) return sortDir==='asc' ?  1 : -1;
    return 0;
  }), [filtered, sortCol, sortDir]);

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const SortIcon = ({ col }) =>
    sortCol !== col
      ? <span style={{ opacity:0.25, marginLeft:3, fontSize:10 }}>↕</span>
      : <span style={{ color:'var(--accent)', marginLeft:3, fontSize:10 }}>{sortDir==='asc'?'↑':'↓'}</span>;

  // Grouped data
  const groupedData = useMemo(() => {
    if (groupBy === 'resource') return null;
    const key = groupBy === 'client' ? 'client' : 'dmName';
    const map = {};
    sorted.forEach(r => {
      const k = r[key] || 'Unassigned';
      if (!map[k]) map[k] = { key:k, rows:[], revenue:0, cost:0, profit:0, fixedBid:0 };
      map[k].rows.push(r);
      map[k].revenue  += r.revenue;
      map[k].cost     += r.totalCost;
      map[k].profit   += r.profit;
      map[k].fixedBid += r.fixedBidProfit || 0;
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue);
  }, [sorted, groupBy]);

  // Export labels
  const clientLabel = filters.client || (opts?.dms?.find(d=>d.id===filters.dmUserId)?.name) || 'All';
  const quarterLabel = filters.quarter || (filters.dateFrom ? `${filters.dateFrom} – ${filters.dateTo||'now'}` : '');

  const handleExport = async () => {
    setExporting(true);
    try { await exportExcel(sorted, summary, clientLabel, quarterLabel); }
    catch(e) { alert('Export failed: ' + e.message); }
    finally  { setExporting(false); }
  };

  // ── TH helper ────────────────────────────────────────────────────────
  const TH = ({ col, children, align='right' }) => (
    <th onClick={() => toggleSort(col)}
      style={{ cursor:'pointer', textAlign:align, userSelect:'none', whiteSpace:'nowrap' }}>
      {children}<SortIcon col={col}/>
    </th>
  );

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* HEADER */}
      <div className="section-header">
        <div>
          <div className="section-title">P&L Reports</div>
          <div className="section-sub">
            Staffing profitability · filter by DM, AM, PM, client, quarter, or custom date range
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting || sorted.length === 0}>
          {exporting ? '⏳ Exporting…' : '⬇ Export Excel'}
        </button>
      </div>

      {/* FILTERS CARD */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-header">
          <div className="card-title"><div className="card-dot"/>Filters</div>
          <button className="btn btn-outline btn-xs"
            onClick={() => setFilters({ dmUserId:'', amUserId:'', pmUserId:'', client:'', projectId:'', status:'ACTIVE', quarter:'', dateFrom:'', dateTo:'' })}>
            Reset All
          </button>
        </div>
        <div className="card-body">
          {/* Row 1: People filters */}
          <div className="form-grid-3" style={{ marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Delivery Manager</label>
              <select className="form-select" value={filters.dmUserId} onChange={e => f('dmUserId', e.target.value)}>
                <option value="">All DMs</option>
                {(opts?.dms||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Account Manager</label>
              <select className="form-select" value={filters.amUserId} onChange={e => f('amUserId', e.target.value)}>
                <option value="">All AMs</option>
                {(opts?.ams||[]).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Project Manager</label>
              <select className="form-select" value={filters.pmUserId} onChange={e => f('pmUserId', e.target.value)}>
                <option value="">All PMs</option>
                {(opts?.pms||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Client + Project + Status */}
          <div className="form-grid-3" style={{ marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Client</label>
              <select className="form-select" value={filters.client} onChange={e => f('client', e.target.value)}>
                <option value="">All Clients</option>
                {(opts?.clients||[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Specific Project / SOW</label>
              <select className="form-select" value={filters.projectId} onChange={e => f('projectId', e.target.value)}>
                <option value="">All Projects</option>
                {(opts?.projects||[])
                  .filter(p => !filters.client || p.client === filters.client)
                  .map(p => <option key={p.id} value={p.id}>{p.client} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">SOW Status</label>
              <select className="form-select" value={filters.status} onChange={e => f('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Row 3: Date / Quarter + View controls */}
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            {/* Quarter picker */}
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Quarter</label>
              <select className="form-select" style={{ width:140 }} value={filters.quarter} onChange={e => setQuarter(e.target.value)}>
                <option value="">Any Quarter</option>
                {quarterOptions().map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>

            {/* OR divider */}
            <div style={{ paddingBottom:8, color:'var(--muted)', fontSize:12, fontWeight:600 }}>or</div>

            {/* Custom date range */}
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Date From</label>
              <input className="form-input" type="date" style={{ width:150 }}
                value={filters.dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Date To</label>
              <input className="form-input" type="date" style={{ width:150 }}
                value={filters.dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            {/* Divider */}
            <div style={{ width:1, height:32, background:'var(--border)', alignSelf:'flex-end', marginBottom:1 }}/>

            {/* Group by */}
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Group By</label>
              <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:2 }}>
                {[['resource','Resource'],['client','Client'],['dm','DM']].map(([k,l]) => (
                  <button key={k} onClick={() => setGroupBy(k)}
                    style={{ padding:'4px 12px', borderRadius:6, fontSize:11.5, fontWeight:600,
                      background: groupBy===k ? 'var(--accent)' : 'transparent',
                      color: groupBy===k ? '#000' : 'var(--muted)',
                      border:'none', cursor:'pointer', transition:'all 0.13s', fontFamily:'var(--font-sans)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Column toggles */}
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Columns</label>
              <div style={{ display:'flex', gap:12, paddingTop:5 }}>
                {[['showRates','Rates',showRates,setShowRates],['showOff','Offshore',showOff,setShowOff]].map(([,l,val,set]) => (
                  <label key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="form-group" style={{ marginBottom:0, marginLeft:'auto' }}>
              <label className="form-label">Search</label>
              <input className="form-input" style={{ width:210 }}
                placeholder="Name, client, role, DM…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="kpi-grid" style={{ marginBottom:18 }}>
        {[
          { label:'Revenue',      value: fmt$(summary.totalRevenue),   color:'var(--accent2)',
            sub: `${summary.projectCount||0} SOW${(summary.projectCount||0)!==1?'s':''} · ${summary.headcount||0} resources` },
          { label:'Total Cost',   value: fmt$(summary.totalCost),      color:'var(--text)',    sub:'' },
          { label:'Gross Profit', value: fmt$(summary.totalProfit),    color:'var(--accent)',
            sub: (summary.fixedBidProfit||0) > 0 ? `+${fmt$(summary.fixedBidProfit)} fixed bid` : '' },
          { label:'Net Profit',   value: fmt$((summary.totalProfit||0) + (summary.fixedBidProfit||0)), color:'var(--accent)', sub:'' },
          { label:'Margin',       value: fmtPct(summary.margin),       color:(summary.margin||0)>=30?'var(--accent)':'var(--accent3)', sub:'' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color':k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontFamily:'var(--font-mono)', fontSize: 22 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Period / Filter breadcrumb */}
      {(filters.quarter || filters.dateFrom || filters.client || filters.dmUserId) && (
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          {filters.quarter && <ActiveChip label={`Quarter: ${filters.quarter}`} onRemove={() => setQuarter('')}/>}
          {filters.dateFrom && <ActiveChip label={`From: ${filters.dateFrom}`} onRemove={() => setDateFrom('')}/>}
          {filters.dateTo   && <ActiveChip label={`To: ${filters.dateTo}`}     onRemove={() => setDateTo('')}/>}
          {filters.client   && <ActiveChip label={`Client: ${filters.client}`} onRemove={() => f('client','')}/>}
          {filters.dmUserId && <ActiveChip label={`DM: ${opts?.dms?.find(d=>d.id===filters.dmUserId)?.name||'...'}`} onRemove={() => f('dmUserId','')}/>}
          {filters.amUserId && <ActiveChip label={`AM: ${opts?.ams?.find(a=>a.id===filters.amUserId)?.name||'...'}`} onRemove={() => f('amUserId','')}/>}
          {filters.pmUserId && <ActiveChip label={`PM: ${opts?.pms?.find(p=>p.id===filters.pmUserId)?.name||'...'}`} onRemove={() => f('pmUserId','')}/>}
        </div>
      )}

      {/* LOADING / ERROR / EMPTY */}
      {isLoading ? (
        <div className="empty-state"><div className="empty-text">Loading report…</div></div>
      ) : isError ? (
        <div style={{ background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.25)', borderRadius:10, padding:'16px 20px', marginBottom:14, color:'var(--danger)', fontSize:13 }}>
          ⚠ Failed to load P&L data. Check your connection or try adjusting the filters.
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">No deployments found for the selected filters.</div>
          <div className="empty-sub" style={{ marginTop:6, fontSize:12.5, color:'var(--muted)' }}>
            Try changing the SOW Status filter, or make sure resources are deployed on active SOW roles.
          </div>
        </div>
      ) : groupBy !== 'resource' ? (
        <GroupedView groups={groupedData} showRates={showRates} showOff={showOff} summary={summary} />
      ) : (
        <FlatTable rows={sorted} showRates={showRates} showOff={showOff}
          summary={summary} TH={TH} isFetching={isFetching}/>
      )}
    </div>
  );
}

// ── ACTIVE FILTER CHIP ────────────────────────────────────────────────────────
function ActiveChip({ label, onRemove }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px',
      background:'rgba(0,229,160,0.1)', border:'1px solid rgba(0,229,160,0.3)',
      borderRadius:20, fontSize:12, color:'var(--accent)', fontWeight:600 }}>
      {label}
      <span onClick={onRemove} style={{ cursor:'pointer', fontSize:13, opacity:0.7, lineHeight:1 }}>×</span>
    </div>
  );
}

// ── FLAT TABLE VIEW ───────────────────────────────────────────────────────────
function FlatTable({ rows, showRates, showOff, summary, TH, isFetching }) {
  return (
    <div className="card" style={{ opacity: isFetching ? 0.7 : 1, transition:'opacity 0.2s' }}>
      <div className="card-header">
        <div className="card-title">
          <div className="card-dot"/>Resource P&L Detail
        </div>
        <span style={{ fontSize:12.5, color:'var(--muted)' }}>
          {rows.length} deployment{rows.length!==1?'s':''}
          {isFetching && <span style={{ marginLeft:8, color:'var(--accent)', fontSize:11 }}>updating…</span>}
        </span>
      </div>
      <div className="card-body-0 table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <TH col="fullName"   align="left">Resource</TH>
              <TH col="workStatus" align="left">Type</TH>
              <TH col="roleTitle"  align="left">Role</TH>
              <TH col="client"     align="left">Client / SOW</TH>
              <TH col="dmName"     align="left">DM</TH>
              <TH col="pmName"     align="left">PM</TH>
              <TH col="provisionedHrs">Prov Hrs</TH>
              <TH col="billableHrs">Bill Hrs</TH>
              <TH col="billRate">Bill Rate</TH>
              {showRates && <TH col="payRate">Pay Rate</TH>}
              {showRates && <TH col="overhead">OH/hr</TH>}
              {showRates && <TH col="totalHrlyCost">Hrly Cost</TH>}
              <TH col="revenue">Revenue</TH>
              <TH col="totalCost">Cost</TH>
              <TH col="profit">Profit</TH>
              <TH col="marginPct">Margin</TH>
              {showOff && <TH col="offshorePayCost">Off. Pay</TH>}
              {showOff && <TH col="intraEdgeMargin">IE Margin</TH>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.resourceId}-${r.projectId}-${i}`}
                style={{ background: i%2===0 ? 'transparent' : 'rgba(128,128,128,0.018)' }}>
                <td>
                  <div style={{ fontWeight:700, fontSize:13 }}>{r.fullName}</div>
                  {r.hasActuals && <div style={{ fontSize:10, color:'var(--accent)', marginTop:1 }}>● actuals</div>}
                </td>
                <td><WorkBadge s={r.workStatus}/></td>
                <td style={{ fontSize:12.5, color:'var(--text2)' }}>{r.roleTitle}</td>
                <td>
                  <div style={{ fontWeight:600, fontSize:13 }}>{r.client}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{r.projectName}</div>
                </td>
                <td style={{ fontSize:12.5 }}>{r.dmName}</td>
                <td style={{ fontSize:12.5, color:'var(--muted)' }}>{r.pmName}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12.5 }}>{fmtNum(r.provisionedHrs)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtNum(r.billableHrs)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtRate(r.billRate)}</td>
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)' }}>{fmtRate(r.payRate)}</td>}
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent3)' }}>{fmtRate(r.overhead)}</td>}
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700 }}>{fmtRate(r.totalHrlyCost)}</td>}
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent2)', fontWeight:700 }}>{fmt$(r.revenue)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#9B4444' }}>{fmt$(r.totalCost)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:r.profit>=0?'var(--accent)':'var(--danger)' }}>{fmt$(r.profit)}</td>
                <td style={{ textAlign:'right' }}><MarginBadge v={r.marginPct}/></td>
                {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent3)':'var(--muted)' }}>
                  {r.offshorePayCost!=null ? fmt$(r.offshorePayCost) : '—'}
                </td>}
                {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent)':'var(--muted)' }}>
                  {r.intraEdgeMargin!=null ? fmt$(r.intraEdgeMargin) : '—'}
                </td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#1A2744' }}>
              <td colSpan={showRates ? 9 : 6} style={{ color:'#fff', fontWeight:800, fontSize:13, padding:'12px 16px' }}>
                TOTAL
              </td>
              {showRates && <td colSpan={3} style={{ background:'#1A2744' }}/>}
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#7DDBBD', fontWeight:800, padding:'12px 16px' }}>{fmt$(summary.totalRevenue)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#FCA5A5', fontWeight:800, padding:'12px 16px' }}>{fmt$(summary.totalCost)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#6EE7B7', fontWeight:800, padding:'12px 16px' }}>{fmt$(summary.totalProfit)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#93C5FD', fontWeight:800, padding:'12px 16px' }}>{fmtPct(summary.margin)}</td>
              {showOff && <td colSpan={2} style={{ background:'#1A2744' }}/>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── GROUPED VIEW ──────────────────────────────────────────────────────────────
function GroupedView({ groups, showRates, showOff, summary }) {
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Grand total bar */}
      <div style={{ display:'flex', gap:24, padding:'12px 20px',
        background:'#1A2744', borderRadius:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:13, flex:1, fontFamily:'var(--font-sans)' }}>
          Grand Total — {groups.length} group{groups.length!==1?'s':''}
        </span>
        {[
          { label:'Revenue', value:fmt$(summary.totalRevenue),  color:'#7DDBBD' },
          { label:'Cost',    value:fmt$(summary.totalCost),     color:'#FCA5A5' },
          { label:'Profit',  value:fmt$(summary.totalProfit),   color:'#6EE7B7' },
          { label:'Margin',  value:fmtPct(summary.margin),      color:'#93C5FD' },
        ].map(s => (
          <div key={s.label} style={{ textAlign:'right' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2, fontWeight:600 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {groups.map(g => {
        const isOpen = !!expanded[g.key];
        const margin = g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0;
        return (
          <div key={g.key} className="card">
            {/* Group header */}
            <div onClick={() => toggle(g.key)} style={{
              padding:'14px 20px', cursor:'pointer', display:'flex',
              alignItems:'center', gap:14, background:'var(--surface2)',
              borderRadius: isOpen ? '10px 10px 0 0' : 10,
              borderBottom: isOpen ? '1px solid var(--border)' : 'none',
              transition:'all 0.13s',
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{g.key}</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                  {g.rows.length} resource{g.rows.length!==1?'s':''}
                  {g.fixedBid > 0 && <span style={{ marginLeft:8, color:'var(--accent3)' }}>+{fmt$(g.fixedBid)} fixed bid</span>}
                </div>
              </div>
              {[
                { label:'Revenue', value:fmt$(g.revenue),  color:'var(--accent2)' },
                { label:'Cost',    value:fmt$(g.cost),     color:'var(--text2)' },
                { label:'Profit',  value:fmt$(g.profit),   color:g.profit>=0?'var(--accent)':'var(--danger)' },
                { label:'Margin',  value:fmtPct(margin),   color:margin>=30?'var(--accent)':'var(--accent3)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'right', minWidth:100 }}>
                  <div style={{ fontSize:10.5, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3, fontWeight:600 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)' }}>{s.value}</div>
                </div>
              ))}
              <span style={{ fontSize:12, color:'var(--muted)', marginLeft:4 }}>{isOpen?'▲':'▼'}</span>
            </div>

            {isOpen && (
              <div className="card-body-0 table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th style={{ textAlign:'left' }}>Resource</th>
                    <th style={{ textAlign:'left' }}>Type</th>
                    <th style={{ textAlign:'left' }}>Role</th>
                    <th style={{ textAlign:'left' }}>Client / SOW</th>
                    <th style={{ textAlign:'left' }}>DM / PM</th>
                    <th style={{ textAlign:'right' }}>Bill Hrs</th>
                    <th style={{ textAlign:'right' }}>Bill Rate</th>
                    {showRates && <th style={{ textAlign:'right' }}>Pay Rate</th>}
                    {showRates && <th style={{ textAlign:'right' }}>OH/hr</th>}
                    <th style={{ textAlign:'right' }}>Revenue</th>
                    <th style={{ textAlign:'right' }}>Cost</th>
                    <th style={{ textAlign:'right' }}>Profit</th>
                    <th style={{ textAlign:'right' }}>Margin</th>
                    {showOff && <th style={{ textAlign:'right' }}>Off. Pay</th>}
                    {showOff && <th style={{ textAlign:'right' }}>IE Margin</th>}
                  </tr></thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={i} style={{ background: i%2===0?'transparent':'rgba(128,128,128,0.018)' }}>
                        <td>
                          <div style={{ fontWeight:700, fontSize:13 }}>{r.fullName}</div>
                          {r.hasActuals && <div style={{ fontSize:10, color:'var(--accent)' }}>● actuals</div>}
                        </td>
                        <td><WorkBadge s={r.workStatus}/></td>
                        <td style={{ fontSize:12.5, color:'var(--text2)' }}>{r.roleTitle}</td>
                        <td>
                          <div style={{ fontWeight:600, fontSize:13 }}>{r.client}</div>
                          <div style={{ fontSize:11, color:'var(--muted)' }}>{r.projectName}</div>
                        </td>
                        <td>
                          <div style={{ fontSize:12.5 }}>{r.dmName}</div>
                          <div style={{ fontSize:11, color:'var(--muted)' }}>{r.pmName}</div>
                        </td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtNum(r.billableHrs)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtRate(r.billRate)}</td>
                        {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>{fmtRate(r.payRate)}</td>}
                        {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent3)' }}>{fmtRate(r.overhead)}</td>}
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent2)', fontWeight:700 }}>{fmt$(r.revenue)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#9B4444' }}>{fmt$(r.totalCost)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:r.profit>=0?'var(--accent)':'var(--danger)' }}>{fmt$(r.profit)}</td>
                        <td style={{ textAlign:'right' }}><MarginBadge v={r.marginPct}/></td>
                        {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent3)':'var(--muted)' }}>
                          {r.offshorePayCost!=null ? fmt$(r.offshorePayCost) : '—'}
                        </td>}
                        {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent)':'var(--muted)' }}>
                          {r.intraEdgeMargin!=null ? fmt$(r.intraEdgeMargin) : '—'}
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                  {/* Group subtotal */}
                  <tfoot>
                    <tr style={{ background:'rgba(26,39,68,0.85)' }}>
                      <td colSpan={showRates?7:5} style={{ color:'#fff', fontWeight:700, fontSize:12, padding:'10px 14px' }}>
                        Subtotal — {g.key}
                      </td>
                      {showRates && <td colSpan={2} style={{ background:'rgba(26,39,68,0.85)' }}/>}
                      <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'#7DDBBD', fontWeight:700, padding:'10px 14px' }}>{fmt$(g.revenue)}</td>
                      <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'#FCA5A5', fontWeight:700, padding:'10px 14px' }}>{fmt$(g.cost)}</td>
                      <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'#6EE7B7', fontWeight:700, padding:'10px 14px' }}>{fmt$(g.profit)}</td>
                      <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'#93C5FD', fontWeight:700, padding:'10px 14px' }}>{fmtPct(margin)}</td>
                      {showOff && <td colSpan={2} style={{ background:'rgba(26,39,68,0.85)' }}/>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
