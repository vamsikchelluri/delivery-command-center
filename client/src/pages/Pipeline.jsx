// src/pages/Pipeline.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, teamApi, resourcesApi } from '../lib/api';
import { fmtUSD } from '../lib/costEngine';
import { format, differenceInDays, differenceInWeeks, parseISO } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGES = ['QUALIFYING','PROPOSED','NEGOTIATING','WON','LOST'];
const STAGE_LABELS = { QUALIFYING:'Qualifying', PROPOSED:'Proposed', NEGOTIATING:'Negotiating', WON:'Won', LOST:'Lost' };
const STAGE_COLORS = { QUALIFYING:'badge-gray', PROPOSED:'badge-blue', NEGOTIATING:'badge-yellow', WON:'badge-green', LOST:'badge-red' };
const STAGE_PROB   = { QUALIFYING:20, PROPOSED:40, NEGOTIATING:70, WON:100, LOST:0 };
const SOURCE_LABELS = { EXISTING_ACCOUNT:'Existing Account', REFERRAL:'Referral', RFP:'RFP', COLD_OUTREACH:'Cold Outreach', PARTNER:'Partner' };
const EXP_LABELS   = { JUNIOR:'Junior', MEDIUM:'Medium', SENIOR:'Senior' };
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
  return w > 0 ? `${w} weeks` : null;
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
  const weighted = revenue * ((opp.probability || 0) / 100);
  return { revenue, cost, margin, marginPct, weighted };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Pipeline() {
  const qc = useQueryClient();
  const [view,        setView]        = useState('list'); // list | add | detail
  const [activeId,    setActiveId]    = useState(null);
  const [stageFilter, setStageFilter] = useState('');

  const { data: opps = [], isLoading } = useQuery({
    queryKey: ['pipeline', stageFilter],
    queryFn:  () => pipelineApi.list(stageFilter ? { stage: stageFilter } : {}),
  });
  const { data: team = [] } = useQuery({ queryKey: ['team'], queryFn: () => teamApi.list() });

  function openDetail(id) { setActiveId(id); setView('detail'); }
  function backToList()   { setActiveId(null); setView('list'); }

  if (view === 'add')    return <OppForm team={team} onBack={() => setView('list')}
    onSaved={() => { qc.invalidateQueries({ queryKey: ['pipeline'] }); setView('list'); }} />;
  if (view === 'detail') return <OppDetail oppId={activeId} team={team} onBack={backToList} />;

  const totals = {
    active:   opps.filter(o => !['WON','LOST'].includes(o.stage)).length,
    weighted: opps.reduce((s, o) => s + computeOppTotals(o).weighted, 0),
    won:      opps.filter(o => o.stage === 'WON').reduce((s, o) => s + computeOppTotals(o).revenue, 0),
    total:    opps.reduce((s, o) => s + computeOppTotals(o).revenue, 0),
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Pipeline</div>
          <div className="section-sub">Opportunities · pre-SOW · staffing requirements</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ New Opportunity</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label: 'Active Opps',       value: totals.active,   color: 'var(--accent)',  fmt: 'num', icon: '📡' },
          { label: 'Weighted Pipeline', value: totals.weighted, color: 'var(--accent2)', fmt: 'usd', icon: '⚖' },
          { label: 'Total Pipeline',    value: totals.total,    color: 'var(--text2)',   fmt: 'usd', icon: '📊' },
          { label: 'Won Revenue',       value: totals.won,      color: 'var(--accent)',  fmt: 'usd', icon: '🏆' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color': k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 18, color: k.color }}>
              {k.fmt === 'usd' ? fmtUSD(k.value) : k.value}
            </div>
            <div className="kpi-icon">{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="empty-state"><div className="empty-text">Loading…</div></div>
      ) : opps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-text">No opportunities yet. Click "+ New Opportunity" to add your first.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><div className="card-dot"/>Opportunity Register</div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{opps.length} opportunities</span>
          </div>
          <div className="card-body-0 table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Client / Project</th><th>Stage</th><th>AM</th><th>Source</th>
                <th>Start</th><th>Duration</th><th>Roles</th>
                <th>Revenue</th><th>Margin %</th><th>Probability</th><th>Weighted</th>
                <th>Age</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {opps.map(o => {
                  const pl  = computeOppTotals(o);
                  const am  = team.find(t => t.id === o.accountManagerId);
                  const dur = durationWeeks(o.startDate, o.endDate);
                  const filled = (o.roles||[]).filter(r => r.status !== 'OPEN').length;
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o.id)}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{o.client}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.name}</div>
                      </td>
                      <td><span className={`badge ${STAGE_COLORS[o.stage]}`}><span className="badge-dot"/>{STAGE_LABELS[o.stage]}</span></td>
                      <td style={{ fontSize: 11.5 }}>{am?.name || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{SOURCE_LABELS[o.source] || '—'}</td>
                      <td style={{ fontSize: 11 }}>{fmtDate(o.startDate)}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{dur || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{filled}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 10 }}>/{(o.roles||[]).length}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtUSD(pl.revenue)}</td>
                      <td style={{ fontWeight: 700, color: pl.marginPct >= 30 ? 'var(--accent)' : pl.marginPct >= 15 ? 'var(--accent3)' : 'var(--danger)' }}>
                        {pl.marginPct.toFixed(1)}%
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 4 }}>
                            <div style={{ width: `${o.probability}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', minWidth: 28 }}>{o.probability}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent2)' }}>{fmtUSD(pl.weighted)}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{ageLabel(o.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-accent btn-xs" onClick={() => openDetail(o.id)}>Open →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Opportunity Form (inline page) ────────────────────────────────────────
function OppForm({ team, onBack, onSaved, opp }) {
  const isEdit = !!opp;
  const [form, setForm] = useState({
    client:           opp?.client           || '',
    name:             opp?.name             || '',
    source:           opp?.source           || 'EXISTING_ACCOUNT',
    accountManagerId: opp?.accountManagerId || '',
    stage:            opp?.stage            || 'QUALIFYING',
    probability:      opp?.probability      ?? 20,
    startDate:        opp?.startDate?.split('T')[0] || '',
    endDate:          opp?.endDate?.split('T')[0]   || '',
    targetMargin:     opp?.targetMargin     ?? 30,
    currency:         opp?.currency         || 'USD',
    notes:            opp?.notes            || '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? pipelineApi.update(opp.id, data) : pipelineApi.create(data),
    onSuccess: onSaved,
  });

  const ams = team.filter(t => t.active !== false);

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">{isEdit ? 'Edit Opportunity' : 'New Opportunity'}</div>
          <div className="section-sub">Pipeline · pre-SOW engagement</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back</button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="modal-section">Engagement</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Client *</label>
              <input className="form-input" value={form.client} onChange={e => f('client', e.target.value)} placeholder="eBay Inc." /></div>
            <div className="form-group"><label className="form-label">Project / Opportunity Name *</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="SAP S/4HANA Migration" /></div>
            <div className="form-group"><label className="form-label">Source</label>
              <select className="form-select" value={form.source} onChange={e => f('source', e.target.value)}>
                {Object.entries(SOURCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Account Manager</label>
              <select className="form-select" value={form.accountManagerId} onChange={e => f('accountManagerId', e.target.value)}>
                <option value="">— Unassigned —</option>
                {ams.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-section">Timeline & Financials</div>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => f('startDate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">End Date</label>
              <input className="form-input" type="date" value={form.endDate} onChange={e => f('endDate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => f('currency', e.target.value)}>
                <option value="USD">USD $</option><option value="INR">INR ₹</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Stage</label>
              <select className="form-select" value={form.stage} onChange={e => { f('stage', e.target.value); f('probability', STAGE_PROB[e.target.value]); }}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Win Probability %</label>
              <input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={e => f('probability', parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">Target Margin %</label>
              <input className="form-input" type="number" value={form.targetMargin} onChange={e => f('targetMargin', parseInt(e.target.value))} /></div>
          </div>

          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Context, client feedback, next steps…" /></div>

          {saveMut.isError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{saveMut.error?.error || 'Error saving'}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={onBack}>Cancel</button>
            <button className="btn btn-primary" onClick={() => saveMut.mutate({ ...form, accountManagerId: form.accountManagerId || null })}
              disabled={saveMut.isPending || !form.client || !form.name}>
              {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Opportunity →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Opportunity Detail ────────────────────────────────────────────────────────
function OppDetail({ oppId, team, onBack }) {
  const qc = useQueryClient();
  const [activeTab,   setActiveTab]   = useState('overview');
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingOpp,  setEditingOpp]  = useState(false);

  const { data: opp, isLoading } = useQuery({
    queryKey: ['opp', oppId],
    queryFn:  () => pipelineApi.get(oppId),
    refetchInterval: 15000,
  });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => resourcesApi.list() });

  const updateMut = useMutation({
    mutationFn: (data) => pipelineApi.update(oppId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['opp', oppId] }); setEditingOpp(false); },
  });
  const convertMut = useMutation({
    mutationFn: () => pipelineApi.convert(oppId),
    onSuccess:  (proj) => {
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      alert(`✅ Converted to SOW — "${proj.name}". Go to Projects to complete the SOW details.`);
      onBack();
    },
  });

  if (isLoading || !opp) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const pl   = computeOppTotals(opp);
  const am   = team.find(t => t.id === opp.accountManagerId);
  const dur  = durationWeeks(opp.startDate, opp.endDate);
  const days = differenceInDays(new Date(), new Date(opp.createdAt));
  const isWon = opp.stage === 'WON';
  const alreadyConverted = !!opp.convertedAt;

  if (editingOpp) return (
    <OppForm opp={opp} team={team} onBack={() => setEditingOpp(false)}
      onSaved={() => { qc.invalidateQueries({ queryKey: ['opp', oppId] }); setEditingOpp(false); }} />
  );

  return (
    <div>
      <div className="section-header">
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onBack}>Pipeline</span> / {opp.client}
          </div>
          <div className="section-title">{opp.client} — {opp.name}</div>
          <div className="section-sub">
            {am && <span style={{ marginRight: 10 }}>👤 {am.name}</span>}
            {SOURCE_LABELS[opp.source]} · Open for {days}d
            {dur && <span style={{ marginLeft: 8 }}>· {dur}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STAGE_COLORS[opp.stage]}`}><span className="badge-dot"/>{STAGE_LABELS[opp.stage]}</span>
          <select className="form-select" style={{ width: 'auto' }} value={opp.stage}
            onChange={e => updateMut.mutate({ stage: e.target.value, probability: STAGE_PROB[e.target.value] })}>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          {isWon && !alreadyConverted && (
            <button className="btn btn-primary"
              onClick={() => { if (window.confirm('Convert this opportunity to a SOW? The opportunity will remain for reference.')) convertMut.mutate(); }}
              disabled={convertMut.isPending}>
              {convertMut.isPending ? 'Converting…' : '🏆 Convert to SOW →'}
            </button>
          )}
          {alreadyConverted && <span className="badge badge-green">✓ Converted to SOW</span>}
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* P&L strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Est. Revenue',   value: fmtUSD(pl.revenue),           color: 'var(--accent2)' },
          { label: 'Est. Cost',      value: fmtUSD(pl.cost),              color: 'var(--text)' },
          { label: 'Est. Margin',    value: fmtUSD(pl.margin),            color: pl.margin >= 0 ? 'var(--accent)' : 'var(--danger)' },
          { label: 'Margin %',       value: `${pl.marginPct.toFixed(1)}%`, color: pl.marginPct >= 30 ? 'var(--accent)' : pl.marginPct >= 15 ? 'var(--accent3)' : 'var(--danger)' },
          { label: 'Weighted Value', value: fmtUSD(pl.weighted),          color: 'var(--accent2)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, fontFamily: 'var(--font-mono)' }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs">
          {[
            { key: 'overview', label: '📋 Overview' },
            { key: 'roles',    label: `👥 Roles (${opp.roles?.length || 0})` },
            { key: 'notes',    label: '📝 Notes' },
          ].map(t => <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</div>)}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingOpp(true)}>✎ Edit Details</button>
            </div>
            <div className="form-grid-2">
              <div>
                {[
                  ['Client',          opp.client],
                  ['Project',         opp.name],
                  ['Source',          SOURCE_LABELS[opp.source]],
                  ['Account Manager', am?.name || '—'],
                  ['Start Date',      fmtDate(opp.startDate)],
                  ['End Date',        fmtDate(opp.endDate)],
                  ['Duration',        dur || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{k}</span>
                    <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                {[
                  ['Stage',          STAGE_LABELS[opp.stage]],
                  ['Probability',    `${opp.probability}%`],
                  ['Target Margin',  `${opp.targetMargin}%`],
                  ['Currency',       opp.currency],
                  ['Created',        fmtDate(opp.createdAt)],
                  ['Last Updated',   fmtDate(opp.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{k}</span>
                    <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Roles */}
        {activeTab === 'roles' && (
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingRole(null); setShowAddRole(true); }}>+ Add Role</button>
            </div>
            {(opp.roles || []).length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">No roles defined yet.</div></div>
            ) : (
              (opp.roles || []).map((role, idx) => (
                <OppRoleRow key={role.id} role={role} opp={opp} resources={resources} idx={idx} qc={qc}
                  onEdit={() => { setEditingRole(role); setShowAddRole(true); }} />
              ))
            )}
            {showAddRole && (
              <OppRoleForm opp={opp} role={editingRole} resources={resources}
                onClose={() => { setShowAddRole(false); setEditingRole(null); }}
                onSaved={() => { qc.invalidateQueries({ queryKey: ['opp', oppId] }); setShowAddRole(false); setEditingRole(null); }} />
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Notes / Activity Log</label>
              <textarea className="form-textarea" style={{ minHeight: 150 }} defaultValue={opp.notes || ''}
                onBlur={e => updateMut.mutate({ notes: e.target.value })}
                placeholder="Record call notes, client feedback, next steps…" />
              <div className="form-note">Changes save automatically when you click outside the text area.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Role Row ──────────────────────────────────────────────────────────────────
function OppRoleRow({ role, opp, resources, idx, qc, onEdit }) {
  const updateMut = useMutation({
    mutationFn: (data) => pipelineApi.updateRole(role.id, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['opp', opp.id] }),
  });

  const costGuidance = role.costOverride ? role.costGuidance : (role.billRate ? role.billRate * (1 - (opp.targetMargin || 30) / 100) : null);
  const revenue = (role.totalHours || 0) * (role.billRate || 0);
  const cost    = (role.totalHours || 0) * (costGuidance || 0);
  const margin  = revenue - cost;
  const res     = resources.find(r => r.id === role.resourceId);

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{role.title}</span>
            <span className={`badge ${STATUS_COLORS[role.status]}`} style={{ fontSize: 9.5 }}>{role.status}</span>
            <span className={`badge ${role.location === 'ONSITE' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: 9.5 }}>{role.location === 'ONSITE' ? 'Onsite' : 'Offshore'}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
            {role.experienceLevel && <span>{EXP_LABELS[role.experienceLevel]}{role.yearsExp ? ` · ${role.yearsExp}yrs` : ''}</span>}
            {role.totalHours      && <span>{role.totalHours}h planned</span>}
            {role.billRate        && <span style={{ color: 'var(--accent2)', fontFamily: 'var(--font-mono)' }}>${role.billRate}/hr bill</span>}
            {costGuidance         && <span style={{ fontFamily: 'var(--font-mono)' }}>${costGuidance.toFixed(2)}/hr cost</span>}
            {revenue > 0          && <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{fmtUSD(revenue)} rev · {fmtUSD(margin)} margin</span>}
          </div>
          {role.status !== 'OPEN' && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent3)' }}>
              👤 {res ? res.name : role.resourceName || '—'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 12 }}>
          <select className="form-select" style={{ width: 'auto', fontSize: 10, padding: '2px 22px 2px 6px', height: 24 }}
            value={role.status} onChange={e => updateMut.mutate({ status: e.target.value })}>
            <option value="OPEN">Open</option>
            <option value="IDENTIFIED">Identified</option>
            <option value="CONFIRMED">Confirmed</option>
          </select>
          <button className="btn btn-outline btn-xs" onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

// ── Role Form (inline) ────────────────────────────────────────────────────────
function OppRoleForm({ opp, role, resources, onClose, onSaved }) {
  const isEdit = !!role;
  const autoGuidance = (billRate, margin) => billRate ? (parseFloat(billRate) * (1 - parseFloat(margin) / 100)).toFixed(2) : '';

  const [form, setForm] = useState({
    title:           role?.title           || '',
    location:        role?.location        || 'OFFSHORE',
    ftPt:            role?.ftPt            || 'FT',
    experienceLevel: role?.experienceLevel || 'MEDIUM',
    yearsExp:        role?.yearsExp        || '',
    totalHours:      role?.totalHours      || '',
    billRate:        role?.billRate        || '',
    costGuidance:    role?.costGuidance    || '',
    costOverride:    role?.costOverride    || false,
    status:          role?.status          || 'OPEN',
    resourceId:      role?.resourceId      || '',
    resourceName:    role?.resourceName    || '',
    notes:           role?.notes           || '',
  });
  const f = (k, v) => setForm(p => {
    const next = { ...p, [k]: v };
    if ((k === 'billRate') && !next.costOverride) {
      next.costGuidance = autoGuidance(v, opp.targetMargin);
    }
    return next;
  });

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? pipelineApi.updateRole(role.id, data) : pipelineApi.addRole(opp.id, data),
    onSuccess: onSaved,
  });

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{isEdit ? 'Edit Role' : 'Add Role'}</div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Role Title *</label>
          <input className="form-input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="SAP FICO Consultant" /></div>
        <div className="form-group"><label className="form-label">Location</label>
          <select className="form-select" value={form.location} onChange={e => f('location', e.target.value)}>
            <option value="OFFSHORE">Offshore</option><option value="ONSITE">Onsite</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Experience Level</label>
          <select className="form-select" value={form.experienceLevel} onChange={e => f('experienceLevel', e.target.value)}>
            <option value="JUNIOR">Junior</option><option value="MEDIUM">Medium</option><option value="SENIOR">Senior</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Years Experience</label>
          <input className="form-input" type="number" value={form.yearsExp} onChange={e => f('yearsExp', e.target.value)} placeholder="5" /></div>
        <div className="form-group"><label className="form-label">Total Hours</label>
          <input className="form-input" type="number" value={form.totalHours} onChange={e => f('totalHours', e.target.value)} placeholder="1200" /></div>
        <div className="form-group"><label className="form-label">Bill Rate ($/hr)</label>
          <input className="form-input" type="number" value={form.billRate} onChange={e => f('billRate', e.target.value)} placeholder="95" /></div>
        <div className="form-group"><label className="form-label">Cost Guidance ($/hr)</label>
          <input className="form-input" type="number" value={form.costGuidance} onChange={e => { f('costGuidance', e.target.value); f('costOverride', true); }}
            placeholder={autoGuidance(form.billRate, opp.targetMargin) || 'Auto'} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="OPEN">Open</option><option value="IDENTIFIED">Identified</option><option value="CONFIRMED">Confirmed</option>
          </select>
        </div>
      </div>
      {form.status !== 'OPEN' && (
        <div className="form-group"><label className="form-label">Assigned Resource</label>
          <select className="form-select" value={form.resourceId} onChange={e => f('resourceId', e.target.value)}>
            <option value="">— Free text —</option>
            {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}
      <div className="form-group"><label className="form-label">Notes</label>
        <input className="form-input" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Any specific requirements…" /></div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={!form.title || saveMut.isPending}>
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Role'}
        </button>
      </div>
    </div>
  );
}
