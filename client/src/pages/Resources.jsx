// src/pages/Resources.jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { resourcesApi, skillsApi, configApi, currenciesApi } from '../lib/api';
import { statusBadgeClass, statusLabel, getCurrentUSDRate, fmtUSD, fmtRate, computeCostRate } from '../lib/costEngine';

// ─── MAIN LIST ────────────────────────────────────────────
export default function Resources() {
  const qc = useQueryClient();
  const [view,    setView]    = useState('list'); // list | add | edit
  const [editing, setEditing] = useState(null);
  const [search,  setSearch]  = useState('');
  const [fLoc,    setFLoc]    = useState('');
  const [fType,   setFType]   = useState('');
  const [fStatus, setFStatus] = useState('');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources', { search, fLoc, fType, fStatus }],
    queryFn:  () => resourcesApi.list({ search: search||undefined, location: fLoc||undefined, employmentType: fType||undefined, status: fStatus||undefined }),
  });
  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list });

  const totals = {
    total:    resources.length,
    deployed: resources.filter(r => r.status === 'DEPLOYED').length,
    partial:  resources.filter(r => r.status === 'PARTIALLY_DEPLOYED').length,
    bench:    resources.filter(r => ['ON_BENCH','AVAILABLE'].includes(r.status)).length,
  };

  if (view === 'add')  return <ResourceForm skills={skills} onBack={() => setView('list')} onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); setView('list'); }} />;
  if (view === 'edit') return <ResourceForm skills={skills} resource={editing} onBack={() => setView('list')} onSaved={() => { qc.invalidateQueries({ queryKey: ['resources'] }); setView('list'); }} />;

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Resource Management</div>
          <div className="section-sub">Full roster · cost rates · skills · deployment history</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input className="form-input" style={{ width:210 }} placeholder="🔍 Search name, ID…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ width:'auto' }} value={fLoc} onChange={e => setFLoc(e.target.value)}>
            <option value="">All Locations</option><option value="ONSITE">Onsite</option><option value="OFFSHORE">Offshore</option>
          </select>
          <select className="form-select" style={{ width:'auto' }} value={fType} onChange={e => setFType(e.target.value)}>
            <option value="">All Types</option><option value="FT_EMPLOYEE">FT Employee</option><option value="PT_EMPLOYEE">PT Employee</option>
            <option value="CONTRACTOR">Contractor</option><option value="C2C">C2C</option>
          </select>
          <select className="form-select" style={{ width:'auto' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">All Status</option><option value="DEPLOYED">Deployed</option><option value="PARTIALLY_DEPLOYED">Partial</option>
            <option value="AVAILABLE">Available</option><option value="ON_BENCH">On Bench</option>
            <option value="LONG_LEAVE">Long Leave</option><option value="VACATION">Vacation</option>
            <option value="NOTICE_PERIOD">Notice Period</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="btn btn-primary" onClick={() => setView('add')}>+ Add Resource</button>
        </div>
      </div>

      <div className="mini-stats">
        <div className="mini-stat"><div className="mini-stat-val">{totals.total}</div><div className="mini-stat-lbl">Total</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-accent">{totals.deployed}</div><div className="mini-stat-lbl">Deployed</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-warn">{totals.partial}</div><div className="mini-stat-lbl">Partial</div></div>
        <div className="mini-stat"><div className="mini-stat-val text-danger">{totals.bench}</div><div className="mini-stat-lbl">Bench / Available</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><div className="card-dot"/>Resource Roster</div>
          <span className="text-sm text-muted">{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body-0 table-wrap">
          {isLoading
            ? <div className="empty-state"><div className="empty-text">Loading…</div></div>
            : resources.length === 0
            ? <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">No resources match your filters.</div></div>
            : (
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
                          <Link to={`/resources/${r.id}`} style={{ fontWeight:700, fontSize:12.5, color:'var(--accent)', textDecoration:'none' }}>{r.name}</Link>
                          <div style={{ fontSize:10, color:'var(--muted)' }}>{r.empId || '—'}</div>
                        </td>
                        <td style={{ fontSize:12, color:'var(--text2)' }}>{r.primarySkill?.name || '—'}</td>
                        <td style={{ maxWidth:200 }}>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                            {subs.slice(0,3).map(s => <span key={s} className="chip chip-gray" style={{ fontSize:9.5 }}>{s}</span>)}
                            {subs.length > 3 && <span className="chip chip-gray" style={{ fontSize:9.5 }}>+{subs.length-3}</span>}
                          </div>
                        </td>
                        <td><span className={`badge ${r.location==='OFFSHORE'?'badge-blue':'badge-purple'}`}><span className="badge-dot"/>{r.location==='OFFSHORE'?'Offshore':'Onsite'}</span></td>
                        <td><span className="badge badge-gray">{r.employmentType?.replace(/_/g,' ')}</span></td>
                        <td>
                          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--accent)', fontSize:12 }}>{fmtRate(rate)}/hr</span>
                          <div style={{ fontSize:10, color:'var(--muted)' }}>{fmtUSD(rate*21*8)}/mo</div>
                        </td>
                        <td><span className={`badge ${statusBadgeClass(r.status)}`}><span className="badge-dot"/>{statusLabel(r.status)}</span></td>
                        <td style={{ fontSize:15 }}>{alerts || <span className="text-muted text-xs">—</span>}</td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <Link to={`/resources/${r.id}`} className="btn btn-outline btn-xs">Profile</Link>
                          <button className="btn btn-outline btn-xs" style={{ marginLeft:3 }} onClick={() => { setEditing(r); setView('edit'); }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ─── IN-PAGE FORM ─────────────────────────────────────────
// Tab 1: Profile + Skills
// Tab 2: Employment + Cost + Payment
function ResourceForm({ resource, skills, onBack, onSaved }) {
  const isEdit = !!resource;
  const [tab, setTab] = useState('profile');

  const { data: config = {}     } = useQuery({ queryKey: ['config'],     queryFn: configApi.get });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: currenciesApi.list });
  const inrRate = currencies.find(c => c.code === 'INR')?.rateVsUSD || 88;

  const [form, setForm] = useState({
    name:'', empId:'', email:'', phone:'',
    location:'OFFSHORE', employmentType:'FT_EMPLOYEE',
    joiningDate:'', contractStart:'', contractEnd:'',
    noticePeriod:'30', rolloffDate:'',
    visaType:'NA', visaExpiry:'', bgCheckStatus:'NOT_REQUIRED',
    primarySkillId:'', primarySubmods:[],
    secondarySkills:[], // [{ skillId, submods:[] }]
    costInput:'', rateCurrency:'INR',
    paymentTerms:'Monthly Payroll', payCurrency:'INR',
    costChangeReason:'Joining',
  });

  // Pre-fill when editing
  useEffect(() => {
    if (!resource) return;
    setForm({
      name:            resource.name            || '',
      empId:           resource.empId           || '',
      email:           resource.email           || '',
      phone:           resource.phone           || '',
      location:        resource.location        || 'OFFSHORE',
      employmentType:  resource.employmentType  || 'FT_EMPLOYEE',
      joiningDate:     resource.joiningDate?.split('T')[0]    || '',
      contractStart:   resource.contractStart?.split('T')[0]  || '',
      contractEnd:     resource.contractEnd?.split('T')[0]    || '',
      noticePeriod:    String(resource.noticePeriod || 30),
      rolloffDate:     resource.rolloffDate?.split('T')[0]    || '',
      visaType:        resource.visaType        || 'NA',
      visaExpiry:      resource.visaExpiry?.split('T')[0]     || '',
      bgCheckStatus:   resource.bgCheckStatus   || 'NOT_REQUIRED',
      primarySkillId:  resource.primarySkillId  || '',
      primarySubmods:  resource.primarySubmods  || [],
      secondarySkills: (resource.secondarySkills || []).map(ss => ({ skillId: ss.skillId, submods: ss.submods || [] })),
      costInput:       String(resource.costInput || ''),
      rateCurrency:    resource.rateCurrency    || 'INR',
      paymentTerms:    resource.paymentTerms    || 'Monthly Payroll',
      payCurrency:     resource.payCurrency     || 'INR',
      costChangeReason:'Correction',
    });
  }, [resource]);

  const saveMut = useMutation({
    mutationFn: (data) => isEdit ? resourcesApi.update(resource.id, data) : resourcesApi.create(data),
    onSuccess: onSaved,
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isEmployee         = form.employmentType === 'FT_EMPLOYEE' || form.employmentType === 'PT_EMPLOYEE';
  const isOffshoreContractor = form.location === 'OFFSHORE' && !isEmployee;

  const costPreview = form.costInput ? computeCostRate({
    location: form.location, empType: form.employmentType,
    inputValue: parseFloat(form.costInput) || 0,
    inputCurrency: form.rateCurrency,
    fxRate: inrRate,
    hrsYear:  config.STANDARD_HOURS_YEAR  || 1800,
    overhead: config.OVERHEAD_MULTIPLIER  || 1.2,
  }) : null;

  // Skills helpers
  const primarySkill = skills.find(s => s.id === form.primarySkillId);

  function togglePrimarySubmod(sub) {
    f('primarySubmods', form.primarySubmods.includes(sub)
      ? form.primarySubmods.filter(s => s !== sub)
      : [...form.primarySubmods, sub]);
  }

  // Secondary skill: select from dropdown, then pick submods
  function addSecSkill(skillId) {
    if (!skillId || form.secondarySkills.find(ss => ss.skillId === skillId)) return;
    f('secondarySkills', [...form.secondarySkills, { skillId, submods: [] }]);
  }

  function removeSecSkill(skillId) {
    f('secondarySkills', form.secondarySkills.filter(ss => ss.skillId !== skillId));
  }

  function toggleSecSubmod(skillId, sub) {
    f('secondarySkills', form.secondarySkills.map(ss => {
      if (ss.skillId !== skillId) return ss;
      const submods = ss.submods.includes(sub)
        ? ss.submods.filter(s => s !== sub)
        : [...ss.submods, sub];
      return { ...ss, submods };
    }));
  }

  function handleSave() {
    if (!form.name)           { setTab('profile');    return alert('Name is required'); }
    if (!form.primarySkillId) { setTab('profile');    return alert('Primary skill is required'); }
    if (!form.costInput)      { setTab('employment'); return alert('Cost / rate is required'); }
    saveMut.mutate(form);
  }

  // Available secondary skills = all except the chosen primary
  const availableSecSkills = skills.filter(s => s.id !== form.primarySkillId);
  const chosenSecSkills     = form.secondarySkills.map(ss => skills.find(s => s.id === ss.skillId)).filter(Boolean);

  return (
    <div>
      {/* Page header */}
      <div className="section-header">
        <div>
          <div className="section-title">{isEdit ? `Edit — ${resource.name}` : 'Add New Resource'}</div>
          <div className="section-sub">{isEdit ? 'Update profile, skills, employment or cost details' : 'Fill in both tabs before saving'}</div>
        </div>
        <button className="btn btn-outline" onClick={onBack}>← Back to Roster</button>
      </div>

      {/* Two-tab card */}
      <div className="card">
        <div className="tabs">
          <div className={`tab ${tab==='profile'?'active':''}`} onClick={() => setTab('profile')}>
            👤 Profile & Skills
          </div>
          <div className={`tab ${tab==='employment'?'active':''}`} onClick={() => setTab('employment')}>
            💼 Employment, Cost & Payment
          </div>
        </div>

        {/* ── TAB 1: PROFILE + SKILLS ── */}
        {tab === 'profile' && (
          <div className="card-body">

            {/* Identity */}
            <div className="modal-section">Identity</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Ravi Kumar" />
              </div>
              <div className="form-group">
                <label className="form-label">Employee / Contractor ID</label>
                <input className="form-input" value={form.empId} onChange={e=>f('empId',e.target.value)} placeholder="EMP-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e=>f('email',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e=>f('phone',e.target.value)} />
              </div>
            </div>

            {/* Primary Skill */}
            <div className="modal-section">Primary Skill</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Skill *</label>
                <select className="form-select" value={form.primarySkillId}
                  onChange={e => { f('primarySkillId', e.target.value); f('primarySubmods', []); }}>
                  <option value="">— Select primary skill —</option>
                  {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {primarySkill?.submods?.length > 0 && (
              <div className="form-group">
                <label className="form-label">Sub-modules (select all that apply)</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {primarySkill.submods.map(sub => (
                    <span
                      key={sub}
                      onClick={() => togglePrimarySubmod(sub)}
                      style={{
                        cursor:'pointer', padding:'4px 10px', borderRadius:20, fontSize:11,
                        border:`1px solid ${form.primarySubmods.includes(sub) ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.primarySubmods.includes(sub) ? 'rgba(0,229,160,0.12)' : 'var(--surface2)',
                        color: form.primarySubmods.includes(sub) ? 'var(--accent)' : 'var(--text2)',
                        transition:'all 0.12s',
                      }}
                    >
                      {form.primarySubmods.includes(sub) ? '✓ ' : ''}{sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary Skills */}
            <div className="modal-section">Secondary Skills</div>

            {/* Dropdown to add */}
            <div className="form-group">
              <label className="form-label">Add secondary skill</label>
              <select className="form-select" style={{ maxWidth:320 }}
                value=""
                onChange={e => { addSecSkill(e.target.value); e.target.value = ''; }}>
                <option value="">— Pick a skill to add —</option>
                {availableSecSkills
                  .filter(s => !form.secondarySkills.find(ss => ss.skillId === s.id))
                  .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                }
              </select>
              <div className="form-note">Select a skill from the dropdown to add it. You can add multiple.</div>
            </div>

            {/* Each selected secondary skill — show submod toggles */}
            {form.secondarySkills.length === 0 ? (
              <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', marginBottom:12 }}>No secondary skills added yet.</div>
            ) : (
              form.secondarySkills.map(ss => {
                const sk = skills.find(s => s.id === ss.skillId);
                if (!sk) return null;
                return (
                  <div key={ss.skillId} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, padding:'12px 14px', marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:12.5 }}>{sk.name}</span>
                      <button className="btn btn-danger btn-xs" onClick={() => removeSecSkill(ss.skillId)}>Remove</button>
                    </div>
                    {sk.submods?.length > 0 ? (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {sk.submods.map(sub => (
                          <span
                            key={sub}
                            onClick={() => toggleSecSubmod(ss.skillId, sub)}
                            style={{
                              cursor:'pointer', padding:'4px 10px', borderRadius:20, fontSize:11,
                              border:`1px solid ${ss.submods.includes(sub) ? 'var(--accent2)' : 'var(--border)'}`,
                              background: ss.submods.includes(sub) ? 'rgba(59,130,246,0.1)' : 'var(--surface)',
                              color: ss.submods.includes(sub) ? 'var(--accent2)' : 'var(--text2)',
                              transition:'all 0.12s',
                            }}
                          >
                            {ss.submods.includes(sub) ? '✓ ' : ''}{sub}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:'var(--muted)' }}>No sub-modules defined for this skill.</span>
                    )}
                  </div>
                );
              })
            )}

            {/* Next tab nudge */}
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20, paddingTop:14, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-primary" onClick={() => setTab('employment')}>Next — Employment & Cost →</button>
            </div>
          </div>
        )}

        {/* ── TAB 2: EMPLOYMENT + COST + PAYMENT ── */}
        {tab === 'employment' && (
          <div className="card-body">

            {/* Employment */}
            <div className="modal-section">Employment</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Location *</label>
                <select className="form-select" value={form.location}
                  onChange={e => { f('location', e.target.value); f('payCurrency', e.target.value === 'OFFSHORE' ? 'INR' : 'USD'); }}>
                  <option value="OFFSHORE">Offshore</option>
                  <option value="ONSITE">Onsite</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Employment Type *</label>
                <select className="form-select" value={form.employmentType}
                  onChange={e => {
                    const v = e.target.value;
                    f('employmentType', v);
                    f('paymentTerms', ['FT_EMPLOYEE','PT_EMPLOYEE'].includes(v) ? 'Monthly Payroll' : 'Net 30');
                  }}>
                  <option value="FT_EMPLOYEE">FT Employee</option>
                  <option value="PT_EMPLOYEE">PT Employee</option>
                  <option value="CONTRACTOR">Contractor</option>
                  <option value="C2C">C2C</option>
                </select>
              </div>
            </div>

            {isEmployee ? (
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input className="form-input" type="date" value={form.joiningDate} onChange={e=>f('joiningDate',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notice Period</label>
                  <select className="form-select" value={form.noticePeriod} onChange={e=>f('noticePeriod',e.target.value)}>
                    <option value="15">15 days</option><option value="30">30 days</option>
                    <option value="60">60 days</option><option value="90">90 days</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Contract Start</label>
                  <input className="form-input" type="date" value={form.contractStart} onChange={e=>f('contractStart',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contract End</label>
                  <input className="form-input" type="date" value={form.contractEnd} onChange={e=>f('contractEnd',e.target.value)} />
                </div>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Roll-off / Exit Date (if known)</label>
                <input className="form-input" type="date" value={form.rolloffDate} onChange={e=>f('rolloffDate',e.target.value)} />
                <div className="form-note">Triggers bench planning alerts 30 days before.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Background Check</label>
                <select className="form-select" value={form.bgCheckStatus} onChange={e=>f('bgCheckStatus',e.target.value)}>
                  <option value="NOT_REQUIRED">Not Required</option>
                  <option value="PENDING">Pending</option>
                  <option value="CLEARED">Cleared</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Visa / Work Auth</label>
                <select className="form-select" value={form.visaType} onChange={e=>f('visaType',e.target.value)}>
                  <option value="NA">NA (Offshore)</option><option value="H1B">H1B</option>
                  <option value="OPT">OPT</option><option value="GC">Green Card</option>
                  <option value="Citizen">US Citizen</option><option value="L1">L1</option><option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Visa Expiry Date</label>
                <input className="form-input" type="date" value={form.visaExpiry} onChange={e=>f('visaExpiry',e.target.value)} />
              </div>
            </div>

            {/* Cost Rate */}
            <div className="modal-section">Cost Rate</div>
            <div className="info-box">
              {form.location==='OFFSHORE' && isEmployee      && 'Offshore FT/PT: Enter annual CTC in INR. Formula: (CTC ÷ FX ÷ hrs/year) × overhead'}
              {isOffshoreContractor                          && 'Offshore Contractor/C2C: Enter hourly rate. No overhead applied.'}
              {form.location==='ONSITE'   && isEmployee      && 'Onsite FT/PT: Enter annual salary in USD. Formula: (Salary ÷ hrs/year) × overhead'}
              {form.location==='ONSITE'   && !isEmployee     && 'Onsite Contractor/C2C: Enter hourly rate in USD. No overhead applied.'}
            </div>

            <div className="form-grid-2">
              {isOffshoreContractor && (
                <div className="form-group">
                  <label className="form-label">Rate Currency</label>
                  <select className="form-select" value={form.rateCurrency} onChange={e=>f('rateCurrency',e.target.value)}>
                    <option value="INR">INR ₹</option><option value="USD">USD $</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">
                  {form.location==='OFFSHORE' && isEmployee ? 'CTC per Annum (INR ₹) *'
                  : form.location==='ONSITE'  && isEmployee ? 'Annual Salary (USD $) *'
                  : `Hourly Rate (${form.rateCurrency}) *`}
                </label>
                <input className="form-input" type="number" value={form.costInput} onChange={e=>f('costInput',e.target.value)}
                  placeholder={form.location==='OFFSHORE'&&isEmployee?'2400000':form.location==='ONSITE'&&isEmployee?'130000':'95'} />
              </div>
            </div>

            {costPreview && (
              <div className="cost-display" style={{ marginBottom:14 }}>
                <div className="cost-row">
                  <span className="cost-label">Computed USD/hr</span>
                  <span className="cost-value">${costPreview.usd.toFixed(2)}/hr</span>
                </div>
                {costPreview.inr && (
                  <div className="cost-row">
                    <span className="cost-label">Computed INR/hr</span>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--accent2)' }}>₹{costPreview.inr.toFixed(0)}/hr</span>
                  </div>
                )}
                <div className="cost-row">
                  <span className="cost-label">Monthly Cost (21d × 8h)</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>${(costPreview.usd*21*8).toFixed(0)}/mo</span>
                </div>
                <div className="cost-row">
                  <span className="cost-label">Formula</span>
                  <span className="cost-note">{costPreview.formula}</span>
                </div>
              </div>
            )}

            {isEdit && (
              <div className="form-group">
                <label className="form-label">Reason for Rate Change</label>
                <select className="form-select" value={form.costChangeReason} onChange={e=>f('costChangeReason',e.target.value)}>
                  <option value="Increment">Annual Increment</option>
                  <option value="Renegotiation">Rate Renegotiation</option>
                  <option value="Promotion">Promotion</option>
                  <option value="Correction">Correction</option>
                </select>
              </div>
            )}

            {/* Payment */}
            <div className="modal-section">Payment</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select className="form-select" value={form.paymentTerms} onChange={e=>f('paymentTerms',e.target.value)}>
                  <option>Monthly Payroll</option><option>Net 30</option><option>Net 60</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Currency</label>
                <select className="form-select" value={form.payCurrency} onChange={e=>f('payCurrency',e.target.value)}>
                  <option value="INR">INR ₹</option><option value="USD">USD $</option>
                </select>
              </div>
            </div>

            {/* Save bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-outline" onClick={() => setTab('profile')}>← Back to Profile & Skills</button>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-outline" onClick={onBack}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Resource'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ALERT ICONS ─────────────────────────────────────────
function buildAlertIcons(r) {
  const today = new Date();
  const icons  = [];
  const isEmp  = r.employmentType==='FT_EMPLOYEE' || r.employmentType==='PT_EMPLOYEE';
  if (!isEmp && r.contractEnd) {
    const d = Math.ceil((new Date(r.contractEnd)-today)/86400000);
    if (d<=30) icons.push(<span key="c" title={`Contract ${d<=0?'expired':'expiring in '+d+'d'}`} style={{ color:d<=0?'var(--danger)':'var(--accent3)' }}>📋</span>);
  }
  if (r.visaExpiry) {
    const d = Math.ceil((new Date(r.visaExpiry)-today)/86400000);
    if (d<=60) icons.push(<span key="v" title={`Visa expiry in ${d}d`} style={{ color:'var(--accent3)' }}>🛂</span>);
  }
  if (r.rolloffDate) {
    const d = Math.ceil((new Date(r.rolloffDate)-today)/86400000);
    if (d<=30&&d>0) icons.push(<span key="r" title={`Roll-off in ${d}d`} style={{ color:'var(--accent3)' }}>⏰</span>);
  }
  if (r.bgCheckStatus==='EXPIRED') icons.push(<span key="b" title="BG check expired" style={{ color:'var(--danger)' }}>🔒</span>);
  return icons.length ? icons : null;
}
