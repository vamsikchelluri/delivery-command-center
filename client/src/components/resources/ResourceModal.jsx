// src/components/resources/ResourceModal.jsx
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { resourcesApi } from '../../lib/api';
import { computeCostRate } from '../../lib/costEngine';
import { useQuery } from '@tanstack/react-query';
import { configApi, currenciesApi } from '../../lib/api';

const STEPS = ['1 · Identity', '2 · Skills', '3 · Employment', '4 · Cost & Payment'];

export default function ResourceModal({ resource, skills, onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const { data: config = {} }     = useQuery({ queryKey: ['config'],     queryFn: configApi.get });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: currenciesApi.list });
  const inrRate = currencies.find(c => c.code === 'INR')?.rateVsUSD || 88;

  const [form, setForm] = useState({
    firstName: '', lastName: '',
    empId: '', email: '', phone: '',
    location: 'OFFSHORE', employmentType: 'FT_EMPLOYEE',
    joiningDate: '', contractStart: '', contractEnd: '',
    noticePeriod: '30', rolloffDate: '',
    visaType: 'NA', visaExpiry: '', bgCheckStatus: 'NOT_REQUIRED',
    primarySkillId: '', primarySubmods: [],
    secondarySkills: [],
    costInput: '', rateCurrency: 'INR',
    paymentTerms: 'Monthly Payroll', payCurrency: 'INR',
    costChangeReason: 'Joining',
  });

  useEffect(() => {
    if (resource) {
      // Split existing name into first/last
      const parts = (resource.name || '').trim().split(' ');
      const firstName = parts[0] || '';
      const lastName  = parts.slice(1).join(' ') || '';
      setForm({
        firstName,
        lastName,
        empId:          resource.empId || '',
        email:          resource.email || '',
        phone:          resource.phone || '',
        location:       resource.location || 'OFFSHORE',
        employmentType: resource.employmentType || 'FT_EMPLOYEE',
        joiningDate:    resource.joiningDate?.split('T')[0] || '',
        contractStart:  resource.contractStart?.split('T')[0] || '',
        contractEnd:    resource.contractEnd?.split('T')[0] || '',
        noticePeriod:   String(resource.noticePeriod || 30),
        rolloffDate:    resource.rolloffDate?.split('T')[0] || '',
        visaType:       resource.visaType || 'NA',
        visaExpiry:     resource.visaExpiry?.split('T')[0] || '',
        bgCheckStatus:  resource.bgCheckStatus || 'NOT_REQUIRED',
        primarySkillId: resource.primarySkillId || '',
        primarySubmods: resource.primarySubmods || [],
        secondarySkills: (resource.secondarySkills || []).map(ss => ({ skillId: ss.skillId, submods: ss.submods || [] })),
        costInput:      String(resource.costInput || ''),
        rateCurrency:   resource.rateCurrency || 'INR',
        paymentTerms:   resource.paymentTerms || 'Monthly Payroll',
        payCurrency:    resource.payCurrency || 'INR',
        costChangeReason: 'Correction',
      });
    }
  }, [resource]);

  const saveMut = useMutation({
    mutationFn: (data) => resource ? resourcesApi.update(resource.id, data) : resourcesApi.create(data),
    onSuccess: onSaved,
  });

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const isEmployee = form.employmentType === 'FT_EMPLOYEE' || form.employmentType === 'PT_EMPLOYEE';
  const isOffshoreContractor = form.location === 'OFFSHORE' && (form.employmentType === 'CONTRACTOR' || form.employmentType === 'C2C');

  const costPreview = form.costInput ? computeCostRate({
    location: form.location, empType: form.employmentType,
    inputValue: parseFloat(form.costInput) || 0,
    inputCurrency: form.location === 'ONSITE' ? 'USD' : form.rateCurrency,
    fxRate: inrRate,
    hrsYear: config.STANDARD_HOURS_YEAR || 1800,
    overhead: config.OVERHEAD_MULTIPLIER || 1.2,
  }) : null;

  const primarySkill = skills.find(s => s.id === form.primarySkillId);

  function togglePrimarySubmod(sub) {
    const arr = form.primarySubmods.includes(sub)
      ? form.primarySubmods.filter(s => s !== sub)
      : [...form.primarySubmods, sub];
    f('primarySubmods', arr);
  }

  function toggleSecSkill(skillId) {
    const exists = form.secondarySkills.find(ss => ss.skillId === skillId);
    if (exists) f('secondarySkills', form.secondarySkills.filter(ss => ss.skillId !== skillId));
    else f('secondarySkills', [...form.secondarySkills, { skillId, submods: [] }]);
  }

  function toggleSecSubmod(skillId, sub) {
    f('secondarySkills', form.secondarySkills.map(ss => {
      if (ss.skillId !== skillId) return ss;
      const submods = ss.submods.includes(sub) ? ss.submods.filter(s => s !== sub) : [...ss.submods, sub];
      return { ...ss, submods };
    }));
  }

  function handleSave() {
    const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
    if (!fullName)          { setStep(0); return alert('First name is required'); }
    if (!form.primarySkillId) { setStep(1); return alert('Primary skill is required'); }
    if (!form.costInput)      { setStep(3); return alert('Cost / rate is required'); }

    // Send firstName + lastName so API can combine them
    saveMut.mutate({
      ...form,
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      // Also send combined name for backward compat
      name: fullName,
      secondarySkillIds: form.secondarySkills.map(ss => ss.skillId),
    });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-title">
          <span>{resource ? 'Edit Resource' : 'Add Resource'}</span>
          <button onClick={onClose} style={{ cursor:'pointer', color:'var(--muted)', background:'none', border:'none', fontSize:16 }}>✕</button>
        </div>

        {/* Step tabs */}
        <div className="tabs" style={{ margin: '-4px -24px 18px', borderRadius: 0 }}>
          {STEPS.map((s, i) => (
            <div key={i} className={`tab ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}>{s}</div>
          ))}
        </div>

        {/* ── Step 0: Identity ─────────────────────────────── */}
        {step === 0 && (
          <div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="form-input" value={form.firstName} onChange={e => f('firstName', e.target.value)} placeholder="Ravi" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input className="form-input" value={form.lastName} onChange={e => f('lastName', e.target.value)} placeholder="Kumar" />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Employee / Contractor ID</label><input className="form-input" value={form.empId} onChange={e=>f('empId',e.target.value)} placeholder="EMP-001" /></div>
              <div className="form-group"><label className="form-label">Contact Email</label><input className="form-input" type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
            </div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" value={form.phone} onChange={e=>f('phone',e.target.value)} /></div>
            </div>
          </div>
        )}

        {/* ── Step 1: Skills ───────────────────────────────── */}
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
                <label className="form-label">Primary Skill Sub-modules</label>
                <div className="chips-wrap">
                  {form.primarySubmods.map(s => (
                    <span key={s} className="chip">{s}<button className="chip-remove" onClick={() => togglePrimarySubmod(s)}>✕</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {skills.filter(s => s.id !== form.primarySkillId).map(s => (
                  <span key={s.id} onClick={() => toggleSecSkill(s.id)}
                    className={`chip ${form.secondarySkills.find(ss=>ss.skillId===s.id) ? 'chip-blue' : 'chip-gray'}`}
                    style={{ cursor: 'pointer' }}>{s.name}</span>
                ))}
              </div>
              {form.secondarySkills.map(ss => {
                const sk = skills.find(s => s.id === ss.skillId);
                if (!sk) return null;
                return (
                  <div key={ss.skillId} style={{ marginBottom: 10 }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>{sk.name} — sub-modules</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {sk.submods.map(sub => (
                        <span key={sub} onClick={() => toggleSecSubmod(ss.skillId, sub)}
                          className={`chip chip-${ss.submods.includes(sub) ? 'purple' : 'gray'}`}
                          style={{ cursor: 'pointer', fontSize: 10 }}>{sub}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Employment ───────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Location *</label>
                <select className="form-select" value={form.location} onChange={e => { f('location', e.target.value); f('payCurrency', e.target.value === 'OFFSHORE' ? 'INR' : 'USD'); }}>
                  <option value="OFFSHORE">Offshore</option><option value="ONSITE">Onsite</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Employment Type *</label>
                <select className="form-select" value={form.employmentType} onChange={e => { f('employmentType', e.target.value); f('paymentTerms', ['FT_EMPLOYEE','PT_EMPLOYEE'].includes(e.target.value) ? 'Monthly Payroll' : 'Net 30'); }}>
                  <option value="FT_EMPLOYEE">FT Employee</option><option value="PT_EMPLOYEE">PT Employee</option>
                  <option value="CONTRACTOR">Contractor</option><option value="C2C">C2C</option>
                </select>
              </div>
            </div>
            {isEmployee ? (
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Joining Date</label><input className="form-input" type="date" value={form.joiningDate} onChange={e=>f('joiningDate',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Notice Period</label>
                  <select className="form-select" value={form.noticePeriod} onChange={e=>f('noticePeriod',e.target.value)}>
                    <option value="15">15 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Contract Start</label><input className="form-input" type="date" value={form.contractStart} onChange={e=>f('contractStart',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Contract End</label><input className="form-input" type="date" value={form.contractEnd} onChange={e=>f('contractEnd',e.target.value)} /></div>
              </div>
            )}
            <div className="form-group"><label className="form-label">Roll-off / Exit Date (if known)</label><input className="form-input" type="date" value={form.rolloffDate} onChange={e=>f('rolloffDate',e.target.value)} /><div className="form-note">Setting this triggers bench planning alerts 30 days before.</div></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Visa / Work Auth</label>
                <select className="form-select" value={form.visaType} onChange={e=>f('visaType',e.target.value)}>
                  <option value="NA">NA (Offshore)</option><option value="H1B">H1B</option><option value="OPT">OPT</option>
                  <option value="GC">Green Card</option><option value="Citizen">US Citizen</option><option value="L1">L1</option><option value="Other">Other</option>
                </select>
              </div>
              {form.location === 'ONSITE' && (
                <div className="form-group"><label className="form-label">Visa Expiry Date</label><input className="form-input" type="date" value={form.visaExpiry} onChange={e=>f('visaExpiry',e.target.value)} /></div>
              )}
            </div>
            <div className="form-group"><label className="form-label">Background Check</label>
              <select className="form-select" value={form.bgCheckStatus} onChange={e=>f('bgCheckStatus',e.target.value)}>
                <option value="NOT_REQUIRED">Not Required</option><option value="PENDING">Pending</option><option value="CLEARED">Cleared</option><option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Step 3: Cost & Payment ───────────────────────── */}
        {step === 3 && (
          <div>
            <div className="info-box">
              {form.location === 'OFFSHORE' && isEmployee && 'Offshore FT/PT: Enter CTC in INR. Formula: (CTC ÷ FX ÷ hrs/year) × overhead multiplier'}
              {isOffshoreContractor && 'Offshore Contractor/C2C: Enter hourly rate in INR or USD. No overhead applied.'}
              {form.location === 'ONSITE' && isEmployee && 'Onsite FT/PT: Enter annual salary in USD. Formula: (Salary ÷ hrs/year) × overhead multiplier'}
              {form.location === 'ONSITE' && !isEmployee && 'Onsite Contractor/C2C: Enter hourly rate in USD as-is. No overhead applied.'}
            </div>
            {isOffshoreContractor && (
              <div className="form-group"><label className="form-label">Rate Currency</label>
                <select className="form-select" value={form.rateCurrency} onChange={e=>f('rateCurrency',e.target.value)}>
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
              <input className="form-input" type="number" value={form.costInput} onChange={e=>f('costInput',e.target.value)}
                placeholder={form.location==='OFFSHORE'&&isEmployee ? '2400000' : form.location==='ONSITE'&&isEmployee ? '130000' : '95'} />
            </div>
            {costPreview && (
              <div className="cost-display" style={{ marginBottom: 14 }}>
                <div className="cost-row"><span className="cost-label">Computed USD/hr</span><span className="cost-value">${costPreview.usd.toFixed(2)}/hr</span></div>
                {costPreview.inr && <div className="cost-row"><span className="cost-label">Computed INR/hr</span><span style={{ fontSize:14, fontWeight:700, color:'var(--accent2)', fontFamily:'var(--font-sans)' }}>₹{costPreview.inr.toFixed(0)}/hr</span></div>}
                <div className="cost-row"><span className="cost-label">Formula</span><span className="cost-note">{costPreview.formula}</span></div>
              </div>
            )}
            {resource && (
              <div className="form-group"><label className="form-label">Reason for Rate Change</label>
                <select className="form-select" value={form.costChangeReason} onChange={e=>f('costChangeReason',e.target.value)}>
                  <option value="Increment">Annual Increment</option><option value="Renegotiation">Rate Renegotiation</option>
                  <option value="Promotion">Promotion</option><option value="Correction">Correction</option>
                </select>
              </div>
            )}
            <div className="divider" />
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Payment Terms</label>
                <select className="form-select" value={form.paymentTerms} onChange={e=>f('paymentTerms',e.target.value)}>
                  <option>Monthly Payroll</option><option>Net 30</option><option>Net 60</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Payment Currency</label>
                <select className="form-select" value={form.payCurrency} onChange={e=>f('payCurrency',e.target.value)}>
                  <option value="INR">INR ₹</option><option value="USD">USD $</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="form-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          {step > 0 && <button className="btn btn-outline" onClick={() => setStep(s=>s-1)}>← Previous</button>}
          {step < 3 && <button className="btn btn-primary" onClick={() => setStep(s=>s+1)}>Next →</button>}
          {step === 3 && <button className="btn btn-primary" onClick={handleSave} disabled={saveMut.isPending}>{saveMut.isPending ? 'Saving…' : 'Save Resource'}</button>}
        </div>
      </div>
    </div>
  );
}
