// src/pages/Settings.jsx — Users, Roles/Permissions, Audit Log, Sessions, System Config
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi, rolesApi, auditApi, authApi } from '../lib/auth';
import { configApi } from '../lib/api';
import { format } from 'date-fns';

const MODULES = ['dashboard','resources','projects','pipeline','team','financials','settings'];
const MODULE_LABELS = { dashboard:'Dashboard', resources:'Resources', projects:'Projects (SOW)', pipeline:'Pipeline', team:'Team', financials:'Financials', settings:'Settings' };
const ACCESS_LEVELS = ['FULL','READ','NONE'];
const ACCESS_COLORS = { FULL:'var(--accent)', READ:'var(--accent2)', NONE:'var(--muted)' };
const FIELD_KEYS = [
  { key:'resource_cost',    label:'Resource CTC / Salary' },
  { key:'resource_rate',    label:'Resource Hourly Rate (USD)' },
  { key:'sow_billrate',     label:'SOW Bill Rates' },
  { key:'sow_margin',       label:'SOW Revenue & Margin' },
  { key:'pipeline_margin',  label:'Pipeline Revenue & Margin' },
  { key:'payment_terms',    label:'Contractor Payment Terms' },
];

function fmtDate(d) { return d ? format(new Date(d), 'dd MMM yyyy HH:mm') : '—'; }

