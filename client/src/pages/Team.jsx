// src/pages/Team.jsx — Account Managers & Delivery Managers CRUD
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '../lib/api';

const ROLE_LABELS = {
  ACCOUNT_MANAGER:  'Account Manager',
  DELIVERY_MANAGER: 'Delivery Manager',
};

const ROLE_COLORS = {
  ACCOUNT_MANAGER:  'badge-blue',
  DELIVERY_MANAGER: 'badge-purple',
};

const EMPTY_FORM = { name: '', role: 'ACCOUNT_MANAGER', email: '', phone: '', notes: '' };

export default function Team() {
  const qc = useQueryClient();
  const [view,    setView]    = useState('list');   // list | add | edit
  const [editing, setEditing] = useState(null);
  const [filter,  setFilter]  = useState('');       // '' | role type
  const [search,  setSearch]  = useState('');

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['team', filter],
    queryFn:  () => teamApi.list(filter ? { role: filter } : {}),
  });

  const filtered = search
    ? people.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()))
    : people;

  const counts = {
    all:  people.length,
    am:   people.filter(p => p.role === 'ACCOUNT_MANAGER').length,
    dm:   people.filter(p => p.role === 'DELIVERY_MANAGER').length,
    inactive: people.filter(p => !p.active).length,
  };

  if (view === 'add')  return <PersonForm onBack={() => setView('list')} onSaved={() => { qc.invalidateQueries({ queryKey: ['team'] }); setView('list'); }} />;
  if (view === 'edit') return <PersonForm person={editing} onBack={() => setView('list')} onSaved={() => { qc.invalidateQueries({ queryKey: ['team'] }); setView('list'); }} />;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Team</div>
          <div className="section-sub">Account Managers · Delivery Managers · pipeline ownership</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" style={{ width: 200 }} placeholder="🔍 Search name, email…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="ACCOUNT_MANAGER">Account Managers</option>
            <option value="DELIVERY_MANAGER">Delivery Managers</option>
          </select>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ Add Person</button>
        </div>
      </div>

      {/* Stats */}
      <div className="mini-stats">
        <div className="mini-stat"><div className="mini-stat-val">{counts.all}</div><div className="mini-stat-lbl">Total</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-accent2">{counts.am}</div><div className="mini-stat-lbl">Account Mgrs</div></div>
        <div className="mini-stat"><div className="mini-stat-val" style={{ color: 'var(--purple)' }}>{counts.dm}</div><div className="mini-stat-lbl">Delivery Mgrs</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-muted">{counts.inactive}</div><div className="mini-stat-lbl">Inactive</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><div className="card-dot" />People Register</div>
          <span className="text-sm text-muted">{filtered.length} people</span>
        </div>
        <div className="card-body-0 table-wrap">
          {isLoading ? <div className="empty-state"><div className="empty-text">Loading…</div></div>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <div className="empty-text">No team members yet. Add your first account or delivery manager.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Notes</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(p => (
                  <PersonRow key={p.id} person={p} qc={qc}
                    onEdit={() => { setEditing(p); setView('edit'); }} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonRow({ person: p, qc, onEdit }) {
  const toggleMut = useMutation({
    mutationFn: () => teamApi.update(p.id, { active: !p.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
  const deleteMut = useMutation({
    mutationFn: () => teamApi.delete(p.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  return (
    <tr style={{ opacity: p.active ? 1 : 0.5 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent2), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{p.name}</span>
        </div>
      </td>
      <td><span className={`badge ${ROLE_COLORS[p.role]}`}>{ROLE_LABELS[p.role]}</span></td>
      <td style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.email || '—'}</td>
      <td style={{ fontSize: 11.5, color: 'var(--text2)' }}>{p.phone || '—'}</td>
      <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200 }}>{p.notes || '—'}</td>
      <td>
        <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>
          <span className="badge-dot" />{p.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-outline btn-xs" onClick={onEdit}>Edit</button>
        <button className="btn btn-outline btn-xs" style={{ marginLeft: 4 }} onClick={() => toggleMut.mutate()}>
          {p.active ? 'Deactivate' : 'Activate'}
        </button>
        <button className="btn btn-danger btn-xs" style={{ marginLeft: 4 }}
          onClick={() => { if (window.confirm(`Delete ${p.name}?`)) deleteMut.mutate(); }}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function PersonForm({ person, onBack, onSaved }) {
  const isEdit = !!person;
  const [form, setForm] = useState(person ? {
    name:  person.name  || '',
    role:  person.role  || 'ACCOUNT_MANAGER',
    email: person.email || '',
    phone: person.phone || '',
    notes: person.notes || '',
  } : { ...EMPTY_FORM });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? teamApi.update(person.id, data) : teamApi.create(data),
    onSuccess: onSaved,
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">{isEdit ? `Edit — ${person.name}` : 'Add Team Member'}</div>
          <div className="section-sub">{isEdit ? 'Update contact details or role' : 'Add an account manager or delivery manager'}</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back to Team</button>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="card-body">
          <div className="modal-section">Details</div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-select" value={form.role} onChange={e => f('role', e.target.value)}>
                <option value="ACCOUNT_MANAGER">Account Manager</option>
                <option value="DELIVERY_MANAGER">Delivery Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="jane@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+1 214 555 0100" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Territory, specialisation, anything relevant…" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <button className="btn btn-outline" onClick={onBack}>Cancel</button>
            <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.name}>
              {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Person'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
