// src/pages/Projects.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, deploymentsApi, actualsApi, resourcesApi, skillsApi } from '../lib/api';
import { fmtUSD, fmtRate, getCurrentUSDRate } from '../lib/costEngine';
import { format, differenceInDays, parseISO } from 'date-fns';

function fmtDate(d) { return d ? format(parseISO(d.split('T')[0]), 'dd MMM yyyy') : '—'; }
function daysLeft(d) { if (!d) return null; return differenceInDays(parseISO(d.split('T')[0]), new Date()); }
function progressColor(pct) { if (pct >= 80) return 'var(--danger)'; if (pct >= 60) return 'var(--accent3)'; return 'var(--accent)'; }
function marginColor(pct)   { if (pct >= 30) return 'var(--accent)'; if (pct >= 15) return 'var(--accent3)'; return 'var(--danger)'; }

function computeSOWPL(project, resources = []) {
  let totalRevenue = 0, totalCost = 0, totalPlannedHrs = 0, totalActualHrs = 0;
  const WD = 21, HPD = 8;
  (project.roles || []).forEach(role => {
    (role.deployments || []).forEach(dep => {
      const res = resources.find(r => r.id === dep.resourceId);
      const costRate = res ? getCurrentUSDRate(res) : 0;
      const plannedHrsPerMonth = WD * HPD * (dep.allocation / 100);
      const actualHrs = (dep.actuals || []).reduce((s, a) => s + (a.actualHours || 0), 0);
      const depDays = differenceInDays(parseISO(dep.endDate.split('T')[0]), parseISO(dep.startDate.split('T')[0]));
      const depMonths = Math.max(1, Math.round(depDays / 30));
      const plannedHrs = plannedHrsPerMonth * depMonths;
      totalPlannedHrs += plannedHrs;
      totalActualHrs  += actualHrs;
      const billedHrs = actualHrs || plannedHrs;
      if (role.billingType === 'FIXED_MONTHLY') totalRevenue += (role.fixedAmount || 0) * depMonths;
      else totalRevenue += billedHrs * (role.billRate || 0);
      totalCost += (actualHrs || plannedHrs) * costRate;
    });
  });
  const margin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
  const hoursUsedPct = totalPlannedHrs > 0 ? (totalActualHrs / totalPlannedHrs) * 100 : 0;
  return { totalRevenue, totalCost, margin, marginPct, totalPlannedHrs, totalActualHrs, hoursUsedPct };
}