export default function Settings() {
  const { isSuperAdmin, user } = useAuth();
  const [tab, setTab] = useState('config');

  const tabs = [
    { key:'config',    label:'⚙ System Config' },
    ...(isSuperAdmin ? [
      { key:'users',   label:'👤 Users' },
      { key:'roles',   label:'🔐 Roles & Permissions' },
      { key:'audit',   label:'📋 Audit Log' },
      { key:'session', label:'🔑 My Sessions' },
    ] : [
      { key:'session', label:'🔑 My Sessions' },
    ]),
  ];

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Settings</div>
          <div className="section-sub">System configuration · Users · Roles · Security</div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          {tabs.map(t => <div key={t.key} className={`tab ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>{t.label}</div>)}
        </div>
        <div className="card-body">
          {tab === 'config'  && <SystemConfigTab />}
          {tab === 'users'   && <UsersTab />}
          {tab === 'roles'   && <RolesTab />}
          {tab === 'audit'   && <AuditTab />}
          {tab === 'session' && <SessionsTab />}
        </div>
      </div>
    </div>
  );
}

// ── SYSTEM CONFIG ──────────────────────────────────────────
function SystemConfigTab() {
  const qc = useQueryClient();
  const { data: config = {} } = useQuery({ queryKey:['config'], queryFn: configApi.get });
  const [form, setForm] = useState(null);
  const f = form || config;
  const set = (k,v) => setForm(p => ({ ...(p||config), [k]:v }));

  const saveMut = useMutation({
    mutationFn: configApi.update,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['config'] }); setForm(null); }
  });

  return (
    <div style={{ maxWidth: 500 }}>
      <div className="modal-section">Cost Engine Parameters</div>
      <div className="form-grid-2">
        {[
          { key:'fxRate',       label:'FX Rate (INR per USD)',    placeholder:'88'   },
          { key:'hoursPerYear', label:'Billable Hours / Year',    placeholder:'1800' },
          { key:'wdPerMonth',   label:'Working Days / Month',     placeholder:'21'   },
          { key:'hpd',          label:'Hours Per Day',            placeholder:'8'    },
          { key:'overhead',     label:'Overhead Multiplier',      placeholder:'1.2'  },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="form-group">
            <label className="form-label">{label}</label>
            <input className="form-input" value={f[key] || ''} placeholder={placeholder} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
      </div>
      {form && (
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
            {saveMut.isPending ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── USERS ──────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);

  const { data: users = [] } = useQuery({ queryKey:['users'], queryFn: usersApi.list });
  const { data: roles = [] } = useQuery({ queryKey:['roles'], queryFn: rolesApi.list });

  const deleteMut = useMutation({
    mutationFn: usersApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey:['users'] }),
  });

  if (showForm || editing) return (
    <UserForm
      user={editing} roles={roles}
      onClose={() => { setShowForm(false); setEditing(null); }}
      onSaved={() => { qc.invalidateQueries({ queryKey:['users'] }); setShowForm(false); setEditing(null); }}
    />
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add User</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight:700 }}>{u.name}</td>
                <td style={{ fontSize:11.5, color:'var(--muted)' }}>{u.email}</td>
                <td><span className="badge badge-blue">{u.role?.label}</span></td>
                <td><span className={`badge ${u.active ? 'badge-green' : 'badge-gray'}`}><span className="badge-dot" />{u.active ? 'Active':'Inactive'}</span></td>
                <td style={{ fontSize:11, color:'var(--muted)' }}>{fmtDate(u.lastLogin)}</td>
                <td style={{ whiteSpace:'nowrap' }}>
                  <button className="btn btn-outline btn-xs" onClick={() => setEditing(u)}>Edit</button>
                  <button className="btn btn-danger btn-xs" style={{ marginLeft:4 }}
                    onClick={() => { if (window.confirm(`Deactivate ${u.name}?`)) deleteMut.mutate(u.id); }}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserForm({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:         user?.name     || '',
    email:        user?.email    || '',
    roleId:       user?.roleId   || '',
    password:     '',
    mustChangePwd: user ? user.mustChangePwd : true,
    active:       user?.active   ?? true,
  });
  const f = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? usersApi.update(user.id, data) : usersApi.create(data),
    onSuccess: onSaved,
  });

  return (
    <div style={{ maxWidth:500 }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>{isEdit ? `Edit — ${user.name}` : 'New User'}</div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => f('name',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={e => f('email',e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Role *</label>
          <select className="form-select" value={form.roleId} onChange={e => f('roleId',e.target.value)}>
            <option value="">— Select Role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <input className="form-input" type="password" value={form.password} onChange={e => f('password',e.target.value)} placeholder={isEdit ? 'Leave blank to keep' : 'Min 8 characters'} />
        </div>
      </div>
      <div style={{ display:'flex', gap:16, marginTop:4, marginBottom:16 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)', cursor:'pointer' }}>
          <input type="checkbox" checked={form.mustChangePwd} onChange={e => f('mustChangePwd',e.target.checked)} />
          Must change password on next login
        </label>
        {isEdit && (
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)', cursor:'pointer' }}>
            <input type="checkbox" checked={form.active} onChange={e => f('active',e.target.checked)} />
            Active
          </label>
        )}
      </div>
      {saveMut.isError && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:8 }}>{saveMut.error?.error || 'Error saving'}</div>}
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.name || !form.email || !form.roleId || (!isEdit && !form.password)}>
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </div>
  );
}

// ── ROLES & PERMISSIONS ────────────────────────────────────
function RolesTab() {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey:['roles'], queryFn: rolesApi.list });
  const [activeRole, setActiveRole] = useState(null);

  const permMut = useMutation({
    mutationFn: ({ roleId, module, access }) => rolesApi.setPermission(roleId, { module, access }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['roles'] }),
  });
  const fieldMut = useMutation({
    mutationFn: ({ roleId, fieldKey, visible }) => rolesApi.setFieldPerm(roleId, { fieldKey, visible }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['roles'] }),
  });

  const selected = activeRole ? roles.find(r => r.id === activeRole) : null;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:16 }}>
      {/* Role list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, fontFamily:'var(--font-mono)' }}>Roles</div>
        {roles.map(r => (
          <button key={r.id} onClick={() => setActiveRole(r.id)}
            style={{ textAlign:'left', background: activeRole===r.id ? 'rgba(0,229,160,0.1)':'var(--surface2)', border:`1px solid ${activeRole===r.id ? 'var(--accent)':'var(--border)'}`, borderRadius:8, padding:'8px 12px', cursor:'pointer', color: activeRole===r.id ? 'var(--accent)':'var(--text2)', fontSize:12, fontWeight: activeRole===r.id ? 700:400 }}>
            {r.label}
            <span style={{ display:'block', fontSize:10, color:'var(--muted)', fontWeight:400, marginTop:1 }}>{r._count?.users || 0} users</span>
          </button>
        ))}
      </div>

      {/* Permission matrix */}
      {!selected ? (
        <div className="empty-state"><div className="empty-text">Select a role to configure permissions</div></div>
      ) : (
        <div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{selected.label}</div>
          <div style={{ fontSize:11.5, color:'var(--muted)', marginBottom:16 }}>{selected.description}</div>

          <div className="modal-section">Module Access</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
            {MODULES.map(mod => {
              const perm = selected.permissions?.find(p => p.module === mod);
              const current = perm?.access || 'NONE';
              return (
                <div key={mod} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:12.5, color:'var(--text2)' }}>{MODULE_LABELS[mod]}</span>
                  <div style={{ display:'flex', gap:4 }}>
                    {ACCESS_LEVELS.map(level => (
                      <button key={level} onClick={() => permMut.mutate({ roleId:selected.id, module:mod, access:level })}
                        style={{ padding:'3px 10px', borderRadius:5, border:'1px solid var(--border)', fontSize:10.5, fontWeight:600, cursor:'pointer', background: current===level ? 'rgba(0,229,160,0.12)':'var(--surface)', color: current===level ? ACCESS_COLORS[level]:'var(--muted)', borderColor: current===level ? ACCESS_COLORS[level]:'var(--border)' }}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="modal-section">Sensitive Field Visibility</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {FIELD_KEYS.map(({ key, label }) => {
              const fp = selected.fieldPerms?.find(f => f.fieldKey === key);
              const visible = fp?.visible ?? false;
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:12.5, color:'var(--text2)' }}>{label}</span>
                  <button onClick={() => fieldMut.mutate({ roleId:selected.id, fieldKey:key, visible:!visible })}
                    style={{ padding:'3px 14px', borderRadius:5, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', background: visible ? 'rgba(0,229,160,0.15)':'rgba(239,68,68,0.1)', color: visible ? 'var(--accent)':'var(--danger)' }}>
                    {visible ? '✓ Visible' : '✕ Hidden'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUDIT LOG ──────────────────────────────────────────────
function AuditTab() {
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');

  const { data } = useQuery({
    queryKey: ['audit', module, action],
    queryFn:  () => auditApi.list({ module: module||undefined, action: action||undefined, limit:100 }),
  });

  const logs = data?.logs || [];

  const ACTION_COLORS = { CREATE:'badge-green', UPDATE:'badge-blue', DELETE:'badge-red', LOGIN:'badge-gray', LOGOUT:'badge-gray' };

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <select className="form-select" style={{ width:'auto' }} value={module} onChange={e => setModule(e.target.value)}>
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
          <option value="auth">Auth</option>
        </select>
        <select className="form-select" style={{ width:'auto' }} value={action} onChange={e => setAction(e.target.value)}>
          <option value="">All Actions</option>
          {['CREATE','UPDATE','DELETE','LOGIN','LOGOUT'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{fmtDate(l.createdAt)}</td>
                <td style={{ fontSize:11.5 }}>{l.userEmail || '—'}</td>
                <td><span className={`badge ${ACTION_COLORS[l.action]}`}>{l.action}</span></td>
                <td style={{ fontSize:11.5 }}>{l.module}</td>
                <td style={{ fontSize:11.5, color:'var(--muted)' }}>{l.recordLabel || l.recordId || '—'}</td>
                <td style={{ fontSize:10.5, color:'var(--muted)' }}>{l.ipAddress || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>No audit logs found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SESSIONS ───────────────────────────────────────────────
function SessionsTab() {
  const qc = useQueryClient();
  const { data: sessions = [] } = useQuery({ queryKey:['sessions'], queryFn: authApi.sessions });

  const logoutAllMut = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess:  () => qc.invalidateQueries({ queryKey:['sessions'] }),
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:13, color:'var(--muted)' }}>{sessions.length} active session{sessions.length!==1?'s':''}</div>
        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Log out all sessions? You will need to sign in again.')) logoutAllMut.mutate(); }}>
          Log Out All Sessions
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>IP Address</th><th>Browser / Device</th><th>Created</th><th>Expires</th></tr></thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize:12, fontFamily:'var(--font-mono)' }}>{s.ipAddress || '—'}</td>
                <td style={{ fontSize:11.5, color:'var(--muted)', maxWidth:260 }}>{s.userAgent?.slice(0,80) || '—'}</td>
                <td style={{ fontSize:11 }}>{fmtDate(s.createdAt)}</td>
                <td style={{ fontSize:11, color:'var(--muted)' }}>{fmtDate(s.expiresAt)}</td>
              </tr>
            ))}
            {sessions.length===0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>No active sessions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
