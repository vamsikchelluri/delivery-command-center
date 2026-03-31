// src/pages/Resources.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { resourcesApi, skillsApi, configApi, currenciesApi } from '../lib/api';
import { statusBadgeClass, statusLabel, getCurrentUSDRate, fmtUSD, fmtRate, computeCostRate } from '../lib/costEngine';

const STEPS = ['1 · Identity', '2 · Skills', '3 · Employment', '4 · Cost & Payment'];

const ALL_STATUSES = [
  { value: 'DEPLOYED',           label: 'Deployed' },
  { value: 'PARTIALLY_DEPLOYED', label: 'Partially Deployed' },
  { value: 'AVAILABLE',          label: 'Available' },
  { value: 'ON_BENCH',           label: 'On Bench' },
  { value: 'EXITED',             label: 'Exited' },
];

// ── Main List ─────────────────────────────────────────────────────────────────
export default function Resources() {
  const qc = useQueryClient();
  const [search,  setSearch]  = useState('');
  const [fLoc,    setFLoc]    = useState('');
  const [fType,   setFType]   = useState('');
  const [fStatus, setFStatus] = useState('');
  const [view,    setView]    = useState('list'); // list | add | edit
  const [editing, setEditing] = useState(null);

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

  if (view === 'add') return (
    <ResourceForm skills={skills} onBack={() => setView('list')}
      onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); setView('list'); }} />
  );
  if (view === 'edit') return (
    <ResourceForm resource={editing} skills={skills} onBack={() => { setView('list'); setEditing(null); }}
      onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); setView('list'); setEditing(null); }} />
  );

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
            <option value="">All Locations</option><option value="ONSITE">Onsite</option><option value="OFFSHORE">Offshore</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">All Types</option>
            <option value="FT_EMPLOYEE">FT Employee</option><option value="PT_EMPLOYEE">PT Employee</option>
            <option value="CONTRACTOR">Contractor</option><option value="C2C">C2C</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ Add Resource</button>
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
          <div className="card-title"><div className="card-dot"/>Resource Roster</div>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
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
                  const rate  = getCurrentUSDRate(r);
                  const subs  = r.primarySubmods || [];
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge ${statusBadgeClass(r.status)}`}><span className="badge-dot"/>{statusLabel(r.status)}</span>
                          <select className="form-select" style={{ width: 'auto', fontSize: 10, padding: '2px 22px 2px 6px', height: 24 }}
                            value={r.status} onChange={e => statusMut.mutate({ id: r.id, status: e.target.value })}>
                            {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      </td>
                      <td style={{ fontSize: 15 }}>{alerts || <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link to={`/resources/${r.id}`} className="btn btn-outline btn-xs">Profile</Link>
                        <button className="btn btn-outline btn-xs" style={{ marginLeft: 4 }}
                          onClick={() => { setEditing(r); setView('edit'); }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Resource Form (inline page, 4 steps) ─────────────────────────────────────
function ResourceForm({ resource, skills, onBack, onSaved }) {
  const isEdit = !!resource;
  const [step, setStep] = useState(0);
  const { data: config = {} }     = useQuery({ queryKey: ['config'],     queryFn: configApi.get });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: currenciesApi.list });
  const inrRate = currencies.find(c => c.code === 'INR')?.rateVsUSD || 88;

  const [form, setForm] = useState({
    name: resource?.name || '', empId: resource?.empId || '',
    email: resource?.email || '', phone: resource?.phone || '',
    location: resource?.location || 'OFFSHORE',
    employmentType: resource?.employmentType || 'FT_EMPLOYEE',
    joiningDate: resource?.joiningDate?.split('T')[0] || '',
    contractStart: resource?.contractStart?.split('T')[0] || '',
    contractEnd: resource?.contractEnd?.split('T')[0] || '',
    noticePeriod: String(resource?.noticePeriod || 30),
    rolloffDate: resource?.rolloffDate?.split('T')[0] || '',
    visaType: resource?.visaType || 'NA',
    visaExpiry: resource?.visaExpiry?.split('T')[0] || '',
    bgCheckStatus: resource?.bgCheckStatus || 'NOT_REQUIRED',
    primarySkillId: resource?.primarySkillId || '',
    primarySubmods: resource?.primarySubmods || [],
    secondarySkills: (resource?.secondarySkills || []).map(ss => ({ skillId: ss.skillId, submods: ss.submods || [] })),
    costInput: String(resource?.costInput || ''),
    rateCurrency: resource?.rateCurrency || 'INR',
    paymentTerms: resource?.paymentTerms || 'Monthly Payroll',
    payCurrency: resource?.payCurrency || 'INR',
    costChangeReason: isEdit ? 'Correction' : 'Joining',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? resourcesApi.update(resource.id, data) : resourcesApi.create(data),
    onSuccess: onSaved,
  });

  const isEmployee = form.employmentType === 'FT_EMPLOYEE' || form.employmentType === 'PT_EMPLOYEE';
  const isOffshoreContractor = form.location === 'OFFSHORE' && (form.employmentType === 'CONTRACTOR' || form.employmentType === 'C2C');

  const costPreview = form.costInput ? computeCostRate({
    location: form.location, empType: form.employmentType,
    inputValue: parseFloat(form.costInput) || 0,
    inputCurrency: form.location === 'ONSITE' ? 'USD' : form.rateCurrency,
    fxRate: inrRate,
    hrsYear: parseFloat(config.STANDARD_HOURS_YEAR) || 1800,
    overhead: parseFloat(config.OVERHEAD_MULTIPLIER) || 1.2,
  }) : null;

  const primarySkill = skills.find(s => s.id === form.primarySkillId);

  function togglePrimarySubmod(sub) {
    f('primarySubmods', form.primarySubmods.includes(sub)
      ? form.primarySubmods.filter(s => s !== sub)
      : [...form.primarySubmods, sub]);
  }
  function toggleSecSkill(skillId) {
    const exists = form.secondarySkills.find(ss => ss.skillId === skillId);
    f('secondarySkills', exists
      ? form.secondarySkills.filter(ss => ss.skillId !== skillId)
      : [...form.secondarySkills, { skillId, submods: [] }]);
  }
  function toggleSecSubmod(skillId, sub) {
    f('secondarySkills', form.secondarySkills.map(ss => {
      if (ss.skillId !== skillId) return ss;
      return { ...ss, submods: ss.submods.includes(sub) ? ss.submods.filter(s => s !== sub) : [...ss.submods, sub] };
    }));
  }

  function handleSave() {
    if (!form.name)           { setStep(0); return alert('Name is required'); }
    if (!form.primarySkillId) { setStep(1); return alert('Primary skill is required'); }
    if (!form.costInput)      { setStep(3); return alert('Cost / rate is required'); }
    saveMut.mutate(form);
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">{isEdit ? `Edit — ${resource.name}` : 'Add Resource'}</div>
          <div className="section-sub">Complete all 4 steps · use tabs to navigate</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back</button>
      </div>

      <div className="card">
        {/* Step tabs */}
        <div className="tabs">
          {STEPS.map((s, i) => (
            <div key={i} className={`tab ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}>{s}</div>
          ))}
        </div>

        <div className="card-body">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ravi Kumar" /></div>
                <div className="form-group"><label className="form-label">Employee / Contractor ID</label>
                  <input className="form-input" value={form.empId} onChange={e => f('empId', e.target.value)} placeholder="EMP-001" /></div>
                <div className="form-group"><label className="form-label">Contact Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Contact Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* Step 1: Skills */}
          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">Primary Skill *</label>
                <select className="form-select" value={form.primarySkillId} onChange={e => { f('primarySkillId', e.target.value); f('primarySubmods', []); }}>
                  <option value="">— Select primary skill —</option>
                  {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {primarySkill?.submods?.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Sub-modules</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {primarySkill.submods.map(s => (
                      <span key={s} onClick={() => togglePrimarySubmod(s)}
                        className={`chip ${form.primarySubmods.includes(s) ? '' : 'chip-gray'}`}
                        style={{ cursor: 'pointer' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Secondary Skills</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                  {skills.filter(s => s.id !== form.primarySkillId).map(s => (
                    <span key={s.id} onClick={() => toggleSecSkill(s.id)}
                      className={`chip ${form.secondarySkills.find(ss => ss.skillId === s.id) ? '' : 'chip-gray'}`}
                      style={{ cursor: 'pointer' }}>{s.name}</span>
                  ))}
                </div>
                {form.secondarySkills.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {form.secondarySkills.map(ss => {
                      const sk = skills.find(s => s.id === ss.skillId);
                      if (!sk) return null;
                      return (
                        <div key={ss.skillId} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text2)' }}>
                            {sk.name} sub-modules
                            <span onClick={() => toggleSecSkill(sk.id)} style={{ float: 'right', cursor: 'pointer', color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>✕ Remove</span>
                          </div>
                          {sk.submods?.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {sk.submods.map(sub => (
                                <span key={sub} onClick={() => toggleSecSubmod(ss.skillId, sub)}
                                  className={`chip ${ss.submods.includes(sub) ? 'chip-purple' : 'chip-gray'}`}
                                  style={{ cursor: 'pointer' }}>{sub}</span>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>No sub-modules for this skill</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Employment */}
          {step === 2 && (
            <div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Location *</label>
                  <select className="form-select" value={form.location} onChange={e => { f('location', e.target.value); f('payCurrency', e.target.value === 'OFFSHORE' ? 'INR' : 'USD'); }}>
                    <option value="OFFSHORE">Offshore</option><option value="ONSITE">Onsite</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Employment Type *</label>
                  <select className="form-select" value={form.employmentType}
                    onChange={e => { f('employmentType', e.target.value); f('paymentTerms', ['FT_EMPLOYEE','PT_EMPLOYEE'].includes(e.target.value) ? 'Monthly Payroll' : 'Net 30'); }}>
                    <option value="FT_EMPLOYEE">FT Employee</option><option value="PT_EMPLOYEE">PT Employee</option>
                    <option value="CONTRACTOR">Contractor</option><option value="C2C">C2C</option>
                  </select>
                </div>
              </div>
              {isEmployee ? (
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">Joining Date</label>
                    <input className="form-input" type="date" value={form.joiningDate} onChange={e => f('joiningDate', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Notice Period</label>
                    <select className="form-select" value={form.noticePeriod} onChange={e => f('noticePeriod', e.target.value)}>
                      <option value="15">15 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">Contract Start</label>
                    <input className="form-input" type="date" value={form.contractStart} onChange={e => f('contractStart', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Contract End</label>
                    <input className="form-input" type="date" value={form.contractEnd} onChange={e => f('contractEnd', e.target.value)} /></div>
                </div>
              )}
              <div className="form-group"><label className="form-label">Roll-off / Exit Date (if known)</label>
                <input className="form-input" type="date" value={form.rolloffDate} onChange={e => f('rolloffDate', e.target.value)} />
                <div className="form-note">Setting this triggers bench planning alerts 30 days before.</div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Visa / Work Auth</label>
                  <select className="form-select" value={form.visaType} onChange={e => f('visaType', e.target.value)}>
                    <option value="NA">NA (Offshore)</option><option value="H1B">H1B</option><option value="OPT">OPT</option>
                    <option value="GC">Green Card</option><option value="Citizen">US Citizen</option><option value="L1">L1</option>
                  </select>
                </div>
                {form.location === 'ONSITE' && (
                  <div className="form-group"><label className="form-label">Visa Expiry Date</label>
                    <input className="form-input" type="date" value={form.visaExpiry} onChange={e => f('visaExpiry', e.target.value)} /></div>
                )}
              </div>
              <div className="form-group"><label className="form-label">Background Check</label>
                <select className="form-select" value={form.bgCheckStatus} onChange={e => f('bgCheckStatus', e.target.value)}>
                  <option value="NOT_REQUIRED">Not Required</option><option value="PENDING">Pending</option>
                  <option value="CLEARED">Cleared</option><option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Cost */}
          {step === 3 && (
            <div>
              <div className="info-box">
                {form.location === 'OFFSHORE' && isEmployee && 'Offshore FT/PT: Enter annual CTC in INR.'}
                {isOffshoreContractor && 'Offshore Contractor/C2C: Enter hourly rate in INR or USD.'}
                {form.location === 'ONSITE' && isEmployee && 'Onsite FT/PT: Enter annual salary in USD.'}
                {form.location === 'ONSITE' && !isEmployee && 'Onsite Contractor/C2C: Enter hourly rate in USD.'}
              </div>
              {isOffshoreContractor && (
                <div className="form-group"><label className="form-label">Rate Currency</label>
                  <select className="form-select" value={form.rateCurrency} onChange={e => f('rateCurrency', e.target.value)}>
                    <option value="INR">INR ₹</option><option value="USD">USD $</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">
                  {form.location === 'OFFSHORE' && isEmployee ? 'CTC per Annum (INR ₹) *' :
                   form.location === 'ONSITE'   && isEmployee ? 'Annual Salary (USD $) *' :
                   form.location === 'ONSITE'                 ? 'Hourly Rate (USD $) *' :
                   `Hourly Rate (${form.rateCurrency}) *`}
                </label>
                <input className="form-input" type="number" value={form.costInput} onChange={e => f('costInput', e.target.value)}
                  placeholder={form.location === 'OFFSHORE' && isEmployee ? '2400000' : form.location === 'ONSITE' && isEmployee ? '130000' : '95'} />
              </div>
              {costPreview && (
                <div className="cost-display" style={{ marginBottom: 14 }}>
                  <div className="cost-row"><span className="cost-label">Computed USD/hr</span><span className="cost-value">${costPreview.usd.toFixed(2)}/hr</span></div>
                  {costPreview.inr && <div className="cost-row"><span className="cost-label">Computed INR/hr</span><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>₹{costPreview.inr.toFixed(0)}/hr</span></div>}
                  <div className="cost-row"><span className="cost-label">Formula</span><span className="cost-note">{costPreview.formula}</span></div>
                </div>
              )}
              {isEdit && (
                <div className="form-group"><label className="form-label">Reason for Rate Change</label>
                  <select className="form-select" value={form.costChangeReason} onChange={e => f('costChangeReason', e.target.value)}>
                    <option value="Increment">Annual Increment</option><option value="Renegotiation">Rate Renegotiation</option>
                    <option value="Promotion">Promotion</option><option value="Correction">Correction</option>
                  </select>
                </div>
              )}
              <div className="divider" />
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Payment Terms</label>
                  <select className="form-select" value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}>
                    <option>Monthly Payroll</option><option>Net 30</option><option>Net 60</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Payment Currency</label>
                  <select className="form-select" value={form.payCurrency} onChange={e => f('payCurrency', e.target.value)}>
                    <option value="INR">INR ₹</option><option value="USD">USD $</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {saveMut.isError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{saveMut.error?.error || 'Error saving'}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && <button className="btn btn-outline" onClick={() => setStep(s => s-1)}>← Previous</button>}
              {step < 3 && <button className="btn btn-primary" onClick={() => setStep(s => s+1)}>Next →</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={onBack}>Cancel</button>
              {step === 3 && (
                <button className="btn btn-primary" onClick={handleSave} disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Resource'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
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
