// src/pages/Team.jsx — Account Managers & Delivery Managers
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '../lib/api';

const ROLES = ['DELIVERY_MANAGER', 'ACCOUNT_MANAGER', 'PROJECT_MANAGER'];
const ROLE_LABELS = { DELIVERY_MANAGER: 'Delivery Manager', ACCOUNT_MANAGER: 'Account Manager', PROJECT_MANAGER: 'Project Manager' };
const ROLE_COLORS = { DELIVERY_MANAGER: 'badge-blue', ACCOUNT_MANAGER: 'badge-purple', PROJECT_MANAGER: 'badge-green' };

export default function Team() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [fRole,    setFRole]    = useState('');

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['team', fRole],
    queryFn:  () => teamApi.list(fRole ? { role: fRole } : {}),
  });

  const deleteMut = useMutation({
    mutationFn: teamApi.deactivate,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  function openEdit(p) { setEditing(p); setShowForm(true); }
  function closeForm()  { setEditing(null); setShowForm(false); }

  const byRole = ROLES.reduce((acc, r) => {
    acc[r] = people.filter(p => p.role === r && p.active !== false);
    return acc;
  }, {});

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Team</div>
          <div className="section-sub">Delivery Managers · Account Managers · Project Managers</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={fRole} onChange={e => setFRole(e.target.value)}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>+ Add Person</button>
        </div>
      </div>

      {showForm && (
        <PersonForm
          person={editing}
          onClose={closeForm}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['team'] }); closeForm(); }}
        />
      )}

      {isLoading ? (
        <div className="empty-state"><div className="empty-text">Loading…</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {ROLES.filter(r => !fRole || r === fRole).map(role => (
            <div key={role} className="card">
              <div className="card-header">
                <div className="card-title">
                  <div className="card-dot"/>
                  {ROLE_LABELS[role]}
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{byRole[role]?.length || 0}</span>
              </div>
              <div className="card-body" style={{ padding: '10px 12px' }}>
                {(byRole[role] || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>None assigned</div>
                ) : (
                  (byRole[role] || []).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                        {p.email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-xs" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn btn-danger btn-xs"
                          onClick={() => { if (window.confirm(`Deactivate ${p.name}?`)) deleteMut.mutate(p.id); }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonForm({ person, onClose, onSaved }) {
  const isEdit = !!person;
  const [form, setForm] = useState({
    name:  person?.name  || '',
    role:  person?.role  || 'DELIVERY_MANAGER',
    email: person?.email || '',
    phone: person?.phone || '',
    notes: person?.notes || '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? teamApi.update(person.id, data) : teamApi.create(data),
    onSuccess: onSaved,
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-title">
          <span>{isEdit ? `Edit — ${person.name}` : 'Add Team Member'}</span>
          <button onClick={onClose} style={{ cursor: 'pointer', color: 'var(--muted)', background: 'none', border: 'none', fontSize: 16 }}>✕</button>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Dibyendu Ray" />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-select" value={form.role} onChange={e => f('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => f('phone', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Specialization, accounts managed…" />
        </div>

        {saveMut.isError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{saveMut.error?.error || 'Error saving'}</div>}

        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.name}>
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Person'}
          </button>
        </div>
      </div>
    </div>
  );
}
