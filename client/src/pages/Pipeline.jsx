// src/pages/Pipeline.jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, resourcesApi } from '../lib/api';
import { usersApi } from '../lib/auth';
import { fmtUSD } from '../lib/costEngine';
import { format, differenceInDays, differenceInWeeks, parseISO } from 'date-fns';

const ACTIVE_STAGES = ['QUALIFYING','PROPOSED','NEGOTIATING','WON','LOST'];
const ALL_STAGES    = ['QUALIFYING','PROPOSED','NEGOTIATING','WON','LOST','ON_HOLD','INACTIVE','ARCHIVED'];
const STAGE_LABELS  = {
  QUALIFYING:'Qualifying', PROPOSED:'Proposed', NEGOTIATING:'Negotiating',
  WON:'Won', LOST:'Lost', ON_HOLD:'On Hold', INACTIVE:'Inactive', ARCHIVED:'Archived',
};
const STAGE_COLORS = {
  QUALIFYING:'badge-gray', PROPOSED:'badge-blue', NEGOTIATING:'badge-yellow',
  WON:'badge-green', LOST:'badge-red', ON_HOLD:'badge-yellow', INACTIVE:'badge-gray', ARCHIVED:'badge-gray',
};
const STAGE_PROB = { QUALIFYING:20, PROPOSED:40, NEGOTIATING:70, WON:100, LOST:0, ON_HOLD:0, INACTIVE:0, ARCHIVED:0 };
const SOURCE_LABELS = { EXISTING_ACCOUNT:'Existing Account', REFERRAL:'Referral', RFP:'RFP', COLD_OUTREACH:'Cold Outreach', PARTNER:'Partner' };
const EXP_LABELS    = { JUNIOR:'Junior', MEDIUM:'Medium', SENIOR:'Senior' };
const STATUS_COLORS = { OPEN:'badge-gray', IDENTIFIED:'badge-yellow', CONFIRMED:'badge-green' };

function fmtDate(d) { return d ? format(parseISO(d.split('T')[0]), 'dd MMM yyyy') : '—'; }
function ageLabel(d) {
  const days = differenceInDays(new Date(), new Date(d));
  if (days === 0) return 'Today';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}
