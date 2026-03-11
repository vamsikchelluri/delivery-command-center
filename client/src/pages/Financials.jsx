// pages/Financials.jsx — P&L Reports
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialsApi } from '../lib/api';
import { fmtUSD } from '../lib/costEngine';
import { exportPLtoExcel } from '../lib/excelExport';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (v, dec=2) => v == null ? '—' : `$${Number(v).toFixed(dec)}`;
const fmtN = (v)        => v == null ? '—' : Number(v).toLocaleString();
const fmtP = (v)        => v == null ? '—' : `${Number(v).toFixed(1)}%`;

// Generate quarter options — last 8 quarters
function quarterOptions() {
  const opts = [];
  const now  = new Date();
  let year   = now.getFullYear();
  let q      = Math.ceil((now.getMonth() + 1) / 3);
  for (let i = 0; i < 8; i++) {
    opts.push(`${year}-Q${q}`);
    q--;
    if (q === 0) { q = 4; year--; }
  }
  return opts;
}

const QUARTER_OPTS = quarterOptions();

const STATUS_STYLE = {
  'C2C':              { bg:'#EBF3FF', color:'#5B21B6' },
  'Offshore C2C':     { bg:'#F3ECFF', color:'#0052CC' },
  'W2':               { bg:'#EBF9F0', color:'#065F46' },
  'Offshore Payroll': { bg:'#FFF8E8', color:'#92400E' },
  'Intern':           { bg:'#F5F5F5', color:'#4B5563' },
};

function Badge({ label }) {
  const s = STATUS_STYLE[label] || { bg:'#F0F0F0', color:'#555' };
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20,
      fontSize:10.5, fontWeight:700, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}

