// src/pages/Projects.jsx — Full CRUD, PM/DM/AM dropdowns
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, deploymentsApi, actualsApi, resourcesApi, skillsApi } from '../lib/api';
import { usersApi } from '../lib/auth';
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

const STATUS_BADGE = { ACTIVE:'badge-green', DRAFT:'badge-gray', ON_HOLD:'badge-yellow', COMPLETED:'badge-blue', TERMINATED:'badge-red', INACTIVE:'badge-gray' };

export default function Projects() {
  const qc = useQueryClient();
  const [view, setView]           = useState('list');
  const [activeProj, setActiveProj] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsApi.list({ status: statusFilter || undefined }),
  });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => resourcesApi.list() });

  const deleteMut = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  function openDetail(p) { setActiveProj(p); setView('detail'); }
  function backToList()  { setActiveProj(null); setView('list'); }

  if (view === 'detail' && activeProj) {
    return <SOWDetail projectId={activeProj.id} resources={resources} onBack={backToList} onDeleted={backToList} />;
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
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="form-select" style={{ width:'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option><option value="ON_HOLD">On Hold</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New SOW</button>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { label:'Active SOWs',  value:totals.active,  color:'var(--accent)',                                          icon:'📋' },
          { label:'Total Revenue',value:fmtUSD(totals.revenue), color:'var(--accent2)',                                 icon:'💰' },
          { label:'Gross Margin', value:fmtUSD(totals.margin),  color:totals.margin>=0?'var(--accent)':'var(--danger)', icon:'📈' },
          { label:'Avg Margin %', value:totals.revenue>0?Math.round((totals.margin/totals.revenue)*100)+'%':'0%', color:'var(--purple)', icon:'%' },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color':k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
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
              <div className="empty-text">No SOWs found. Click "+ New SOW" to create one.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Client / Project</th><th>SOW #</th><th>Type</th><th>PM / DM / AM</th>
                <th>Revenue</th><th>Margin %</th><th>Hours</th><th>Days Left</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {projects.map(p => {
                  const pl   = computeSOWPL(p, resources);
                  const days = daysLeft(p.endDate);
                  const milestonesDue = (p.milestones || []).filter(m => m.status === 'UPCOMING' && daysLeft(m.plannedDate) <= 14 && daysLeft(m.plannedDate) >= 0).length;
                  return (
                    <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => openDetail(p)}>
                      <td>
                        <div style={{ fontWeight:700 }}>{p.client}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{p.name}</div>
                      </td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{p.sowNumber || '—'}</td>
                      <td><span className={`badge ${p.sowType==='FIXED'?'badge-purple':'badge-blue'}`}>{p.sowType}</span></td>
                      <td>
                        <div style={{ fontSize:11, lineHeight:1.8 }}>
                          {p.pm && <div><span style={{ color:'var(--muted)' }}>PM </span>{p.pm.name}</div>}
                          {p.dm && <div><span style={{ color:'var(--muted)' }}>DM </span>{p.dm.name}</div>}
                          {p.am && <div><span style={{ color:'var(--muted)' }}>AM </span>{p.am.name}</div>}
                          {!p.pm && !p.dm && !p.am && <span style={{ color:'var(--muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>{fmtUSD(pl.totalRevenue)}</td>
                      <td><span style={{ fontWeight:700, color:marginColor(pl.marginPct) }}>{pl.marginPct.toFixed(1)}%</span></td>
                      <td style={{ minWidth:110 }}>
                        <div className="progress-wrap">
                          <div className="progress-bg"><div className="progress-fill" style={{ width:`${Math.min(pl.hoursUsedPct,100)}%`, background:progressColor(pl.hoursUsedPct) }} /></div>
                          <span className="progress-label">{pl.hoursUsedPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        {days === null ? '—' : days < 0 ? <span className="badge badge-red">Expired</span>
                          : days <= 30 ? <span className="badge badge-yellow">{days}d</span>
                          : <span style={{ fontSize:11, color:'var(--muted)' }}>{days}d</span>}
                        {milestonesDue > 0 && <span className="badge badge-yellow" style={{ marginLeft:4 }}>⚑ {milestonesDue}</span>}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[p.status]||'badge-gray'}`}><span className="badge-dot" />{p.status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-accent btn-xs" onClick={() => openDetail(p)}>Open →</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <SOWFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(p) => { qc.invalidateQueries({ queryKey:['projects'] }); setShowCreate(false); openDetail(p); }}
        />
      )}
    </div>
  );
}

// ── SOW DETAIL ─────────────────────────────────────────────────────────────
function SOWDetail({ projectId, resources, onBack, onDeleted }) {
  const qc = useQueryClient();
  const [activeTab,   setActiveTab]   = useState('overview');
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddMS,   setShowAddMS]   = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    refetchInterval: 15000,
  });
  const { data: skills = [] } = useQuery({ queryKey:['skills'], queryFn: skillsApi.list });

  const updateMut = useMutation({
    mutationFn: (data) => projectsApi.update(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey:['project', projectId] }),
  });
  const deleteMut = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: onDeleted,
  });

  if (isLoading || !project) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const pl   = computeSOWPL(project, resources);
  const days = daysLeft(project.endDate);
  const refreshProject = () => qc.invalidateQueries({ queryKey:['project', projectId] });

  return (
    <div>
      <div className="section-header">
        <div>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>
            <span style={{ cursor:'pointer', color:'var(--accent)' }} onClick={onBack}>Projects</span> / {project.client}
          </div>
          <div className="section-title">{project.client} — {project.name}</div>
          <div className="section-sub">
            {project.sowNumber && <span style={{ marginRight:10 }}>SOW: {project.sowNumber}</span>}
            {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
            {days !== null && <span style={{ marginLeft:8, color:days<0?'var(--danger)':days<=30?'var(--accent3)':'var(--muted)' }}>· {days<0?'Expired':`${days}d remaining`}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span className={`badge ${project.sowType==='FIXED'?'badge-purple':'badge-blue'}`}>{project.sowType==='FIXED'?'Fixed Price':'T&M'}</span>
          <select className="form-select" style={{ width:'auto' }} value={project.status} onChange={e => updateMut.mutate({ status:e.target.value })}>
            <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option><option value="TERMINATED">Terminated</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>✎ Edit SOW</button>
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Revenue', value:fmtUSD(pl.totalRevenue),  color:'var(--accent2)' },
          { label:'Total Cost',    value:fmtUSD(pl.totalCost),     color:'var(--text)' },
          { label:'Gross Margin',  value:fmtUSD(pl.margin),        color:pl.margin>=0?'var(--accent)':'var(--danger)' },
          { label:'Margin %',      value:`${pl.marginPct.toFixed(1)}%`, color:marginColor(pl.marginPct) },
          { label:'Hours Used',    value:`${pl.totalActualHrs.toFixed(0)} / ${pl.totalPlannedHrs.toFixed(0)}h`, color:'var(--text2)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:9.5, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:5, fontFamily:'var(--font-mono)' }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs">
          {['overview','roles','milestones','actuals'].map(t => (
            <div key={t} className={`tab ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>
              {t==='overview'?'Overview':t==='roles'?'Roles & Deployments':t==='milestones'?'Milestones':'Monthly Actuals'}
            </div>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="card-body">
            <div className="form-grid-2">
              <div>
                <div className="modal-section">Engagement Info</div>
                {[
                  ['Client',          project.client],
                  ['Project Name',     project.name],
                  ['SOW Number',       project.sowNumber || '—'],
                  ['Type',             project.sowType],
                  ['Currency',         project.currency],
                  ['Start Date',       fmtDate(project.startDate)],
                  ['End Date',         fmtDate(project.endDate)],
                  ['Contract Value',   project.totalValue ? fmtUSD(project.totalValue) : '—'],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                    <span style={{ color:'var(--muted)' }}>{k}</span>
                    <span style={{ fontWeight:600, color:'var(--text2)' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="modal-section">Team</div>
                {[
                  ['Project Manager',   project.pm?.name || '—'],
                  ['Delivery Manager',  project.dm?.name || '—'],
                  ['Account Manager',   project.am?.name || '—'],
                  ['Client Contact',    project.clientContact || '—'],
                  ['Client Ref / PO',   project.clientRef || '—'],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                    <span style={{ color:'var(--muted)' }}>{k}</span>
                    <span style={{ fontWeight:600, color:'var(--text2)' }}>{v}</span>
                  </div>
                ))}
                {project.notes && (
                  <>
                    <div className="modal-section">Notes</div>
                    <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{project.notes}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="card-body">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddRole(true)}>+ Add Role</button>
            </div>
            {(project.roles || []).length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">No roles yet.</div></div>
            ) : (project.roles || []).map(role => (
              <RoleCard key={role.id} role={role} project={project} resources={resources} skills={skills} projectId={projectId} onRefresh={refreshProject} />
            ))}
          </div>
        )}

        {activeTab === 'milestones' && project.sowType === 'FIXED' && (
          <div className="card-body">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddMS(true)}>+ Add Milestone</button>
            </div>
            <MilestonesTab project={project} projectId={projectId} onRefresh={refreshProject} />
          </div>
        )}
        {activeTab === 'milestones' && project.sowType !== 'FIXED' && (
          <div className="card-body"><div className="info-box">Milestones are for Fixed Price SOWs. This is a T&M engagement.</div></div>
        )}

        {activeTab === 'actuals' && (
          <div className="card-body">
            {(project.roles || []).flatMap(role => (role.deployments || []).map(dep => (
              <ActualsRow key={dep.id} dep={dep} role={role} resources={resources} projectId={projectId} />
            )))}
            {(project.roles || []).flatMap(r => r.deployments || []).length === 0 && (
              <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">No deployments yet.</div></div>
            )}
          </div>
        )}
      </div>

      {showAddRole && <AddRoleModal project={project} skills={skills} onClose={() => setShowAddRole(false)} onSaved={() => { setShowAddRole(false); refreshProject(); }} />}
      {showAddMS   && <AddMilestoneModal projectId={projectId} onClose={() => setShowAddMS(false)} onSaved={() => { setShowAddMS(false); refreshProject(); }} />}
      {showEdit    && <SOWFormModal project={project} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); refreshProject(); }} />}
    </div>
  );
}

// ── ROLE CARD WITH EDIT/DELETE ─────────────────────────────────────────────
function RoleCard({ role, project, resources, skills, projectId, onRefresh }) {
  const qc = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editForm,   setEditForm]   = useState(null);

  const deleteMut = useMutation({
    mutationFn: () => projectsApi.deleteRole(role.id),
    onSuccess: onRefresh,
  });
  const updateMut = useMutation({
    mutationFn: (data) => projectsApi.updateRole(role.id, data),
    onSuccess: () => { setEditing(false); onRefresh(); },
  });
  const deleteDepMut = useMutation({
    mutationFn: (depId) => deploymentsApi.delete(depId),
    onSuccess: onRefresh,
  });

  const ef = editForm || { title:role.title, skillId:role.skillId||'', billRate:role.billRate||'', billingType:role.billingType, fixedAmount:role.fixedAmount||'', planStart:role.planStart?.split('T')[0]||'', planEnd:role.planEnd?.split('T')[0]||'' };

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:10, marginBottom:12, overflow:'hidden' }}>
      {/* Role header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
        {!editing ? (
          <>
            <div>
              <span style={{ fontWeight:700, fontSize:13 }}>{role.title}</span>
              <span style={{ marginLeft:10, fontSize:11, color:'var(--muted)' }}>
                {role.billingType==='FIXED_MONTHLY' ? `$${role.fixedAmount}/mo fixed` : `$${role.billRate||'—'}/hr`}
                {' · '}{fmtDate(role.planStart)} → {fmtDate(role.planEnd)}
              </span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-outline btn-xs" onClick={() => { setEditForm({ title:role.title, skillId:role.skillId||'', billRate:role.billRate||'', billingType:role.billingType, fixedAmount:role.fixedAmount||'', planStart:role.planStart?.split('T')[0]||'', planEnd:role.planEnd?.split('T')[0]||'' }); setEditing(true); }}>✎ Edit</button>
              <button className="btn btn-accent btn-xs" onClick={() => setShowAssign(true)}>+ Assign</button>
              <button className="btn btn-danger btn-xs" onClick={() => { if (window.confirm(`Delete role "${role.title}"?`)) deleteMut.mutate(); }}>🗑</button>
            </div>
          </>
        ) : (
          <div style={{ width:'100%' }}>
            <div className="form-grid-3" style={{ marginBottom:6 }}>
              <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={ef.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Billing</label>
                <select className="form-select" value={ef.billingType} onChange={e => setEditForm(p=>({...p,billingType:e.target.value}))}>
                  <option value="TM">T&M (hourly)</option><option value="FIXED_MONTHLY">Fixed Monthly</option>
                </select>
              </div>
              {ef.billingType==='TM'
                ? <div className="form-group"><label className="form-label">Bill Rate $/hr</label><input className="form-input" type="number" value={ef.billRate} onChange={e => setEditForm(p=>({...p,billRate:e.target.value}))} /></div>
                : <div className="form-group"><label className="form-label">Fixed $/mo</label><input className="form-input" type="number" value={ef.fixedAmount} onChange={e => setEditForm(p=>({...p,fixedAmount:e.target.value}))} /></div>
              }
            </div>
            <div className="form-grid-2" style={{ marginBottom:8 }}>
              <div className="form-group"><label className="form-label">Plan Start</label><input className="form-input" type="date" value={ef.planStart} onChange={e => setEditForm(p=>({...p,planStart:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Plan End</label><input className="form-input" type="date" value={ef.planEnd} onChange={e => setEditForm(p=>({...p,planEnd:e.target.value}))} /></div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-outline btn-xs" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary btn-xs" onClick={() => updateMut.mutate(ef)} disabled={updateMut.isPending}>{updateMut.isPending?'Saving…':'Save'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Deployments */}
      {(role.deployments || []).length === 0 ? (
        <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)' }}>No resources assigned yet.</div>
      ) : (role.deployments || []).map(dep => {
        const res = resources.find(r => r.id === dep.resourceId);
        const rate = res ? getCurrentUSDRate(res) : 0;
        const WD = 21, HPD = 8;
        const hrs = WD * HPD * (dep.allocation / 100);
        const rev = role.billingType==='FIXED_MONTHLY' ? (role.fixedAmount||0) : hrs * (role.billRate||0);
        const cost = hrs * rate;
        return (
          <div key={dep.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', borderBottom:'1px solid var(--border)' }}>
            <div>
              <span style={{ fontWeight:600, fontSize:13 }}>{res?.name || 'Unknown'}</span>
              <span style={{ marginLeft:8, fontSize:11, color:'var(--muted)' }}>{dep.allocation}% · {fmtDate(dep.startDate)} → {fmtDate(dep.endDate)}</span>
            </div>
            <div style={{ display:'flex', gap:16, alignItems:'center', fontSize:12 }}>
              <span style={{ color:'var(--accent2)', fontFamily:'var(--font-mono)' }}>{fmtUSD(rev)}/mo rev</span>
              <span style={{ color:'var(--muted)', fontFamily:'var(--font-mono)' }}>{fmtUSD(cost)}/mo cost</span>
              <span style={{ color:(rev-cost)>=0?'var(--accent)':'var(--danger)', fontFamily:'var(--font-mono)' }}>{fmtUSD(rev-cost)}/mo margin</span>
              <button className="btn btn-danger btn-xs" onClick={() => { if (window.confirm('Remove this resource deployment?')) deleteDepMut.mutate(dep.id); }}>✕</button>
            </div>
          </div>
        );
      })}

      {showAssign && <AssignResourceModal role={role} project={project} resources={resources} onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); onRefresh(); }} />}
    </div>
  );
}