function durationWeeks(start, end) {
  if (!start || !end) return null;
  const w = differenceInWeeks(parseISO(end.split('T')[0]), parseISO(start.split('T')[0]));
  return w > 0 ? `${w}w` : null;
}
function computeOppTotals(opp) {
  let revenue = 0, cost = 0;
  (opp.roles || []).forEach(r => {
    const hrs = r.totalHours || 0;
    revenue += hrs * (r.billRate || 0);
    cost    += hrs * (r.costGuidance || 0);
  });
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  const weighted  = revenue * ((opp.probability || 0) / 100);
  return { revenue, cost, margin, marginPct, weighted };
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Pipeline() {
  const qc = useQueryClient();
  const [viewMode,     setViewMode]     = useState('table');
  const [view,         setView]         = useState('list');
  const [activeId,     setActiveId]     = useState(null);
  const [stageFilter,  setStageFilter]  = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ['pipeline', stageFilter, showInactive],
    queryFn:  () => pipelineApi.list(stageFilter ? { stage: stageFilter } : {}),
  });

  const visibleOpps = showInactive
    ? opps
    : opps.filter(o => !['INACTIVE','ARCHIVED'].includes(o.stage));

  function openDetail(id) { setActiveId(id); setView('detail'); }
  function backToList()   { setActiveId(null); setView('list'); }

  if (view === 'add')    return <OppForm onBack={() => setView('list')} onSaved={() => { qc.invalidateQueries({ queryKey: ['pipeline'] }); setView('list'); }} />;
  if (view === 'detail') return <OppDetail oppId={activeId} onBack={backToList} />;

  const activeCount = opps.filter(o => !['WON','LOST','INACTIVE','ARCHIVED'].includes(o.stage)).length;
  const totals = {
    active:   activeCount,
    weighted: visibleOpps.reduce((s, o) => s + computeOppTotals(o).weighted, 0),
    won:      opps.filter(o => o.stage === 'WON').reduce((s, o) => s + computeOppTotals(o).revenue, 0),
    total:    visibleOpps.reduce((s, o) => s + computeOppTotals(o).revenue, 0),
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Pipeline</div>
          <div className="section-sub">Opportunities · pre-SOW · staffing requirements</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, padding:3, gap:2 }}>
            {[['table','⊟ Table'],['kanban','⊞ Kanban']].map(([mode,label]) => (
              <button key={mode}
                style={{ padding:'5px 13px', borderRadius:7, fontSize:12, fontWeight:600, fontFamily:'var(--font-sans)',
                  background: viewMode===mode ? 'var(--accent)' : 'none',
                  color: viewMode===mode ? '#000' : 'var(--muted)',
                  border:'none', cursor:'pointer', transition:'all 0.15s' }}
                onClick={() => setViewMode(mode)}>{label}</button>
            ))}
          </div>
          <select className="form-select" style={{ width:'auto' }} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All Active Stages</option>
            {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => setShowInactive(v => !v)}>
            {showInactive ? '👁 Hide Inactive' : '👁 Show Inactive'}
          </button>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ New Opportunity</button>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { label:'Active Opps',       value: totals.active,           color:'var(--accent)',  icon:'📡', mono:false },
          { label:'Weighted Pipeline', value: fmtUSD(totals.weighted), color:'var(--accent2)', icon:'⚖',  mono:true  },
          { label:'Total Pipeline',    value: fmtUSD(totals.total),    color:'var(--text)',     icon:'📊', mono:true  },
          { label:'Won Revenue',       value: fmtUSD(totals.won),      color:'var(--accent)',  icon:'🏆', mono:true  },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color':k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontFamily:k.mono?'var(--font-mono)':'inherit' }}>{k.value}</div>
            <div className="kpi-icon">{k.icon}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="empty-state"><div className="empty-text">Loading…</div></div>
      : visibleOpps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-text">No opportunities yet. Click "+ New Opportunity" to add your first.</div>
        </div>
      ) : viewMode === 'table' ? (
        <TableView opps={visibleOpps} onOpen={openDetail} qc={qc} />
      ) : (
        <KanbanView opps={visibleOpps} onOpen={openDetail} qc={qc} />
      )}
    </div>
  );
}

