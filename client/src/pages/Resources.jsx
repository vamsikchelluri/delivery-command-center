// src/pages/Resources.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { resourcesApi, skillsApi } from '../lib/api';
import { statusBadgeClass, statusLabel, getCurrentUSDRate, fmtUSD, fmtRate } from '../lib/costEngine';
import ResourceModal from '../components/resources/ResourceModal';

const ALL_STATUSES = [
  { value: 'DEPLOYED',           label: 'Deployed' },
  { value: 'PARTIALLY_DEPLOYED', label: 'Partial' },
  { value: 'AVAILABLE',          label: 'Available' },
  { value: 'ON_BENCH',           label: 'On Bench' },
  { value: 'LONG_LEAVE',         label: 'Long Leave' },
  { value: 'VACATION',           label: 'Vacation' },
  { value: 'NOTICE_PERIOD',      label: 'Notice Period' },
  { value: 'INACTIVE',           label: 'Inactive' },
  { value: 'EXITED',             label: 'Exited' },
];

export default function Resources() {
  const qc = useQueryClient();
  const [search,  setSearch]  = useState('');
  const [fLoc,    setFLoc]    = useState('');
  const [fType,   setFType]   = useState('');
  const [fStatus, setFStatus] = useState('');
  const [editing,   setEditing]   = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources', { search, fLoc, fType, fStatus }],
    queryFn: () => resourcesApi.list({
      search: search || undefined,
      location: fLoc || undefined,
      employmentType: fType || undefined,
      status: fStatus || undefined,
    }),
  });

  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list });

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => resourcesApi.updateStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });

  const totals = {
    total:    resources.length,
    deployed: resources.filter(r => r.status === 'DEPLOYED').length,
    partial:  resources.filter(r => r.status === 'PARTIALLY_DEPLOYED').length,
    bench:    resources.filter(r => ['ON_BENCH', 'AVAILABLE'].includes(r.status)).length,
  };

  function openNew()    { setEditing(null); setShowModal(true); }
  function openEdit(r)  { setEditing(r);    setShowModal(true); }
  function closeModal() { setShowModal(false); setEditing(null); }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Resource Management</div>
          <div className="section-sub">Full roster · cost rates · skills · deployment history</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ width: 220 }} placeholder="🔍 Search name, skill…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 'auto' }} value={fLoc} onChange={e => setFLoc(e.target.value)}>
            <option value="">All Locations</option>
            <option value="ONSITE">Onsite</option>
            <option value="OFFSHORE">Offshore</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">All Types</option>
            <option value="FT_EMPLOYEE">FT Employee</option>
            <option value="PT_EMPLOYEE">PT Employee</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="C2C">C2C</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}>+ Add Resource</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mini-stats">
        <div className="mini-stat"><div className="mini-stat-val">{totals.total}</div><div className="mini-stat-lbl">Total</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-accent">{totals.deployed}</div><div className="mini-stat-lbl">Deployed</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-warn">{totals.partial}</div><div className="mini-stat-lbl">Partial</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-danger">{totals.bench}</div><div className="mini-stat-lbl">Bench / Available</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Resource Roster</div>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body-0 table-wrap">
          {isLoading ? (
            <div className="empty-state"><div className="empty-text">Loading…</div></div>
          ) : resources.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">No resources match your filters.</div></div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Name</th><th>Primary Skill</th><th>Sub-modules</th>
                <th>Location</th><th>Type</th><th>Cost Rate</th>
                <th>Status</th><th>Alerts</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {resources.map(r => {
                  const rate   = getCurrentUSDRate(r);
                  const subs   = r.primarySubmods || [];
                  const alerts = buildAlertIcons(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/resources/${r.id}`} style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none' }}>{r.name}</Link>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.empId || '—'}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.primarySkill?.name || '—'}</td>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {subs.slice(0,3).map(s => <span key={s} className="chip chip-gray" style={{ fontSize: 9.5 }}>{s}</span>)}
                          {subs.length > 3 && <span className="chip chip-gray" style={{ fontSize: 9.5 }}>+{subs.length-3}</span>}
                        </div>
                      </td>
                      <td><span className={`badge ${r.location === 'OFFSHORE' ? 'badge-blue' : 'badge-purple'}`}><span className="badge-dot"/>{r.location === 'OFFSHORE' ? 'Offshore' : 'Onsite'}</span></td>
                      <td><span className="badge badge-gray">{r.employmentType?.replace(/_/g,' ')}</span></td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>{fmtRate(rate)}/hr</span>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtUSD(rate * 21 * 8)}/mo</div>
                      </td>
                      <td>
                        {/* Status badge + inline dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge ${statusBadgeClass(r.status)}`}><span className="badge-dot"/>{statusLabel(r.status)}</span>
                          <select
                            className="form-select"
                            style={{ width: 'auto', fontSize: 10, padding: '2px 22px 2px 6px', height: 24, minWidth: 0 }}
                            value={r.status}
                            onChange={e => statusMut.mutate({ id: r.id, status: e.target.value })}
                            title="Change status"
                          >
                            {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td style={{ fontSize: 15 }}>{alerts || <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link to={`/resources/${r.id}`} className="btn btn-outline btn-xs">Profile</Link>
                        <button className="btn btn-outline btn-xs" style={{ marginLeft: 4 }} onClick={() => openEdit(r)}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <ResourceModal
          resource={editing}
          skills={skills}
          onClose={closeModal}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); closeModal(); }}
        />
      )}
    </div>
  );
}

function buildAlertIcons(r) {
  const today = new Date();
  const icons = [];
  const isEmp = r.employmentType === 'FT_EMPLOYEE' || r.employmentType === 'PT_EMPLOYEE';
  if (!isEmp && r.contractEnd) {
    const d = Math.ceil((new Date(r.contractEnd) - today) / 86400000);
    if (d <= 30) icons.push(<span key="c" title={`Contract ${d<=0?'expired':'expiring in '+d+'d'}`} style={{ color: d<=0?'var(--danger)':'var(--accent3)' }}>📋</span>);
  }
  if (r.visaExpiry) {
    const d = Math.ceil((new Date(r.visaExpiry) - today) / 86400000);
    if (d <= 60) icons.push(<span key="v" title={`Visa expiry in ${d}d`} style={{ color: 'var(--accent3)' }}>🛂</span>);
  }
  if (r.rolloffDate) {
    const d = Math.ceil((new Date(r.rolloffDate) - today) / 86400000);
    if (d <= 30 && d > 0) icons.push(<span key="r" title={`Roll-off in ${d}d`} style={{ color: 'var(--accent3)' }}>⏰</span>);
  }
  if (r.bgCheckStatus === 'EXPIRED') icons.push(<span key="b" title="BG check expired" style={{ color: 'var(--danger)' }}>🔒</span>);
  return icons.length ? icons : null;
}
