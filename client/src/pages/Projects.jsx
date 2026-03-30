// src/pages/Projects.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, resourcesApi } from '../lib/api';
import api from '../lib/api';

// Fetch users (DMs, AMs) directly
const usersApi = { list: () => api.get('/users') };
import { format, parseISO, differenceInDays } from 'date-fns';

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  DRAFT:      'badge-gray',
  ACTIVE:     'badge-green',
  ON_HOLD:    'badge-yellow',
  COMPLETED:  'badge-blue',
  TERMINATED: 'badge-red',
  INACTIVE:   'badge-gray',
};
const STATUS_LABELS = {
  DRAFT: 'Draft', ACTIVE: 'Active', ON_HOLD: 'On Hold',
  COMPLETED: 'Completed', TERMINATED: 'Terminated', INACTIVE: 'Inactive',
};
const MS_STATUS_COLORS = {
  UPCOMING: 'badge-gray', INVOICED: 'badge-blue',
  RECEIVED: 'badge-green', OVERDUE: 'badge-red', REMOVED: 'badge-gray',
};

function fmtDate(d) { return d ? format(parseISO(d.split('T')[0]), 'dd MMM yyyy') : '—'; }
function fmtUSD(v)  { return v != null ? `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'; }

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Projects() {
  const qc = useQueryClient();
  const [view,      setView]      = useState('list'); // list | add | detail
  const [activeId,  setActiveId]  = useState(null);
  const [fStatus,   setFStatus]   = useState('');
  const [fClient,   setFClient]   = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', fStatus, fClient],
    queryFn:  () => projectsApi.list({ status: fStatus || undefined, client: fClient || undefined }),
  });

  function openDetail(id) { setActiveId(id); setView('detail'); }
  function backToList()   { setActiveId(null); setView('list'); }

  if (view === 'add')    return <ProjectForm onBack={() => setView('list')} onSaved={(p) => { qc.invalidateQueries({ queryKey: ['projects'] }); openDetail(p.id); }} />;
  if (view === 'detail') return <ProjectDetail projectId={activeId} onBack={backToList} />;

  const active    = projects.filter(p => p.status === 'ACTIVE').length;
  const totalVal  = projects.filter(p => p.status === 'ACTIVE').reduce((s, p) => s + (p.totalValue || 0), 0);

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Projects (SOW)</div>
          <div className="section-sub">Statement of Work · roles · team · milestones</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ width: 180 }} placeholder="Filter by client…" value={fClient} onChange={e => setFClient(e.target.value)} />
          <select className="form-select" style={{ width: 'auto' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ New Project</button>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { label: 'Total Projects',  value: projects.length, color: 'var(--text)',    mono: false },
          { label: 'Active',          value: active,          color: 'var(--accent)',  mono: false },
          { label: 'Active SOW Value',value: fmtUSD(totalVal),color: 'var(--accent2)', mono: true  },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ '--kpi-color': k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color, fontFamily: k.mono ? 'var(--font-mono)' : 'inherit' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><div className="card-dot"/>Project Register</div>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{projects.length} projects</span>
        </div>
        <div className="card-body-0 table-wrap">
          {isLoading ? (
            <div className="empty-state"><div className="empty-text">Loading…</div></div>
          ) : projects.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏗</div><div className="empty-text">No projects yet. Click "+ New Project" to create one.</div></div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Client / Project</th><th>SOW #</th><th>Status</th>
                <th>DM</th><th>AM</th><th>PM</th>
                <th>Start</th><th>End</th><th>Value</th><th>Roles</th><th></th>
              </tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.client}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.name}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sowNumber || '—'}</td>
                    <td><span className={`badge ${STATUS_COLORS[p.status] || 'badge-gray'}`}><span className="badge-dot"/>{STATUS_LABELS[p.status] || p.status}</span></td>
                    <td style={{ fontSize: 12 }}>{p.dm?.name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.am?.name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.pmResource?.name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(p.startDate)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(p.endDate)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{fmtUSD(p.totalValue)}</td>
                    <td style={{ textAlign: 'center', fontSize: 13 }}>{p.roles?.length || 0}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-accent btn-xs" onClick={() => openDetail(p.id)}>Open →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Form ──────────────────────────────────────────────────────────────
function ProjectForm({ onBack, onSaved, project }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    client:       project?.client        || '',
    name:         project?.name          || '',
    sowNumber:    project?.sowNumber     || '',
    sowType:      project?.sowType       || 'TM',
    currency:     project?.currency      || 'USD',
    startDate:    project?.startDate?.split('T')[0] || '',
    endDate:      project?.endDate?.split('T')[0]   || '',
    status:       project?.status        || 'ACTIVE',
    totalValue:   project?.totalValue    || '',
    clientRef:    project?.clientRef     || '',
    clientContact:project?.clientContact || '',
    dmUserId:     project?.dmUserId      || '',
    amUserId:     project?.amUserId      || '',
    pmResourceId: project?.pmResourceId  || '',
    notes:        project?.notes         || '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: users = [] }     = useQuery({ queryKey: ['users'],     queryFn: usersApi.list });
  const { data: resources = [] } = useQuery({ queryKey: ['resources'], queryFn: () => resourcesApi.list() });

  const dms = users.filter(u => u.active !== false);
  const pms = resources.filter(r => !['EXITED','INACTIVE'].includes(r.status));

  const createMut = useMutation({
    mutationFn: (data) => isEdit ? projectsApi.update(project.id, data) : projectsApi.create(data),
    onSuccess: onSaved,
  });

  function handleSave() {
    if (!form.client || !form.name) return alert('Client and project name are required');
    if (!form.startDate || !form.endDate) return alert('Start and end dates are required');
    createMut.mutate({
      ...form,
      dmUserId:     form.dmUserId     || null,
      amUserId:     form.amUserId     || null,
      pmResourceId: form.pmResourceId || null,
      totalValue:   form.totalValue   ? parseFloat(form.totalValue) : null,
    });
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">{isEdit ? 'Edit Project' : 'New Project'}</div>
          <div className="section-sub">SOW details, team assignment</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back</button>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="modal-section">Engagement</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Client *</label><input className="form-input" value={form.client} onChange={e=>f('client',e.target.value)} placeholder="eBay Inc." /></div>
            <div className="form-group"><label className="form-label">Project Name *</label><input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="SAP S/4HANA Rollout" /></div>
            <div className="form-group"><label className="form-label">SOW Number</label><input className="form-input" value={form.sowNumber} onChange={e=>f('sowNumber',e.target.value)} placeholder="SOW-EBAY-2025-001" /></div>
            <div className="form-group"><label className="form-label">SOW Type</label>
              <select className="form-select" value={form.sowType} onChange={e=>f('sowType',e.target.value)}>
                <option value="TM">Time &amp; Materials</option>
                <option value="FIXED">Fixed Price</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e=>f('currency',e.target.value)}>
                <option value="USD">USD $</option><option value="INR">INR ₹</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Total Value / NTE</label><input className="form-input" type="number" value={form.totalValue} onChange={e=>f('totalValue',e.target.value)} placeholder="2390530" /></div>
          </div>

          <div className="modal-section">Timeline</div>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Start Date *</label><input className="form-input" type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">End Date *</label><input className="form-input" type="date" value={form.endDate} onChange={e=>f('endDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>f('status',e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-section">Team</div>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Delivery Manager</label>
              <select className="form-select" value={form.dmUserId} onChange={e=>f('dmUserId',e.target.value)}>
                <option value="">— Unassigned —</option>
                {dms.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Account Manager</label>
              <select className="form-select" value={form.amUserId} onChange={e=>f('amUserId',e.target.value)}>
                <option value="">— Unassigned —</option>
                {dms.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Project Manager (Resource)</label>
              <select className="form-select" value={form.pmResourceId} onChange={e=>f('pmResourceId',e.target.value)}>
                <option value="">— Unassigned —</option>
                {pms.map(r => <option key={r.id} value={r.id}>{r.name}{r.primarySkill ? ` · ${r.primarySkill.name}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-section">Client Info</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Client PO / Reference</label><input className="form-input" value={form.clientRef} onChange={e=>f('clientRef',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Client Contact</label><input className="form-input" value={form.clientContact} onChange={e=>f('clientContact',e.target.value)} /></div>
          </div>

          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Context, scope notes…" /></div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={onBack}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={createMut.isPending}>
              {createMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Detail ───────────────────────────────────────────────────────────
function ProjectDetail({ projectId, onBack }) {
  const qc = useQueryClient();
  const [activeTab,  setActiveTab]  = useState('overview');
  const [editMode,   setEditMode]   = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => projectsApi.get(projectId),
    refetchInterval: 30000,
  });

  const updateMut = useMutation({
    mutationFn: (data) => projectsApi.update(projectId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setEditMode(false); },
  });

  if (isLoading || !project) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const daysLeft = project.endDate ? differenceInDays(new Date(project.endDate), new Date()) : null;

  return (
    <div>
      <div className="section-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onBack}>Projects</span> / {project.client}
          </div>
          <div className="section-title">{project.client} — {project.name}</div>
          <div className="section-sub">
            {project.sowNumber && <span style={{ marginRight: 10 }}>{project.sowNumber}</span>}
            {daysLeft !== null && <span style={{ color: daysLeft < 30 ? 'var(--danger)' : 'var(--muted)' }}>{daysLeft > 0 ? `${daysLeft}d remaining` : 'Ended'}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_COLORS[project.status]}`}><span className="badge-dot"/>{STATUS_LABELS[project.status]}</span>
          <select className="form-select" style={{ width: 'auto' }} value={project.status}
            onChange={e => updateMut.mutate({ status: e.target.value })}>
            {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* Value strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'SOW Value',    value: fmtUSD(project.totalValue), color: 'var(--accent2)' },
          { label: 'SOW Type',     value: project.sowType === 'TM' ? 'T&M' : 'Fixed Price', color: 'var(--text)' },
          { label: 'Start Date',   value: fmtDate(project.startDate), color: 'var(--text)' },
          { label: 'End Date',     value: fmtDate(project.endDate),   color: daysLeft < 30 ? 'var(--danger)' : 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs">
          {[
            { key: 'overview',   label: 'Overview' },
            { key: 'team',       label: `Team (${(project.roles||[]).length})` },
            { key: 'milestones', label: `Milestones (${(project.milestones||[]).length})` },
          ].map(t => (
            <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>{t.label}</div>
          ))}
        </div>

        {activeTab === 'overview' && (
          editMode
            ? <ProjectForm project={project} onBack={() => setEditMode(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setEditMode(false); }} />
            : <OverviewTab project={project} onEdit={() => setEditMode(true)} />
        )}

        {activeTab === 'team' && <TeamTab project={project} qc={qc} projectId={projectId} />}
        {activeTab === 'milestones' && <MilestonesTab project={project} qc={qc} projectId={projectId} />}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ project, onEdit }) {
  const rows = [
    ['Client',          project.client],
    ['Project Name',    project.name],
    ['SOW Number',      project.sowNumber || '—'],
    ['SOW Type',        project.sowType === 'TM' ? 'Time & Materials' : 'Fixed Price'],
    ['Currency',        project.currency],
    ['Total Value',     fmtUSD(project.totalValue)],
    ['Start Date',      fmtDate(project.startDate)],
    ['End Date',        fmtDate(project.endDate)],
    ['Delivery Mgr',    project.dm?.name || '—'],
    ['Account Mgr',     project.am?.name || '—'],
    ['Project Mgr',     project.pmResource?.name || '—'],
    ['Client Ref',      project.clientRef || '—'],
    ['Client Contact',  project.clientContact || '—'],
  ];
  return (
    <div className="card-body">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-outline btn-sm" onClick={onEdit}>✎ Edit Details</button>
      </div>
      <div className="form-grid-2">
        <div>{rows.slice(0,7).map(([k,v]) => (
          <div key={k} className="stat-row"><span className="stat-label">{k}</span><span className="stat-value">{v}</span></div>
        ))}</div>
        <div>{rows.slice(7).map(([k,v]) => (
          <div key={k} className="stat-row"><span className="stat-label">{k}</span><span className="stat-value">{v}</span></div>
        ))}</div>
      </div>
      {project.notes && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 9, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, border: '1px solid var(--border)' }}>
          {project.notes}
        </div>
      )}
    </div>
  );
}

// ── Team Tab (Roles & Deployments) ───────────────────────────────────────────
function TeamTab({ project, qc, projectId }) {
  const [showAddRole, setShowAddRole] = useState(false);
  const [form, setForm] = useState({ title: '', billRate: '', planStart: '', planEnd: '' });
  const f = (k,v) => setForm(p => ({...p, [k]: v}));

  const addRoleMut = useMutation({
    mutationFn: (data) => projectsApi.addRole(projectId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setShowAddRole(false); setForm({ title:'', billRate:'', planStart:'', planEnd:'' }); },
  });

  return (
    <div className="card-body">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddRole(v => !v)}>+ Add Role</button>
      </div>

      {showAddRole && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div className="modal-section" style={{ marginTop: 0 }}>New Role</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Role Title *</label><input className="form-input" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="SAP FICO Consultant" /></div>
            <div className="form-group"><label className="form-label">Bill Rate (USD/hr)</label><input className="form-input" type="number" value={form.billRate} onChange={e=>f('billRate',e.target.value)} placeholder="95" /></div>
            <div className="form-group"><label className="form-label">Plan Start *</label><input className="form-input" type="date" value={form.planStart} onChange={e=>f('planStart',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Plan End *</label><input className="form-input" type="date" value={form.planEnd} onChange={e=>f('planEnd',e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowAddRole(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => addRoleMut.mutate(form)} disabled={!form.title || !form.planStart || !form.planEnd || addRoleMut.isPending}>
              {addRoleMut.isPending ? 'Saving…' : 'Add Role'}
            </button>
          </div>
        </div>
      )}

      {(project.roles || []).length === 0 ? (
        <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">No roles defined yet.</div></div>
      ) : (
        (project.roles || []).map(role => (
          <div key={role.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 15px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{role.title}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                  {role.billRate && <span style={{ color: 'var(--accent2)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${role.billRate}/hr</span>}
                  <span>{fmtDate(role.planStart)} → {fmtDate(role.planEnd)}</span>
                  <span>{role.billingType === 'TM' ? 'T&M' : 'Fixed Monthly'}</span>
                </div>
                {(role.deployments || []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {role.deployments.map(d => (
                      <div key={d.id} style={{ fontSize: 12, color: 'var(--accent3)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span>👤 {d.resource?.name || '—'}</span>
                        <span style={{ color: 'var(--muted)' }}>{d.allocation}% · {fmtDate(d.startDate)} → {fmtDate(d.endDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="badge badge-gray" style={{ flexShrink: 0 }}>{(role.deployments||[]).length} deployed</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Milestones Tab ───────────────────────────────────────────────────────────
function MilestonesTab({ project, qc, projectId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', plannedDate: '', plannedAmount: '' });
  const f = (k,v) => setForm(p => ({...p, [k]: v}));

  const addMsMut = useMutation({
    mutationFn: (data) => projectsApi.addMilestone(projectId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setShowAdd(false); setForm({ name:'', plannedDate:'', plannedAmount:'' }); },
  });

  const updateMsMut = useMutation({
    mutationFn: ({ id, data }) => projectsApi.updateMilestone(id, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const milestones = project.milestones || [];
  const totalPlanned = milestones.reduce((s,m) => s + (m.plannedAmount || 0), 0);
  const totalReceived = milestones.filter(m => m.status === 'RECEIVED').reduce((s,m) => s + (m.actualAmount || m.plannedAmount || 0), 0);

  return (
    <div className="card-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <span>Planned: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent2)' }}>{fmtUSD(totalPlanned)}</strong></span>
          <span>Received: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmtUSD(totalReceived)}</strong></span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>+ Add Milestone</button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Milestone Name *</label><input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Phase 1 Signoff" /></div>
            <div className="form-group"><label className="form-label">Planned Date *</label><input className="form-input" type="date" value={form.plannedDate} onChange={e=>f('plannedDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Planned Amount *</label><input className="form-input" type="number" value={form.plannedAmount} onChange={e=>f('plannedAmount',e.target.value)} placeholder="50000" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => addMsMut.mutate(form)} disabled={!form.name || !form.plannedDate || !form.plannedAmount || addMsMut.isPending}>
              {addMsMut.isPending ? 'Saving…' : 'Add Milestone'}
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏁</div><div className="empty-text">No milestones yet.</div></div>
      ) : (
        <table className="data-table">
          <thead><tr>
            <th>Milestone</th><th>Planned Date</th><th>Planned Amount</th>
            <th>Actual Date</th><th>Actual Amount</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {milestones.filter(m => m.status !== 'REMOVED').map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.name}</td>
                <td style={{ fontSize: 12 }}>{fmtDate(m.plannedDate)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtUSD(m.plannedAmount)}</td>
                <td style={{ fontSize: 12 }}>{m.actualDate ? fmtDate(m.actualDate) : '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.actualAmount ? fmtUSD(m.actualAmount) : '—'}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ width: 'auto', fontSize: 11 }}
                    value={m.status}
                    onChange={e => updateMsMut.mutate({ id: m.id, data: { status: e.target.value } })}
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="INVOICED">Invoiced</option>
                    <option value="RECEIVED">Received</option>
                    <option value="OVERDUE">Overdue</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${MS_STATUS_COLORS[m.status] || 'badge-gray'}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