// ── TABLE VIEW ───────────────────────────────────────────────────────────────
function TableView({ opps, onOpen, qc }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><div className="card-dot" />Opportunity Register</div>
        <span style={{ fontSize:13, color:'var(--muted)', fontWeight:500 }}>{opps.length} opportunities</span>
      </div>
      <div className="card-body-0 table-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Client / Project</th><th>Stage</th><th>Source</th>
            <th>Timeline</th><th>Roles</th>
            <th>Revenue</th><th>Margin</th><th>Prob.</th><th>Weighted</th>
            <th>Age</th><th></th>
          </tr></thead>
          <tbody>
            {opps.map(o => {
              const pl  = computeOppTotals(o);
              const dur = durationWeeks(o.startDate, o.endDate);
              const filled = (o.roles||[]).filter(r => r.status !== 'OPEN').length;
              const isInactive = ['INACTIVE','ARCHIVED','LOST'].includes(o.stage);
              return (
                <tr key={o.id} style={{ cursor:'pointer', opacity: isInactive ? 0.55 : 1 }} onClick={() => onOpen(o.id)}>
                  <td>
                    <div style={{ fontWeight:700, fontSize:14 }}>{o.client}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{o.name}</div>
                  </td>
                  <td><span className={`badge ${STAGE_COLORS[o.stage]}`}><span className="badge-dot" />{STAGE_LABELS[o.stage]}</span></td>
                  <td style={{ fontSize:12.5, color:'var(--muted)' }}>{SOURCE_LABELS[o.source] || '—'}</td>
                  <td>
                    <div style={{ fontSize:12.5 }}>{fmtDate(o.startDate)}</div>
                    {dur && <div style={{ fontSize:11, color:'var(--muted)' }}>{dur}</div>}
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>{filled}</span>
                    <span style={{ color:'var(--muted)', fontSize:12 }}>/{(o.roles||[]).length}</span>
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600 }}>{fmtUSD(pl.revenue)}</td>
                  <td>
                    <span style={{ fontWeight:700, fontSize:13, color: pl.marginPct>=30?'var(--accent)':pl.marginPct>=15?'var(--accent3)':'var(--danger)' }}>
                      {pl.marginPct.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ minWidth:100 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ flex:1, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:`${o.probability}%`, height:'100%', background:'var(--accent)', borderRadius:3 }} />
                      </div>
                      <span style={{ fontSize:12, fontFamily:'var(--font-mono)', minWidth:30, fontWeight:600 }}>{o.probability}%</span>
                    </div>
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent2)', fontWeight:600 }}>{fmtUSD(pl.weighted)}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{ageLabel(o.createdAt)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-accent btn-xs" onClick={() => onOpen(o.id)}>Open →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── KANBAN VIEW ──────────────────────────────────────────────────────────────
function KanbanView({ opps, onOpen, qc }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, overflowX:'auto' }}>
      {ACTIVE_STAGES.map(stage => {
        const cards = opps.filter(o => o.stage === stage);
        const total = cards.reduce((s, o) => s + computeOppTotals(o).revenue, 0);
        return (
          <div key={stage}>
            <div style={{ padding:'8px 12px 10px', marginBottom:8, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className={`badge ${STAGE_COLORS[stage]}`}><span className="badge-dot" />{STAGE_LABELS[stage]}</span>
                <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--font-mono)' }}>{cards.length}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--font-mono)', marginTop:5, color:'var(--text2)' }}>{fmtUSD(total)}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {cards.map(o => {
                const pl = computeOppTotals(o);
                return (
                  <div key={o.id} onClick={() => onOpen(o.id)}
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 13px', cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)';  e.currentTarget.style.transform='none'; }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{o.client}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>{o.name}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                      <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent2)', fontWeight:600 }}>{fmtUSD(pl.revenue)}</span>
                      <span style={{ color:'var(--muted)' }}>{o.probability}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── OPPORTUNITY DETAIL ───────────────────────────────────────────────────────
function OppDetail({ oppId, onBack }) {
  const qc = useQueryClient();
  const [activeTab,    setActiveTab]    = useState('overview');
  const [showAddRole,  setShowAddRole]  = useState(false);
  const [editingRole,  setEditingRole]  = useState(null);

  const { data: opp, isLoading } = useQuery({
    queryKey: ['opp', oppId],
    queryFn:  () => pipelineApi.get(oppId),
    refetchInterval: 15000,
  });
  const { data: resources = [] } = useQuery({ queryKey:['resources'], queryFn:() => resourcesApi.list() });

  const updateMut = useMutation({
    mutationFn: (data) => pipelineApi.update(oppId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['opp', oppId] }),
  });
  const convertMut = useMutation({
    mutationFn: () => pipelineApi.convert(oppId),
    onSuccess:  (proj) => {
      qc.invalidateQueries({ queryKey:['pipeline'] });
      qc.invalidateQueries({ queryKey:['projects'] });
      alert(`✅ Converted to SOW — "${proj.name}". Go to Projects to view and complete the SOW.`);
      onBack();
    },
  });

  if (isLoading || !opp) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const pl   = computeOppTotals(opp);
  const dur  = durationWeeks(opp.startDate, opp.endDate);
  const days = differenceInDays(new Date(), new Date(opp.createdAt));
  const isWon = opp.stage === 'WON';
  const alreadyConverted = !!opp.convertedAt;

  return (
    <div>
      <div className="section-header">
        <div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>
            <span style={{ cursor:'pointer', color:'var(--accent)' }} onClick={onBack}>Pipeline</span> / {opp.client}
          </div>
          <div className="section-title">{opp.client} — {opp.name}</div>
          <div className="section-sub">
            {SOURCE_LABELS[opp.source]} · Open for {days}d
            {dur && <span style={{ marginLeft:8 }}>· {dur}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span className={`badge ${STAGE_COLORS[opp.stage]}`}><span className="badge-dot" />{STAGE_LABELS[opp.stage]}</span>
          <select className="form-select" style={{ width:'auto' }} value={opp.stage}
            onChange={e => updateMut.mutate({ stage:e.target.value, probability:STAGE_PROB[e.target.value] })}>
            {ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          {isWon && !alreadyConverted && (
            <button className="btn btn-primary" disabled={convertMut.isPending}
              onClick={() => { if (window.confirm('Convert this Won opportunity to a SOW? The opportunity record stays for reference.')) convertMut.mutate(); }}>
              {convertMut.isPending ? 'Converting…' : '🏆 Convert to SOW →'}
            </button>
          )}
          {alreadyConverted && <span className="badge badge-green">✓ Converted to SOW</span>}
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>

      {convertMut.isError && (
        <div className="alert alert-danger" style={{ marginBottom:14 }}>
          Convert failed: {convertMut.error?.error || 'Unknown error'}
        </div>
      )}

      {/* P&L strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Est. Revenue',   value:fmtUSD(pl.revenue),          color:'var(--accent2)' },
          { label:'Est. Cost',      value:fmtUSD(pl.cost),             color:'var(--text)' },
          { label:'Est. Margin',    value:fmtUSD(pl.margin),           color:pl.margin>=0?'var(--accent)':'var(--danger)' },
          { label:'Margin %',       value:`${pl.marginPct.toFixed(1)}%`, color:pl.marginPct>=30?'var(--accent)':pl.marginPct>=15?'var(--accent3)':'var(--danger)' },
          { label:'Weighted Value', value:fmtUSD(pl.weighted),         color:'var(--accent2)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:7, fontWeight:700 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)', letterSpacing:'-0.3px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs">
          {[
            { key:'overview', label:'Overview' },
            { key:'roles',    label:`Roles (${opp.roles?.length || 0})` },
            { key:'activity', label:'Notes' },
          ].map(t => <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>{t.label}</div>)}
        </div>

        {activeTab === 'overview' && <OppOverviewTab opp={opp} updateMut={updateMut} />}

        {activeTab === 'roles' && (
          <div className="card-body">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingRole(null); setShowAddRole(true); }}>+ Add Role</button>
            </div>
            {(opp.roles||[]).length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">No roles defined yet.</div></div>
            ) : (opp.roles||[]).map(role => (
              <OppRoleRow key={role.id} role={role} opp={opp} resources={resources} qc={qc}
                onEdit={() => { setEditingRole(role); setShowAddRole(true); }} />
            ))}
            {showAddRole && (
              <OppRoleForm opp={opp} role={editingRole} resources={resources}
                onClose={() => { setShowAddRole(false); setEditingRole(null); }}
                onSaved={() => { qc.invalidateQueries({ queryKey:['opp', oppId] }); setShowAddRole(false); setEditingRole(null); }}
              />
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Notes / Activity Log</label>
              <textarea className="form-textarea" style={{ minHeight:160 }} defaultValue={opp.notes||''}
                onBlur={e => updateMut.mutate({ notes:e.target.value })}
                placeholder="Record call notes, client feedback, next steps…" />
              <div className="form-note">Changes save automatically when you click outside the text area.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OppOverviewTab({ opp, updateMut }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    client: opp.client, name: opp.name, source: opp.source,
    accountManagerId: opp.accountManagerId || '',
    probability: opp.probability,
    startDate: opp.startDate?.split('T')[0] || '',
    endDate:   opp.endDate?.split('T')[0]   || '',
    targetMargin: opp.targetMargin,
    currency: opp.currency, notes: opp.notes || '',
  });
  const f   = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const dur = durationWeeks(opp.startDate, opp.endDate);

  // Load users with AM role for the dropdown
  const { data: allUsers = [] } = useQuery({ queryKey:['users'], queryFn: usersApi.list });
  const ams = allUsers.filter(u => ['ACCOUNT_MANAGER','DELIVERY_MANAGER'].includes(u.role?.name) && u.active);

  if (!editing) {
    return (
      <div className="card-body">
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>✎ Edit Details</button>
        </div>
        <div className="form-grid-2">
          <div>
            <div className="modal-section">Engagement</div>
            {[
              ['Client',          opp.client],
              ['Project',         opp.name],
              ['Source',          SOURCE_LABELS[opp.source]],
              ['Start Date',      fmtDate(opp.startDate)],
              ['End Date',        fmtDate(opp.endDate)],
              ['Duration',        dur || '—'],
            ].map(([k,v]) => (
              <div key={k} className="stat-row"><span className="stat-label">{k}</span><span className="stat-value">{v}</span></div>
            ))}
          </div>
          <div>
            <div className="modal-section">Deal Details</div>
            {[
              ['Stage',         STAGE_LABELS[opp.stage]],
              ['Probability',   `${opp.probability}%`],
              ['Target Margin', `${opp.targetMargin}%`],
              ['Currency',      opp.currency],
              ['Created',       fmtDate(opp.createdAt)],
            ].map(([k,v]) => (
              <div key={k} className="stat-row"><span className="stat-label">{k}</span><span className="stat-value">{v}</span></div>
            ))}
            {opp.notes && (
              <div style={{ marginTop:14, padding:'10px 13px', background:'var(--surface2)', borderRadius:9, fontSize:13, color:'var(--text2)', lineHeight:1.55, border:'1px solid var(--border)' }}>{opp.notes}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-body">
      <div className="modal-section">Engagement</div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Client *</label><input className="form-input" value={form.client} onChange={e => f('client',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Project Name *</label><input className="form-input" value={form.name} onChange={e => f('name',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Source</label>
          <select className="form-select" value={form.source} onChange={e => f('source',e.target.value)}>
            {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Account Manager</label>
          <select className="form-select" value={form.accountManagerId} onChange={e => f('accountManagerId',e.target.value)}>
            <option value="">— Unassigned —</option>
            {ams.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid-3">
        <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.startDate} onChange={e => f('startDate',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate} onChange={e => f('endDate',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Duration</label>
          <input className="form-input" readOnly value={form.startDate&&form.endDate?`${differenceInWeeks(new Date(form.endDate),new Date(form.startDate))} weeks`:'—'} style={{ color:'var(--muted)' }} />
        </div>
      </div>
      <div className="form-grid-3">
        <div className="form-group"><label className="form-label">Target Margin %</label><input className="form-input" type="number" value={form.targetMargin} onChange={e => f('targetMargin',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Win Probability %</label><input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => f('probability',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Currency</label>
          <select className="form-select" value={form.currency} onChange={e => f('currency',e.target.value)}>
            <option value="USD">USD $</option><option value="INR">INR ₹</option>
          </select>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:14, borderTop:'1px solid var(--border)', marginTop:6 }}>
        <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { updateMut.mutate({ ...form, accountManagerId:form.accountManagerId||null }); setEditing(false); }}>Save Changes</button>
      </div>
    </div>
  );
}

// ── ROLE ROW ─────────────────────────────────────────────────────────────────
function OppRoleRow({ role, opp, resources, qc, onEdit }) {
  const copyMut = useMutation({
    mutationFn: () => pipelineApi.addRole(opp.id, {
      title: role.title + ' (copy)', location: role.location, ftPt: role.ftPt,
      experienceLevel: role.experienceLevel, yearsExp: role.yearsExp,
      totalHours: role.totalHours, billRate: role.billRate,
      costGuidance: role.costGuidance, costOverride: role.costOverride,
      status: 'OPEN', sortOrder: (role.sortOrder || 0) + 1,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['opp', opp.id] }),
  });
  const statusUpdateMut = useMutation({
    mutationFn: (status) => pipelineApi.updateRole(role.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['opp', opp.id] }),
  });

  const costGuidance = role.costOverride ? role.costGuidance : (role.billRate ? role.billRate * (1 - opp.targetMargin / 100) : null);
  const revenue = (role.totalHours||0) * (role.billRate||0);
  const cost    = (role.totalHours||0) * (costGuidance||0);
  const margin  = revenue - cost;
  const res     = resources.find(r => r.id === role.resourceId);

  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:11, padding:'13px 15px', marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{role.title}</span>
            <span className={`badge ${STATUS_COLORS[role.status]}`}>{role.status}</span>
            <span className={`badge ${role.location==='ONSITE'?'badge-purple':'badge-blue'}`}>{role.location==='ONSITE'?'Onsite':'Offshore'}</span>
            <span className="badge badge-gray">{role.ftPt}</span>
            {role.experienceLevel && <span className="badge badge-gray">{EXP_LABELS[role.experienceLevel]}{role.yearsExp?` · ${role.yearsExp}yrs`:''}</span>}
          </div>
          <div style={{ display:'flex', gap:18, fontSize:13, flexWrap:'wrap', marginBottom: role.status!=='OPEN' ? 6 : 0 }}>
            {role.totalHours && <span style={{ color:'var(--muted)' }}>{role.totalHours}h planned</span>}
            {role.billRate   && <span style={{ color:'var(--accent2)', fontFamily:'var(--font-mono)', fontWeight:600 }}>${role.billRate}/hr bill</span>}
            {costGuidance    && <span style={{ fontFamily:'var(--font-mono)', color:'var(--text2)', fontWeight:600 }}>${costGuidance.toFixed(2)}/hr cost</span>}
            {revenue > 0     && <span style={{ color:'var(--accent)', fontFamily:'var(--font-mono)', fontWeight:600 }}>{fmtUSD(revenue)} rev · {fmtUSD(margin)} margin</span>}
          </div>
          {role.status !== 'OPEN' && (
            <div style={{ fontSize:13, color:'var(--accent3)', display:'flex', alignItems:'center', gap:5 }}>
              👤 {res ? res.name : role.resourceName || '—'}
              {res && <span style={{ color:'var(--muted)', fontSize:12 }}>· in roster</span>}
            </div>
          )}
          {role.notes && <div style={{ marginTop:5, fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>{role.notes}</div>}
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0, marginLeft:12 }}>
          <button className="btn btn-outline btn-xs" onClick={onEdit}>✎ Edit</button>
          <button className="btn btn-blue btn-xs" onClick={() => copyMut.mutate()} title="Duplicate role">⊕</button>
        </div>
      </div>
    </div>
  );
}

// ── ROLE FORM ─────────────────────────────────────────────────────────────────
function OppRoleForm({ opp, role, resources, onClose, onSaved }) {
  const isEdit = !!role;
  const autoGuidance = (billRate, margin) => billRate ? (parseFloat(billRate) * (1 - parseFloat(margin) / 100)).toFixed(2) : '';

  const [form, setForm] = useState(role ? {
    title: role.title, location: role.location, ftPt: role.ftPt,
    experienceLevel: role.experienceLevel, yearsExp: role.yearsExp || '',
    totalHours: role.totalHours || '', billRate: role.billRate || '',
    costGuidance: role.costGuidance || '', costOverride: role.costOverride,
    status: role.status, resourceName: role.resourceName || '',
    resourceId: role.resourceId || '', notes: role.notes || '',
  } : {
    title: '', location: 'OFFSHORE', ftPt: 'Full-Time',
    experienceLevel: 'MEDIUM', yearsExp: '',
    totalHours: '', billRate: '', costGuidance: '', costOverride: false,
    status: 'OPEN', resourceName: '', resourceId: '', notes: '',
  });

  const f = (k, v) => setForm(p => {
    const next = { ...p, [k]: v };
    if (k === 'billRate' && !next.costOverride) next.costGuidance = autoGuidance(v, opp.targetMargin);
    return next;
  });

  useEffect(() => {
    if (!isEdit && form.billRate && !form.costOverride)
      setForm(p => ({ ...p, costGuidance: autoGuidance(p.billRate, opp.targetMargin) }));
  }, []);

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? pipelineApi.updateRole(role.id, data) : pipelineApi.addRole(opp.id, data),
    onSuccess: onSaved,
  });

  const isOffshore = form.location === 'OFFSHORE';
  const costGNum   = parseFloat(form.costGuidance) || 0;
  const inrLow     = isOffshore && costGNum ? Math.round(costGNum * 88 * 1800 / 1.2) : null;
  const inrHigh    = inrLow ? Math.round(inrLow * 1.25) : null;

  return (
    <div style={{ background:'var(--surface3)', border:'1.5px solid var(--accent)', borderRadius:12, padding:'18px', marginTop:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{isEdit ? `Edit — ${role.title}` : 'New Role'}</div>
        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18 }} onClick={onClose}>✕</button>
      </div>

      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Role Title *</label><input className="form-input" value={form.title} onChange={e => f('title',e.target.value)} placeholder="SAP FICO Lead" /></div>
        <div className="form-group"><label className="form-label">Location</label>
          <select className="form-select" value={form.location} onChange={e => f('location',e.target.value)}>
            <option value="OFFSHORE">Offshore</option><option value="ONSITE">Onsite</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">FT / PT</label>
          <select className="form-select" value={form.ftPt} onChange={e => f('ftPt',e.target.value)}>
            <option value="Full-Time">Full-Time</option><option value="Part-Time">Part-Time</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Experience Level</label>
          <select className="form-select" value={form.experienceLevel} onChange={e => f('experienceLevel',e.target.value)}>
            <option value="JUNIOR">Junior</option><option value="MEDIUM">Medium</option><option value="SENIOR">Senior</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Years Experience</label>
          <select className="form-select" value={form.yearsExp} onChange={e => f('yearsExp',e.target.value)}>
            <option value="">— Select —</option>
            <option value="0-3">0–3 years</option><option value="3-7">3–7 years</option>
            <option value="7-10">7–10 years</option><option value="10+">10+ years</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Total Hours Planned</label><input className="form-input" type="number" value={form.totalHours} onChange={e => f('totalHours',e.target.value)} placeholder="640" /></div>
      </div>

      <div className="modal-section">Commercials</div>
      <div className="form-grid-3">
        <div className="form-group">
          <label className="form-label">Bill Rate ($/hr)</label>
          <input className="form-input" type="number" value={form.billRate} onChange={e => f('billRate',e.target.value)} placeholder="95" />
        </div>
        <div className="form-group">
          <label className="form-label">
            Cost Guidance ($/hr)
            {!form.costOverride && <span style={{ fontSize:10, color:'var(--muted)', marginLeft:5 }}>auto @ {opp.targetMargin}%</span>}
            {form.costOverride  && <span style={{ fontSize:10, color:'var(--accent3)', marginLeft:5 }}>manual override</span>}
          </label>
          <input className="form-input" type="number" value={form.costGuidance}
            onChange={e => { f('costOverride',true); f('costGuidance',e.target.value); }}
            placeholder={autoGuidance(form.billRate, opp.targetMargin) || 'auto'} />
          {form.costOverride && (
            <div className="form-note" style={{ cursor:'pointer', color:'var(--accent)' }}
              onClick={() => { f('costOverride',false); f('costGuidance',autoGuidance(form.billRate,opp.targetMargin)); }}>
              ↺ Reset to auto
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Revenue Est.</label>
          <input className="form-input" readOnly
            value={form.billRate&&form.totalHours ? fmtUSD(parseFloat(form.billRate)*parseFloat(form.totalHours)) : '—'}
            style={{ color:'var(--accent2)', fontWeight:700 }} />
        </div>
      </div>

      {isOffshore && inrLow && (
        <div className="info-box">INR equivalent range: <strong>₹{(inrLow/100000).toFixed(1)}L – ₹{(inrHigh/100000).toFixed(1)}L</strong> annual CTC (estimated)</div>
      )}

      <div className="modal-section">Staffing</div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => f('status',e.target.value)}>
            <option value="OPEN">Open</option><option value="IDENTIFIED">Identified</option><option value="CONFIRMED">Confirmed</option>
          </select>
        </div>
        {form.status !== 'OPEN' && (
          <div className="form-group"><label className="form-label">Resource</label>
            <select className="form-select" value={form.resourceId}
              onChange={e => { f('resourceId',e.target.value); const r=resources.find(x=>x.id===e.target.value); if(r) f('resourceName',r.name); }}>
              <option value="">— From roster —</option>
              {resources.filter(r=>r.status!=='EXITED').map(r=><option key={r.id} value={r.id}>{r.name} · {r.primarySkill?.name}</option>)}
            </select>
            {!form.resourceId && <input className="form-input" style={{ marginTop:5 }} value={form.resourceName} onChange={e=>f('resourceName',e.target.value)} placeholder="Or type a name (not yet in roster)" />}
          </div>
        )}
      </div>
      <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={form.notes} onChange={e => f('notes',e.target.value)} placeholder="Specific requirements…" /></div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:12, borderTop:'1px solid var(--border)', marginTop:8 }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={!form.title||saveMut.isPending}>
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Role'}
        </button>
      </div>
    </div>
  );
}

// ── CREATE FORM ───────────────────────────────────────────────────────────────
function OppForm({ onBack, onSaved }) {
  const [form, setForm] = useState({
    client:'', name:'', source:'EXISTING_ACCOUNT', accountManagerId:'',
    stage:'QUALIFYING', probability:20,
    startDate:'', endDate:'', targetMargin:35, currency:'USD', notes:'',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const createMut = useMutation({ mutationFn: pipelineApi.create, onSuccess: onSaved });

  const { data: allUsers = [] } = useQuery({ queryKey:['users'], queryFn: usersApi.list });
  const ams = allUsers.filter(u => ['ACCOUNT_MANAGER','DELIVERY_MANAGER'].includes(u.role?.name) && u.active);
  const dur = form.startDate && form.endDate ? differenceInWeeks(new Date(form.endDate), new Date(form.startDate)) : null;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">New Opportunity</div>
          <div className="section-sub">Fill in engagement details — add staffing roles after creation</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back to Pipeline</button>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="modal-section">Engagement</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Client *</label><input className="form-input" value={form.client} onChange={e => f('client',e.target.value)} placeholder="Coca-Cola" /></div>
            <div className="form-group"><label className="form-label">Project Name *</label><input className="form-input" value={form.name} onChange={e => f('name',e.target.value)} placeholder="S/4HANA Finance Rollout" /></div>
            <div className="form-group"><label className="form-label">Source</label>
              <select className="form-select" value={form.source} onChange={e => f('source',e.target.value)}>
                {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Account Manager</label>
              <select className="form-select" value={form.accountManagerId} onChange={e => f('accountManagerId',e.target.value)}>
                <option value="">— Unassigned —</option>
                {ams.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-section">Timeline</div>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Expected Start *</label><input className="form-input" type="date" value={form.startDate} onChange={e => f('startDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Expected End *</label><input className="form-input" type="date" value={form.endDate} onChange={e => f('endDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Duration</label>
              <input className="form-input" readOnly value={dur!==null?`${dur} weeks`:'—'} style={{ color:'var(--muted)' }} />
            </div>
          </div>

          <div className="modal-section">Deal Details</div>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Stage</label>
              <select className="form-select" value={form.stage} onChange={e => { f('stage',e.target.value); f('probability',STAGE_PROB[e.target.value]); }}>
                {ACTIVE_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Win Probability %</label><input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => f('probability',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Target Margin %</label><input className="form-input" type="number" value={form.targetMargin} onChange={e => f('targetMargin',e.target.value)} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => f('currency',e.target.value)}>
                <option value="USD">USD $</option><option value="INR">INR ₹</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => f('notes',e.target.value)} placeholder="Context, background, next steps…" /></div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:16, borderTop:'1px solid var(--border)', marginTop:8 }}>
            <button className="btn btn-outline" onClick={onBack}>Cancel</button>
            <button className="btn btn-primary" onClick={() => createMut.mutate(form)} disabled={createMut.isPending||!form.client||!form.name||!form.startDate||!form.endDate}>
              {createMut.isPending ? 'Creating…' : 'Create Opportunity →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