export default function Projects() {
  const qc = useQueryClient();
  const [view, setView] = useState('list');
  const [activeProj, setActiveProj] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsApi.list({ status: statusFilter || undefined }),
  });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => resourcesApi.list() });

  function openDetail(p) { setActiveProj(p); setView('detail'); }
  function backToList()  { setActiveProj(null); setView('list'); }

  if (view === 'detail' && activeProj) {
    return <SOWDetail projectId={activeProj.id} resources={resources} onBack={backToList} />;
  }

  const totals = {
    active:  projects.filter(p => p.status === 'ACTIVE').length,
    revenue: projects.reduce((s, p) => s + computeSOWPL(p, resources).totalRevenue, 0),
    margin:  projects.reduce((s, p) => s + computeSOWPL(p, resources).margin, 0),
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Projects (SOW)</div>
          <div className="section-sub">Active engagements · roles · resource assignments · P&L</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option><option value="ON_HOLD">On Hold</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New SOW</button>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { label: 'Active SOWs', value: totals.active, color: 'var(--accent)', icon: '📋' },
          { label: 'Total Revenue', value: fmtUSD(totals.revenue), color: 'var(--accent2)', icon: '💰' },
          { label: 'Gross Margin', value: fmtUSD(totals.margin), color: totals.margin >= 0 ? 'var(--accent)' : 'var(--danger)', icon: '📈' },
          { label: 'Avg Margin %', value: totals.revenue > 0 ? Math.round((totals.margin / totals.revenue) * 100) + '%' : '0%', color: 'var(--purple)', icon: '%' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color': k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
            <div className="kpi-icon">{k.icon}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><div className="card-dot" />SOW Register</div>
          <span className="text-sm text-muted">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body-0 table-wrap">
          {isLoading ? <div className="empty-state"><div className="empty-text">Loading…</div></div>
          : projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-text">No SOWs yet. Click "+ New SOW" to create your first engagement.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Client / Project</th><th>SOW #</th><th>Type</th><th>Resources</th>
                <th>Revenue</th><th>Cost</th><th>Margin %</th><th>Hours Used</th>
                <th>Days Left</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {projects.map(p => {
                  const pl = computeSOWPL(p, resources);
                  const days = daysLeft(p.endDate);
                  const resCount = new Set((p.roles || []).flatMap(r => (r.deployments || []).map(d => d.resourceId))).size;
                  const milestonesDue = (p.milestones || []).filter(m => m.status === 'UPCOMING' && daysLeft(m.plannedDate) <= 14 && daysLeft(m.plannedDate) >= 0).length;
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p)}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{p.client}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.name}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.sowNumber || '—'}</td>
                      <td><span className={`badge ${p.sowType === 'FIXED' ? 'badge-purple' : 'badge-blue'}`}>{p.sowType}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{resCount}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtUSD(pl.totalRevenue)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtUSD(pl.totalCost)}</td>
                      <td><span style={{ fontWeight: 700, color: marginColor(pl.marginPct) }}>{pl.marginPct.toFixed(1)}%</span></td>
                      <td style={{ minWidth: 120 }}>
                        <div className="progress-wrap">
                          <div className="progress-bg"><div className="progress-fill" style={{ width: `${Math.min(pl.hoursUsedPct, 100)}%`, background: progressColor(pl.hoursUsedPct) }} /></div>
                          <span className="progress-label">{pl.hoursUsedPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        {days === null ? '—' : days < 0 ? <span className="badge badge-red">Expired</span>
                          : days <= 30 ? <span className="badge badge-yellow">{days}d</span>
                          : <span style={{ fontSize: 11, color: 'var(--muted)' }}>{days}d</span>}
                        {milestonesDue > 0 && <span className="badge badge-yellow" style={{ marginLeft: 4 }}>⚑ {milestonesDue}</span>}
                      </td>
                      <td><span className={`badge ${p.status==='ACTIVE'?'badge-green':p.status==='DRAFT'?'badge-gray':p.status==='ON_HOLD'?'badge-yellow':'badge-blue'}`}><span className="badge-dot" />{p.status}</span></td>
                      <td onClick={e => e.stopPropagation()}><button className="btn btn-accent btn-xs" onClick={() => openDetail(p)}>Open →</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && <SOWCreateModal onClose={() => setShowCreate(false)} onSaved={(p) => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); openDetail(p); }} />}
    </div>
  );
}