// ── MILESTONES TAB WITH EDIT/DELETE ────────────────────────────────────────
function MilestonesTab({ project, projectId, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => projectsApi.updateMilestone(id, data),
    onSuccess: () => { setEditing(null); onRefresh(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => projectsApi.deleteMilestone(id),
    onSuccess: onRefresh,
  });

  const MS_STATUS = ['UPCOMING','INVOICED','PAID'];
  const MS_BADGE  = { UPCOMING:'badge-yellow', INVOICED:'badge-blue', PAID:'badge-green' };

  return (
    <div>
      {(project.milestones || []).length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏁</div><div className="empty-text">No milestones yet.</div></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Milestone</th><th>Planned Date</th><th>Planned $</th><th>Actual Date</th><th>Actual $</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(project.milestones || []).map(m => {
              const isEdit = editing === m.id;
              if (isEdit) {
                return (
                  <tr key={m.id}>
                    <td><input className="form-input" value={editForm.name||''} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} /></td>
                    <td><input className="form-input" type="date" value={editForm.plannedDate?.split('T')[0]||''} onChange={e=>setEditForm(p=>({...p,plannedDate:e.target.value}))} /></td>
                    <td><input className="form-input" type="number" value={editForm.plannedAmount||''} onChange={e=>setEditForm(p=>({...p,plannedAmount:e.target.value}))} /></td>
                    <td><input className="form-input" type="date" value={editForm.actualDate?.split('T')[0]||''} onChange={e=>setEditForm(p=>({...p,actualDate:e.target.value}))} /></td>
                    <td><input className="form-input" type="number" value={editForm.actualAmount||''} onChange={e=>setEditForm(p=>({...p,actualAmount:e.target.value}))} /></td>
                    <td>
                      <select className="form-select" value={editForm.status||''} onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}>
                        {MS_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-xs" onClick={() => setEditing(null)} style={{ marginRight:4 }}>Cancel</button>
                      <button className="btn btn-primary btn-xs" onClick={() => updateMut.mutate({ id:m.id, data:editForm })} disabled={updateMut.isPending}>Save</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight:600 }}>{m.name}</td>
                  <td>{fmtDate(m.plannedDate)}</td>
                  <td style={{ fontFamily:'var(--font-mono)' }}>{fmtUSD(m.plannedAmount)}</td>
                  <td>{m.actualDate ? fmtDate(m.actualDate) : '—'}</td>
                  <td style={{ fontFamily:'var(--font-mono)' }}>{m.actualAmount ? fmtUSD(m.actualAmount) : '—'}</td>
                  <td><span className={`badge ${MS_BADGE[m.status]}`}><span className="badge-dot" />{m.status}</span></td>
                  <td>
                    <button className="btn btn-outline btn-xs" style={{ marginRight:4 }} onClick={() => { setEditing(m.id); setEditForm({ name:m.name, plannedDate:m.plannedDate, plannedAmount:m.plannedAmount, actualDate:m.actualDate||'', actualAmount:m.actualAmount||'', status:m.status }); }}>✎</button>
                    <button className="btn btn-danger btn-xs" onClick={() => { if (window.confirm(`Delete milestone "${m.name}"?`)) deleteMut.mutate(m.id); }}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── ACTUALS ROW ────────────────────────────────────────────────────────────
function ActualsRow({ dep, role, resources, projectId }) {
  const qc = useQueryClient();
  const r = resources.find(x => x.id === dep.resourceId);
  const rate = r ? getCurrentUSDRate(r) : 0;
  const WD = 21, HPD = 8;
  const plannedHrsPerMonth = WD * HPD * (dep.allocation / 100);
  const saveMut = useMutation({
    mutationFn: actualsApi.upsert,
    onSuccess: () => qc.invalidateQueries({ queryKey:['project', projectId] }),
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
      <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{r?.name || 'Unknown'}</div>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>
        {role.title} · {dep.allocation}% · Planned {plannedHrsPerMonth.toFixed(0)}h/mo · {fmtRate(rate)}/hr
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {months.map(m => (
          <div key={m.key} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 10px' }}>
            <div style={{ fontSize:10, color:'var(--muted)', marginBottom:5, fontFamily:'var(--font-mono)' }}>{m.label}</div>
            <input type="number" step="0.5" placeholder={plannedHrsPerMonth.toFixed(0)} defaultValue={m.existing?.actualHours||''} className="form-input" style={{ padding:'4px 6px', fontSize:11, marginBottom:4 }}
              onBlur={e => { const val = parseFloat(e.target.value); if (!isNaN(val) && val >= 0) saveMut.mutate({ deploymentId:dep.id, month:m.key, actualHours:val }); }} />
            <div style={{ fontSize:10, color:'var(--muted)' }}>
              {m.existing ? <span style={{ color:'var(--accent)' }}>✓ {fmtUSD(m.existing.actualHours * rate)}</span> : <span>Plan: {fmtUSD(plannedHrsPerMonth * rate)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SOW FORM MODAL (Create + Edit) ─────────────────────────────────────────
function SOWFormModal({ project, onClose, onSaved }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    client:        project?.client       || '',
    name:          project?.name         || '',
    sowNumber:     project?.sowNumber    || '',
    sowType:       project?.sowType      || 'TM',
    currency:      project?.currency     || 'USD',
    startDate:     project?.startDate?.split('T')[0] || '',
    endDate:       project?.endDate?.split('T')[0]   || '',
    totalValue:    project?.totalValue   || '',
    pmUserId:      project?.pmUserId     || '',
    dmUserId:      project?.dmUserId     || '',
    amUserId:      project?.amUserId     || '',
    clientContact: project?.clientContact|| '',
    clientRef:     project?.clientRef    || '',
    notes:         project?.notes        || '',
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  // Load users filtered by role
  const { data: allUsers = [] } = useQuery({ queryKey:['users'], queryFn: usersApi.list });
  const pmUsers = allUsers.filter(u => u.role?.name === 'PROJECT_MANAGER'  && u.active);
  const dmUsers = allUsers.filter(u => u.role?.name === 'DELIVERY_MANAGER' && u.active);
  const amUsers = allUsers.filter(u => u.role?.name === 'ACCOUNT_MANAGER'  && u.active);

  const saveMut = useMutation({
    mutationFn: isEdit ? (data) => projectsApi.update(project.id, data) : projectsApi.create,
    onSuccess: onSaved,
  });

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-title">
          {isEdit ? `Edit SOW — ${project.client}` : 'New SOW / Project'}
          <button onClick={onClose} style={{ cursor:'pointer',color:'var(--muted)',background:'none',border:'none',fontSize:16 }}>✕</button>
        </div>

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
              <option value="USD">USD $</option><option value="INR">INR ₹</option><option value="GBP">GBP £</option><option value="EUR">EUR €</option>
            </select>
          </div>
        </div>
        <div className="form-grid-3">
          <div className="form-group"><label className="form-label">Start Date *</label><input className="form-input" type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date *</label><input className="form-input" type="date" value={form.endDate} onChange={e=>f('endDate',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Contract Value (USD)</label><input className="form-input" type="number" value={form.totalValue} onChange={e=>f('totalValue',e.target.value)} placeholder="250000" /></div>
        </div>

        <div className="modal-section">Project Team</div>
        <div className="form-grid-3">
          <div className="form-group">
            <label className="form-label">Project Manager</label>
            <select className="form-select" value={form.pmUserId} onChange={e=>f('pmUserId',e.target.value)}>
              <option value="">— None —</option>
              {pmUsers.length === 0 && <option disabled>No PM users yet</option>}
              {pmUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {pmUsers.length === 0 && <div className="form-note">Add a user with "Project Manager" role in Settings</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Manager</label>
            <select className="form-select" value={form.dmUserId} onChange={e=>f('dmUserId',e.target.value)}>
              <option value="">— None —</option>
              {dmUsers.length === 0 && <option disabled>No DM users yet</option>}
              {dmUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Account Manager</label>
            <select className="form-select" value={form.amUserId} onChange={e=>f('amUserId',e.target.value)}>
              <option value="">— None —</option>
              {amUsers.length === 0 && <option disabled>No AM users yet</option>}
              {amUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-section">Client & Reference</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Client Contact</label><input className="form-input" value={form.clientContact} onChange={e=>f('clientContact',e.target.value)} placeholder="Jane Doe, CTO" /></div>
          <div className="form-group"><label className="form-label">Client PO / Reference</label><input className="form-input" value={form.clientRef} onChange={e=>f('clientRef',e.target.value)} placeholder="PO-2025-0042" /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>f('notes',e.target.value)} /></div>

        {saveMut.isError && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:8 }}>{saveMut.error?.error || 'Save failed'}</div>}
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending||!form.client||!form.name||!form.startDate||!form.endDate}>
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create SOW →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADD ROLE MODAL ─────────────────────────────────────────────────────────
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
        {form.billingType==='TM'
          ? <div className="form-group"><label className="form-label">Bill Rate (USD/hr)</label><input className="form-input" type="number" value={form.billRate} onChange={e=>f('billRate',e.target.value)} placeholder="95" /></div>
          : <div className="form-group"><label className="form-label">Fixed Amount (USD/month)</label><input className="form-input" type="number" value={form.fixedAmount} onChange={e=>f('fixedAmount',e.target.value)} placeholder="15000" /></div>
        }
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Plan Start</label><input className="form-input" type="date" value={form.planStart} onChange={e=>f('planStart',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Plan End</label><input className="form-input" type="date" value={form.planEnd} onChange={e=>f('planEnd',e.target.value)} /></div>
        </div>
        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>createMut.mutate(form)} disabled={!form.title||createMut.isPending}>{createMut.isPending?'Saving…':'Add Role'}</button>
        </div>
      </div>
    </div>
  );
}

// ── ASSIGN RESOURCE MODAL ──────────────────────────────────────────────────
function AssignResourceModal({ role, project, resources, onClose, onSaved }) {
  const [form, setForm] = useState({ resourceId:'', startDate:role.planStart?.split('T')[0]||'', endDate:role.planEnd?.split('T')[0]||'', allocation:'100' });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const createMut = useMutation({ mutationFn: (data)=>deploymentsApi.create({...data,roleId:role.id}), onSuccess: onSaved });
  const selected = resources.find(r=>r.id===form.resourceId);
  const rate = selected ? getCurrentUSDRate(selected) : 0;
  const hrs  = 21 * 8 * (parseInt(form.allocation)/100);
  const rev  = role.billingType==='FIXED_MONTHLY' ? (role.fixedAmount||0) : hrs * (role.billRate||0);
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

// ── ADD MILESTONE MODAL ────────────────────────────────────────────────────
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