function MarginChip({ v }) {
  const color = v >= 35 ? 'var(--accent)' : v >= 20 ? 'var(--accent3)' : v >= 0 ? 'var(--text2)' : 'var(--danger)';
  return <span style={{ fontWeight:800, color, fontFamily:'var(--font-mono)', fontSize:13 }}>{fmtP(v)}</span>;
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Financials() {
  const [filters, setFilters] = useState({
    dmUserId:'', amUserId:'', pmUserId:'', client:'', projectId:'', status:'ACTIVE',
    quarter:'', dateFrom:'', dateTo:'',
  });
  const [dateMode, setDateMode] = useState('quarter'); // 'quarter' | 'range' | 'all'
  const [groupBy,  setGroupBy]  = useState('resource');
  const [showRates, setShowRates] = useState(true);
  const [showOff,   setShowOff]   = useState(true);
  const [sortCol,  setSortCol]  = useState('client');
  const [sortDir,  setSortDir]  = useState('asc');
  const [search,   setSearch]   = useState('');

  const f = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  // Derive API query params from filter state + dateMode
  const queryParams = useMemo(() => {
    const p = Object.fromEntries(Object.entries(filters).filter(([,v]) => v && v !== 'ALL'));
    if (dateMode === 'all') { delete p.quarter; delete p.dateFrom; delete p.dateTo; }
    if (dateMode === 'quarter') { delete p.dateFrom; delete p.dateTo; }
    if (dateMode === 'range')   { delete p.quarter; }
    return p;
  }, [filters, dateMode]);

  const { data: opts } = useQuery({
    queryKey: ['pl-filters'],
    queryFn:  financialsApi.filters,
    staleTime: 120000,
  });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pl-report', queryParams],
    queryFn:  () => financialsApi.report(queryParams),
    staleTime: 30000,
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
      r.workStatus.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Sort
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  }), [filtered, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }
  const SI = ({ col }) => sortCol !== col
    ? <span style={{ opacity:.2, marginLeft:3 }}>↕</span>
    : <span style={{ color:'var(--accent)', marginLeft:3 }}>{sortDir==='asc'?'↑':'↓'}</span>;

  // Grouped data
  const groupedData = useMemo(() => {
    if (groupBy === 'resource') return null;
    const key = groupBy === 'client' ? 'client' : groupBy === 'dm' ? 'dmName' : groupBy === 'am' ? 'amName' : 'pmName';
    const map = {};
    sorted.forEach(r => {
      const k = r[key] || 'Unassigned';
      if (!map[k]) map[k] = { key:k, rows:[], revenue:0, cost:0, profit:0, fixedBid:0 };
      map[k].rows.push(r);
      map[k].revenue  += r.revenue;
      map[k].cost     += r.totalCost;
      map[k].profit   += r.profit;
      map[k].fixedBid += r.fixedBidProfit;
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue);
  }, [sorted, groupBy]);

  // Export label
  const exportLabel = filters.client
    || opts?.dms?.find(d=>d.id===filters.dmUserId)?.name
    || opts?.ams?.find(a=>a.id===filters.amUserId)?.name
    || opts?.pms?.find(p=>p.id===filters.pmUserId)?.name
    || 'All';
  const quarterLabel = dateMode === 'quarter' && filters.quarter ? filters.quarter
    : dateMode === 'range' && filters.dateFrom ? `${filters.dateFrom} → ${filters.dateTo}`
    : 'All Dates';

  const resetFilters = () => {
    setFilters({ dmUserId:'', amUserId:'', pmUserId:'', client:'', projectId:'', status:'ACTIVE', quarter:'', dateFrom:'', dateTo:'' });
    setDateMode('quarter');
    setSearch('');
  };

  const TH = ({ col, children, align='right' }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor:'pointer', textAlign:align, userSelect:'none', whiteSpace:'nowrap' }}>
      {children}<SI col={col} />
    </th>
  );

  // ── KPI derived summary including filtered rows
  const filteredSummary = useMemo(() => {
    const rev  = sorted.reduce((s,r) => s + r.revenue, 0);
    const cost = sorted.reduce((s,r) => s + r.totalCost, 0);
    const prof = sorted.reduce((s,r) => s + r.profit, 0);
    const fb   = sorted.reduce((s,r) => s + r.fixedBidProfit, 0);
    return { rev, cost, prof, fb,
      margin: rev > 0 ? ((prof + fb) / rev * 100) : 0,
      headcount: new Set(sorted.map(r=>r.resourceId)).size,
      projects:  new Set(sorted.map(r=>r.projectId)).size,
    };
  }, [sorted]);

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="section-header">
        <div>
          <div className="section-title">P&L Reports</div>
          <div className="section-sub">Staffing profitability · filter by DM, AM, PM, client, or date range</div>
        </div>
        <button className="btn btn-primary btn-sm"
          disabled={sorted.length === 0}
          onClick={() => exportPLtoExcel(sorted, filteredSummary, exportLabel, quarterLabel)}>
          ⬇ Export Excel
        </button>
      </div>

      {/* ── FILTER PANEL ── */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header">
          <div className="card-title"><div className="card-dot"/>Filters</div>
          <button className="btn btn-outline btn-xs" onClick={resetFilters}>↺ Reset</button>
        </div>
        <div className="card-body">

          {/* Row 1: People filters */}
          <div className="form-grid-3" style={{ marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Delivery Manager</label>
              <select className="form-select" value={filters.dmUserId} onChange={e => f('dmUserId',e.target.value)}>
                <option value="">All DMs</option>
                {(opts?.dms||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Account Manager</label>
              <select className="form-select" value={filters.amUserId} onChange={e => f('amUserId',e.target.value)}>
                <option value="">All AMs</option>
                {(opts?.ams||[]).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Project Manager</label>
              <select className="form-select" value={filters.pmUserId} onChange={e => f('pmUserId',e.target.value)}>
                <option value="">All PMs</option>
                {(opts?.pms||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Client, SOW, Status */}
          <div className="form-grid-3" style={{ marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Client</label>
              <select className="form-select" value={filters.client} onChange={e => f('client',e.target.value)}>
                <option value="">All Clients</option>
                {(opts?.clients||[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">SOW / Project</label>
              <select className="form-select" value={filters.projectId} onChange={e => f('projectId',e.target.value)}>
                <option value="">All SOWs</option>
                {(opts?.projects||[])
                  .filter(p => !filters.client || p.client === filters.client)
                  .map(p => <option key={p.id} value={p.id}>{p.client} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">SOW Status</label>
              <select className="form-select" value={filters.status} onChange={e => f('status',e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Row 3: Date range */}
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <label className="form-label" style={{ margin:0 }}>Date Range</label>
            <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:2 }}>
              {[['all','All Time'],['quarter','By Quarter'],['range','Custom Range']].map(([k,l]) => (
                <button key={k} onClick={() => setDateMode(k)}
                  style={{ padding:'4px 11px', borderRadius:6, fontSize:11.5, fontWeight:600,
                    background: dateMode===k ? 'var(--accent)' : 'none',
                    color: dateMode===k ? '#000' : 'var(--muted)',
                    border:'none', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  {l}
                </button>
              ))}
            </div>

            {dateMode === 'quarter' && (
              <select className="form-select" style={{ width:'auto' }}
                value={filters.quarter} onChange={e => f('quarter',e.target.value)}>
                <option value="">Select quarter…</option>
                {QUARTER_OPTS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            )}
            {dateMode === 'range' && (
              <>
                <input className="form-input" type="date" style={{ width:150 }}
                  value={filters.dateFrom} onChange={e => f('dateFrom',e.target.value)} />
                <span style={{ color:'var(--muted)', fontSize:12 }}>to</span>
                <input className="form-input" type="date" style={{ width:150 }}
                  value={filters.dateTo} onChange={e => f('dateTo',e.target.value)} />
              </>
            )}

            {/* Group by */}
            <div style={{ marginLeft:12, display:'flex', alignItems:'center', gap:7 }}>
              <label className="form-label" style={{ margin:0 }}>Group by</label>
              <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:2, gap:2 }}>
                {[['resource','Resource'],['client','Client'],['dm','DM'],['am','AM'],['pm','PM']].map(([k,l]) => (
                  <button key={k} onClick={() => setGroupBy(k)}
                    style={{ padding:'4px 9px', borderRadius:6, fontSize:11, fontWeight:600,
                      background: groupBy===k ? 'var(--accent2)' : 'none',
                      color: groupBy===k ? '#fff' : 'var(--muted)',
                      border:'none', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Column toggles */}
            <div style={{ display:'flex', gap:10, marginLeft:8 }}>
              {[['showRates','Rates',showRates,setShowRates],['showOff','Offshore',showOff,setShowOff]].map(([,l,val,set]) => (
                <label key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />{l}
                </label>
              ))}
            </div>

            {/* Search */}
            <input className="form-input" style={{ width:200, marginLeft:'auto' }}
              placeholder="Search name, client, role…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="kpi-grid" style={{ marginBottom:16 }}>
        {[
          { label:'Total Revenue',  value:fmtUSD(filteredSummary.rev),    color:'var(--accent2)', sub:`${filteredSummary.projects} SOWs · ${filteredSummary.headcount} resources` },
          { label:'Total Cost',     value:fmtUSD(filteredSummary.cost),   color:'var(--text)',    sub:'' },
          { label:'Net Profit',     value:fmtUSD(filteredSummary.prof),   color: filteredSummary.prof >= 0 ? 'var(--accent)' : 'var(--danger)',
            sub: filteredSummary.fb > 0 ? `+${fmtUSD(filteredSummary.fb)} fixed bid` : '' },
          { label:'Margin',         value:fmtP(filteredSummary.margin),   color: filteredSummary.margin >= 30 ? 'var(--accent)' : 'var(--accent3)', sub:'' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color':k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontFamily:'var(--font-mono)' }}>{k.value}</div>
            {k.sub && <div className="kpi-delta" style={{ color:'var(--muted)', fontSize:11 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── CONTENT ── */}
      {isLoading ? (
        <div className="empty-state"><div className="empty-text">Loading P&L data…</div></div>
      ) : isError ? (
        <div style={{ padding:'18px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'var(--danger)', fontSize:13, marginBottom:14 }}>
          Failed to load P&L data. Check API connection.
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">No deployments match the current filters.<br/>Try changing Status to "All" or removing the date filter.</div>
        </div>
      ) : groupBy !== 'resource' ? (
        <GroupedView groups={groupedData} showRates={showRates} showOff={showOff} />
      ) : (
        <FlatTable rows={sorted} showRates={showRates} showOff={showOff}
          toggleSort={toggleSort} SI={SI} filteredSummary={filteredSummary} />
      )}
    </div>
  );
}

// ── FLAT TABLE ───────────────────────────────────────────────────────────────
function FlatTable({ rows, showRates, showOff, toggleSort, SI, filteredSummary }) {
  const TH = ({ col, children, align='right' }) => (
    <th onClick={() => toggleSort(col)} style={{ cursor:'pointer', textAlign:align, userSelect:'none', whiteSpace:'nowrap' }}>
      {children}<SI col={col} />
    </th>
  );
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><div className="card-dot"/>Resource P&L Detail</div>
        <span style={{ fontSize:12, color:'var(--muted)' }}>{rows.length} deployment{rows.length!==1?'s':''}</span>
      </div>
      <div className="card-body-0 table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <TH col="fullName"    align="left">Resource</TH>
              <TH col="workStatus"  align="left">Type</TH>
              <TH col="roleTitle"   align="left">Role</TH>
              <TH col="client"      align="left">Client / SOW</TH>
              <TH col="dmName"      align="left">DM</TH>
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
                  style={{ background: i%2===0?'transparent':'rgba(128,128,128,0.022)' }}>
                <td>
                  <div style={{ fontWeight:700, fontSize:13.5 }}>{r.fullName}</div>
                  {r.hasActuals && <div style={{ fontSize:10, color:'var(--accent)', marginTop:1 }}>● actuals</div>}
                </td>
                <td><Badge label={r.workStatus}/></td>
                <td style={{ fontSize:12.5, color:'var(--text2)' }}>{r.roleTitle}</td>
                <td>
                  <div style={{ fontWeight:600, fontSize:13 }}>{r.client}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{r.projectName}</div>
                </td>
                <td style={{ fontSize:12.5 }}>{r.dmName}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtN(r.billableHrs)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmt(r.billRate,0)}</td>
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text2)' }}>{fmt(r.payRate)}</td>}
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent3)' }}>{fmt(r.overhead)}</td>}
                {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600 }}>{fmt(r.totalHrlyCost)}</td>}
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent2)', fontWeight:700 }}>{fmtUSD(r.revenue)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#9B4444' }}>{fmtUSD(r.totalCost)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700,
                  color: r.profit>=0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtUSD(r.profit)}</td>
                <td style={{ textAlign:'right' }}><MarginChip v={r.marginPct}/></td>
                {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12,
                  color:r.isOffshore?'var(--accent3)':'var(--muted)' }}>
                  {r.offshorePayCost!=null ? fmtUSD(r.offshorePayCost) : '—'}
                </td>}
                {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12,
                  color:r.isOffshore?'var(--accent)':'var(--muted)' }}>
                  {r.intraEdgeMargin!=null ? fmtUSD(r.intraEdgeMargin) : '—'}
                </td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#1A2744' }}>
              <td colSpan={5} style={{ color:'#fff', fontWeight:800, fontSize:13, padding:'12px 16px' }}>TOTAL</td>
              <td colSpan={showRates?5:2} style={{ background:'#1A2744' }}/>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#7DDBBD', fontWeight:800, padding:'12px 16px' }}>{fmtUSD(filteredSummary.rev)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#FCA5A5', fontWeight:800, padding:'12px 16px' }}>{fmtUSD(filteredSummary.cost)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#6EE7B7', fontWeight:800, padding:'12px 16px' }}>{fmtUSD(filteredSummary.prof)}</td>
              <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'#93C5FD', fontWeight:800, padding:'12px 16px' }}>{fmtP(filteredSummary.margin)}</td>
              {showOff && <td colSpan={2} style={{ background:'#1A2744' }}/>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── GROUPED VIEW ──────────────────────────────────────────────────────────────
function GroupedView({ groups, showRates, showOff }) {
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]:!p[k] }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {(groups||[]).map(g => {
        const isOpen = !!expanded[g.key];
        const margin = g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0;
        return (
          <div key={g.key} className="card">
            <div onClick={() => toggle(g.key)} style={{
              padding:'14px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:16,
              background:'var(--surface2)', borderBottom: isOpen ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>{g.key}</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{g.rows.length} resource{g.rows.length!==1?'s':''}</div>
              </div>
              {[
                { label:'Revenue', value:fmtUSD(g.revenue), color:'var(--accent2)' },
                { label:'Cost',    value:fmtUSD(g.cost),    color:'var(--text2)' },
                { label:'Profit',  value:fmtUSD(g.profit),  color:g.profit>=0?'var(--accent)':'var(--danger)' },
                { label:'Margin',  value:fmtP(margin),      color:margin>=30?'var(--accent)':'var(--accent3)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'right', minWidth:105 }}>
                  <div style={{ fontSize:10.5, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600, marginBottom:2 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)' }}>{s.value}</div>
                </div>
              ))}
              <span style={{ fontSize:13, color:'var(--muted)' }}>{isOpen?'▲':'▼'}</span>
            </div>

            {isOpen && (
              <div className="card-body-0 table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th style={{ textAlign:'left' }}>Resource</th>
                    <th style={{ textAlign:'left' }}>Type</th>
                    <th style={{ textAlign:'left' }}>Role</th>
                    <th style={{ textAlign:'left' }}>Client / SOW</th>
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
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight:700, fontSize:13 }}>{r.fullName}</div>
                          {r.hasActuals && <div style={{ fontSize:10, color:'var(--accent)' }}>● actuals</div>}
                        </td>
                        <td><Badge label={r.workStatus}/></td>
                        <td style={{ fontSize:12.5 }}>{r.roleTitle}</td>
                        <td>
                          <div style={{ fontWeight:600, fontSize:13 }}>{r.client}</div>
                          <div style={{ fontSize:11, color:'var(--muted)' }}>{r.projectName}</div>
                        </td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmtN(r.billableHrs)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--accent2)' }}>{fmt(r.billRate,0)}</td>
                        {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>{fmt(r.payRate)}</td>}
                        {showRates && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent3)' }}>{fmt(r.overhead)}</td>}
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent2)', fontWeight:700 }}>{fmtUSD(r.revenue)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12.5, color:'#9B4444' }}>{fmtUSD(r.totalCost)}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:r.profit>=0?'var(--accent)':'var(--danger)' }}>{fmtUSD(r.profit)}</td>
                        <td style={{ textAlign:'right' }}><MarginChip v={r.marginPct}/></td>
                        {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent3)':'var(--muted)' }}>
                          {r.offshorePayCost!=null?fmtUSD(r.offshorePayCost):'—'}
                        </td>}
                        {showOff && <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:r.isOffshore?'var(--accent)':'var(--muted)' }}>
                          {r.intraEdgeMargin!=null?fmtUSD(r.intraEdgeMargin):'—'}
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