function SOWDetail({ projectId, resources, onBack }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddMS, setShowAddMS] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    refetchInterval: 15000,
  });
  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list });

  const updateMut = useMutation({
    mutationFn: (data) => projectsApi.update(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  if (isLoading || !project) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const pl = computeSOWPL(project, resources);
  const days = daysLeft(project.endDate);
  const resIds = new Set((project.roles || []).flatMap(r => (r.deployments || []).map(d => d.resourceId)));

  return (
    <div>
      <div className="section-header">
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onBack}>Projects</span> / {project.client}
          </div>
          <div className="section-title">{project.client} — {project.name}</div>
          <div className="section-sub">
            {project.sowNumber && <span style={{ marginRight: 10 }}>SOW: {project.sowNumber}</span>}
            {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
            {days !== null && <span style={{ marginLeft: 8, color: days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--accent3)' : 'var(--muted)' }}>· {days < 0 ? 'Expired' : `${days}d remaining`}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${project.sowType === 'FIXED' ? 'badge-purple' : 'badge-blue'}`}>{project.sowType === 'FIXED' ? 'Fixed Price' : 'T&M'}</span>
          <select className="form-select" style={{ width: 'auto' }} value={project.status} onChange={e => updateMut.mutate({ status: e.target.value })}>
            <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option><option value="TERMINATED">Terminated</option>
          </select>
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Revenue', value: fmtUSD(pl.totalRevenue), color: 'var(--accent2)' },
          { label: 'Total Cost',    value: fmtUSD(pl.totalCost),    color: 'var(--text)' },
          { label: 'Gross Margin',  value: fmtUSD(pl.margin),       color: pl.margin >= 0 ? 'var(--accent)' : 'var(--danger)' },
          { label: 'Margin %',      value: `${pl.marginPct.toFixed(1)}%`, color: marginColor(pl.marginPct) },
          { label: 'Hours Used',    value: `${pl.totalActualHrs.toFixed(0)} / ${pl.totalPlannedHrs.toFixed(0)}h`, color: 'var(--text2)' },
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
            { key: 'overview',   label: '📋 Overview' },
            { key: 'roles',      label: `👥 Roles & Deployments (${project.roles?.length || 0})` },
            { key: 'milestones', label: `⚑ Milestones (${project.milestones?.length || 0})` },
            { key: 'actuals',    label: '⏱ Monthly Actuals' },
          ].map(t => <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</div>)}
        </div>

        {activeTab === 'overview' && (
          <div className="card-body">
            <div className="form-grid-2">
              <div>
                {[['Client', project.client],['Project', project.name],['SOW #', project.sowNumber],['Type', project.sowType === 'FIXED' ? 'Fixed Price' : 'T&M'],['Currency', project.currency],['Value', project.totalValue ? fmtUSD(project.totalValue) : '—'],['Start', fmtDate(project.startDate)],['End', fmtDate(project.endDate)]].map(([k,v]) => v && (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                    <span style={{ color:'var(--muted)' }}>{k}</span><span style={{ color:'var(--text2)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                {[['Delivery Mgr', project.deliveryMgr],['Account Mgr', project.accountMgr],['Client Contact', project.clientContact],['Client PO', project.clientRef],['Resources', `${resIds.size} assigned`],['Roles', `${project.roles?.length || 0} defined`],['Milestones', `${project.milestones?.length || 0} defined`]].map(([k,v]) => v && (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                    <span style={{ color:'var(--muted)' }}>{k}</span><span style={{ color:'var(--text2)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
                {project.notes && <div style={{ marginTop:12, padding:10, background:'var(--surface2)', borderRadius:8, fontSize:11, color:'var(--text2)' }}>{project.notes}</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="card-body">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddRole(true)}>+ Add Role</button>
            </div>
            {(project.roles || []).length === 0
              ? <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">No roles yet. Add a role to start assigning resources.</div></div>
              : (project.roles || []).map(role => <RoleCard key={role.id} role={role} project={project} resources={resources} skills={skills} qc={qc} />)
            }
            {showAddRole && <AddRoleModal project={project} skills={skills} onClose={() => setShowAddRole(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setShowAddRole(false); }} />}
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="card-body">
            {project.sowType === 'TM' && <div className="info-box" style={{ marginBottom:12 }}>T&M SOW — milestones are optional for key deliverable tracking.</div>}
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddMS(true)}>+ Add Milestone</button>
            </div>
            {(project.milestones || []).length === 0
              ? <div className="empty-state"><div className="empty-icon">⚑</div><div className="empty-text">No milestones yet.</div></div>
              : <table className="data-table"><thead><tr><th>Name</th><th>Planned Date</th><th>Amount</th><th>Actual Date</th><th>Invoice Date</th><th>Payment Date</th><th>Hours %</th><th>Status</th></tr></thead>
                  <tbody>{(project.milestones || []).map(m => <MilestoneRow key={m.id} milestone={m} hoursUsedPct={pl.hoursUsedPct} projectId={projectId} qc={qc} />)}</tbody>
                </table>
            }
            {showAddMS && <AddMilestoneModal projectId={projectId} onClose={() => setShowAddMS(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setShowAddMS(false); }} />}
          </div>
        )}

        {activeTab === 'actuals' && (
          <div className="card-body">
            <div className="info-box" style={{ marginBottom:12 }}>Enter actual hours per resource per month. Drives cost accrual and milestone completion % for fixed price SOWs.</div>
            {(project.roles || []).length === 0
              ? <div className="empty-state"><div className="empty-text">Add roles and assign resources first.</div></div>
              : (project.roles || []).flatMap(role => (role.deployments || []).map(dep => <ActualsEntry key={dep.id} dep={dep} role={role} resources={resources} projectId={projectId} qc={qc} />))
            }
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({ role, project, resources, skills, qc }) {
  const [showAssign, setShowAssign] = useState(false);
  const WD = 21, HPD = 8;
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{role.title}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span className={`badge ${role.billingType === 'FIXED_MONTHLY' ? 'badge-purple' : 'badge-blue'}`}>
              {role.billingType === 'FIXED_MONTHLY' ? `Fixed $${role.fixedAmount}/mo` : `$${role.billRate}/hr`}
            </span>
            <span style={{ fontSize:11, color:'var(--muted)' }}>{fmtDate(role.planStart)} → {fmtDate(role.planEnd)}</span>
          </div>
        </div>
        <button className="btn btn-accent btn-sm" onClick={() => setShowAssign(true)}>+ Assign Resource</button>
      </div>
      {(role.deployments || []).length === 0
        ? <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No resource assigned yet</div>
        : (role.deployments || []).map(dep => {
            const r = resources.find(x => x.id === dep.resourceId);
            const rate = r ? getCurrentUSDRate(r) : 0;
            const hrs = WD * HPD * dep.allocation / 100;
            const rev = role.billingType === 'FIXED_MONTHLY' ? (role.fixedAmount || 0) : hrs * (role.billRate || 0);
            const cost = hrs * rate;
            const margin = rev - cost;
            return (
              <div key={dep.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, marginTop:6 }}>
                <div style={{ width:32, height:32, background:'linear-gradient(135deg,var(--accent2),var(--accent))', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {(r?.name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:12 }}>{r?.name || 'Unknown'}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>{dep.allocation}% · {fmtDate(dep.startDate)} → {fmtDate(dep.endDate)}</div>
                </div>
                <div style={{ textAlign:'right', fontSize:11 }}>
                  <div style={{ color:'var(--accent2)', fontWeight:700 }}>{fmtUSD(rev)}/mo rev</div>
                  <div style={{ color:'var(--muted)' }}>{fmtUSD(cost)}/mo cost</div>
                </div>
                <div style={{ textAlign:'right', fontSize:12, fontWeight:700, color: margin>=0?'var(--accent)':'var(--danger)', minWidth:80 }}>
                  {fmtUSD(margin)}<div style={{ fontSize:9, fontWeight:400, color:'var(--muted)' }}>margin/mo</div>
                </div>
              </div>
            );
          })
      }
      {showAssign && <AssignResourceModal role={role} project={project} resources={resources} onClose={() => setShowAssign(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['project', project.id] }); setShowAssign(false); }} />}
    </div>
  );
}

function MilestoneRow({ milestone: m, hoursUsedPct, projectId, qc }) {
  const updateMut = useMutation({
    mutationFn: (data) => projectsApi.updateMilestone(m.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });
  return (
    <tr>
      <td style={{ fontWeight:600, fontSize:12 }}>{m.name}</td>
      <td style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{fmtDate(m.plannedDate)}</td>
      <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmtUSD(m.plannedAmount)}</td>
      <td><input type="date" className="form-input" style={{ width:130, padding:'4px 8px', fontSize:10 }} defaultValue={m.actualDate?.split('T')[0]||''} onBlur={e=>e.target.value&&updateMut.mutate({actualDate:e.target.value})} /></td>
      <td><input type="date" className="form-input" style={{ width:130, padding:'4px 8px', fontSize:10 }} defaultValue={m.invoiceDate?.split('T')[0]||''} onBlur={e=>e.target.value&&updateMut.mutate({invoiceDate:e.target.value,status:'INVOICED'})} /></td>
      <td><input type="date" className="form-input" style={{ width:130, padding:'4px 8px', fontSize:10 }} defaultValue={m.paymentDate?.split('T')[0]||''} onBlur={e=>e.target.value&&updateMut.mutate({paymentDate:e.target.value,status:'RECEIVED'})} /></td>
      <td style={{ minWidth:120 }}>
        <div className="progress-wrap">
          <div className="progress-bg"><div className="progress-fill" style={{ width:`${Math.min(hoursUsedPct,100)}%`, background:progressColor(hoursUsedPct) }} /></div>
          <span className="progress-label">{hoursUsedPct.toFixed(0)}%</span>
        </div>
      </td>
      <td>
        <select className="form-select" style={{ padding:'3px 8px', fontSize:10, width:'auto' }} value={m.status} onChange={e=>updateMut.mutate({status:e.target.value})}>
          <option value="UPCOMING">Upcoming</option><option value="INVOICED">Invoiced</option>
          <option value="RECEIVED">Received</option><option value="OVERDUE">Overdue</option>
        </select>
      </td>
    </tr>
  );
}

function ActualsEntry({ dep, role, resources, projectId, qc }) {
  const r = resources.find(x => x.id === dep.resourceId);
  const rate = r ? getCurrentUSDRate(r) : 0;
  const WD = 21, HPD = 8;
  const plannedHrsPerMonth = WD * HPD * (dep.allocation / 100);
  const saveMut = useMutation({
    mutationFn: actualsApi.upsert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = format(d, 'MMM yyyy');
    const existing = (dep.actuals || []).find(a => a.month === key);
    months.push({ key, label, existing });
  }
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
      <div style={{ fontWeight:700, fontSize:12.5, marginBottom:3 }}>{r?.name || 'Unknown'}</div>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>
        {role.title} · {dep.allocation}% · Planned {plannedHrsPerMonth.toFixed(0)}h/mo · {fmtRate(rate)}/hr
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {months.map(m => (
          <div key={m.key} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 10px' }}>
            <div style={{ fontSize:9.5, color:'var(--muted)', marginBottom:5, fontFamily:'var(--font-mono)' }}>{m.label}</div>
            <input type="number" step="0.5" placeholder={plannedHrsPerMonth.toFixed(0)} defaultValue={m.existing?.actualHours||''} className="form-input" style={{ padding:'4px 6px', fontSize:11, marginBottom:4 }}
              onBlur={e => { const val = parseFloat(e.target.value); if (!isNaN(val) && val >= 0) saveMut.mutate({ deploymentId:dep.id, month:m.key, actualHours:val }); }} />
            <div style={{ fontSize:9.5, color:'var(--muted)' }}>
              {m.existing ? <span style={{ color:'var(--accent)' }}>✓ {fmtUSD(m.existing.actualHours * rate)}</span> : <span>Plan: {fmtUSD(plannedHrsPerMonth * rate)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SOWCreateModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ client:'', name:'', sowNumber:'', sowType:'TM', currency:'USD', startDate:'', endDate:'', totalValue:'', deliveryMgr:'', accountMgr:'', clientContact:'', clientRef:'', notes:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const createMut = useMutation({ mutationFn: projectsApi.create, onSuccess: onSaved });
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-title">New SOW / Project <button onClick={onClose} style={{ cursor:'pointer',color:'var(--muted)',background:'none',border:'none',fontSize:16 }}>✕</button></div>
        <div className="modal-section">Engagement Details</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Client Name *</label><input className="form-input" value={form.client} onChange={e=>f('client',e.target.value)} placeholder="Coca Cola" /></div>
          <div className="form-group"><label className="form-label">Project Name *</label><input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="S/4HANA Finance Rollout" /></div>
        </div>
        <div className="form-grid-3">
          <div className="form-group"><label className="form-label">SOW Number</label><input className="form-input" value={form.sowNumber} onChange={e=>f('sowNumber',e.target.value)} placeholder="SOW-2025-001" /></div>
          <div className="form-group"><label className="form-label">SOW Type *</label>
            <select className="form-select" value={form.sowType} onChange={e=>f('sowType',e.target.value)}>
              <option value="TM">T&M (Time & Materials)</option><option value="FIXED">Fixed Price</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Currency</label>
            <select className="form-select" value={form.currency} onChange={e=>f('currency',e.target.value)}>
              <option value="USD">USD $</option><option value="INR">INR ₹</option>
            </select>
          </div>
        </div>
        <div className="form-grid-3">
          <div className="form-group"><label className="form-label">Start Date *</label><input className="form-input" type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date *</label><input className="form-input" type="date" value={form.endDate} onChange={e=>f('endDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Total Contract Value</label><input className="form-input" type="number" value={form.totalValue} onChange={e=>f('totalValue',e.target.value)} placeholder="250000" /></div>
        </div>
        <div className="modal-section">Team & Contact</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Delivery Manager</label><input className="form-input" value={form.deliveryMgr} onChange={e=>f('deliveryMgr',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Account Manager</label><input className="form-input" value={form.accountMgr} onChange={e=>f('accountMgr',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Client Contact</label><input className="form-input" value={form.clientContact} onChange={e=>f('clientContact',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Client PO / Reference</label><input className="form-input" value={form.clientRef} onChange={e=>f('clientRef',e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>createMut.mutate(form)} disabled={createMut.isPending||!form.client||!form.name||!form.startDate||!form.endDate}>
            {createMut.isPending ? 'Creating…' : 'Create SOW →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddRoleModal({ project, skills, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', skillId:'', billRate:'', billingType:'TM', fixedAmount:'', planStart:project.startDate?.split('T')[0]||'', planEnd:project.endDate?.split('T')[0]||'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const createMut = useMutation({ mutationFn: (data)=>projectsApi.addRole(project.id,data), onSuccess: onSaved });
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title">Add Role <button onClick={onClose} style={{ cursor:'pointer',color:'var(--muted)',background:'none',border:'none',fontSize:16 }}>✕</button></div>
        <div className="form-group"><label className="form-label">Role Title *</label><input className="form-input" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="SAP FICO Lead" /></div>
        <div className="form-group"><label className="form-label">Expected Skill</label>
          <select className="form-select" value={form.skillId} onChange={e=>f('skillId',e.target.value)}>
            <option value="">— Any —</option>{skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Billing Type</label>
          <select className="form-select" value={form.billingType} onChange={e=>f('billingType',e.target.value)}>
            <option value="TM">T&M (hourly)</option><option value="FIXED_MONTHLY">Fixed Monthly</option>
          </select>
        </div>
        {form.billingType === 'TM'
          ? <div className="form-group"><label className="form-label">Bill Rate (USD/hr)</label><input className="form-input" type="number" value={form.billRate} onChange={e=>f('billRate',e.target.value)} placeholder="95" /></div>
          : <div className="form-group"><label className="form-label">Fixed Amount (USD/month)</label><input className="form-input" type="number" value={form.fixedAmount} onChange={e=>f('fixedAmount',e.target.value)} placeholder="15000" /></div>
        }
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Plan Start</label><input className="form-input" type="date" value={form.planStart} onChange={e=>f('planStart',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Plan End</label><input className="form-input" type="date" value={form.planEnd} onChange={e=>f('planEnd',e.target.value)} /></div>
        </div>
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>createMut.mutate(form)} disabled={!form.title}>{createMut.isPending?'Saving…':'Add Role'}</button>
        </div>
      </div>
    </div>
  );
}

function AssignResourceModal({ role, project, resources, onClose, onSaved }) {
  const [form, setForm] = useState({ resourceId:'', startDate:role.planStart?.split('T')[0]||'', endDate:role.planEnd?.split('T')[0]||'', allocation:'100' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const createMut = useMutation({ mutationFn: (data)=>deploymentsApi.create({...data,roleId:role.id}), onSuccess: onSaved });
  const selected = resources.find(r=>r.id===form.resourceId);
  const rate = selected ? getCurrentUSDRate(selected) : 0;
  const WD = 21, HPD = 8;
  const hrs = WD * HPD * (parseInt(form.allocation)/100);
  const rev = role.billingType === 'FIXED_MONTHLY' ? (role.fixedAmount||0) : hrs * (role.billRate||0);
  const cost = hrs * rate;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title">Assign to "{role.title}" <button onClick={onClose} style={{ cursor:'pointer',color:'var(--muted)',background:'none',border:'none',fontSize:16 }}>✕</button></div>
        <div className="form-group"><label className="form-label">Resource *</label>
          <select className="form-select" value={form.resourceId} onChange={e=>f('resourceId',e.target.value)}>
            <option value="">— Select resource —</option>
            {resources.filter(r=>r.status!=='EXITED').map(r=><option key={r.id} value={r.id}>{r.name} · {r.primarySkill?.name} · {fmtRate(getCurrentUSDRate(r))}/hr</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Allocation %</label>
          <select className="form-select" value={form.allocation} onChange={e=>f('allocation',e.target.value)}>
            {[25,50,75,100].map(n=><option key={n} value={n}>{n}%</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate} onChange={e=>f('endDate',e.target.value)} /></div>
        </div>
        {selected && (
          <div className="cost-display" style={{ marginBottom:12 }}>
            <div className="cost-row"><span className="cost-label">Revenue/mo</span><span style={{ fontWeight:700,color:'var(--accent2)',fontSize:13 }}>{fmtUSD(rev)}</span></div>
            <div className="cost-row"><span className="cost-label">Cost/mo</span><span style={{ fontWeight:700,fontSize:13 }}>{fmtUSD(cost)}</span></div>
            <div className="cost-row"><span className="cost-label">Margin/mo</span><span style={{ fontWeight:700,color:(rev-cost)>=0?'var(--accent)':'var(--danger)',fontSize:13 }}>{fmtUSD(rev-cost)}</span></div>
          </div>
        )}
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>createMut.mutate(form)} disabled={!form.resourceId||createMut.isPending}>{createMut.isPending?'Assigning…':'Assign Resource'}</button>
        </div>
      </div>
    </div>
  );
}

function AddMilestoneModal({ projectId, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', plannedDate:'', plannedAmount:'' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const createMut = useMutation({ mutationFn: (data)=>projectsApi.addMilestone(projectId,data), onSuccess: onSaved });
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title">Add Milestone <button onClick={onClose} style={{ cursor:'pointer',color:'var(--muted)',background:'none',border:'none',fontSize:16 }}>✕</button></div>
        <div className="form-group"><label className="form-label">Milestone Name *</label><input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Phase 1 — Requirements Signoff" /></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Planned Date *</label><input className="form-input" type="date" value={form.plannedDate} onChange={e=>f('plannedDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Planned Amount (USD) *</label><input className="form-input" type="number" value={form.plannedAmount} onChange={e=>f('plannedAmount',e.target.value)} placeholder="50000" /></div>
        </div>
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>createMut.mutate(form)} disabled={!form.name||!form.plannedDate||!form.plannedAmount}>{createMut.isPending?'Saving…':'Add Milestone'}</button>
        </div>
      </div>
    </div>
  );
}
