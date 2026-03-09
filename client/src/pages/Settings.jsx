// src/pages/Settings.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi, currenciesApi, configApi } from '../lib/api';

export default function Settings() {
  const qc = useQueryClient();
  const { data: skills = []     } = useQuery({ queryKey: ['skills'],     queryFn: skillsApi.list });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: currenciesApi.list });
  const { data: config = {}     } = useQuery({ queryKey: ['config'],     queryFn: configApi.get });

  return (
    <div>
      <div className="section-header"><div><div className="section-title">Settings & Master Data</div><div className="section-sub">Currencies · exchange rates · system parameters · skills</div></div></div>
      <CurrencySettings currencies={currencies} qc={qc} />
      <SystemConfigSettings config={config} qc={qc} />
      <SkillsSettings skills={skills} qc={qc} />
    </div>
  );
}

function CurrencySettings({ currencies, qc }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: '', symbol: '', name: '', rateVsUSD: '' });

  const rateMut = useMutation({
    mutationFn: ({ code, rate }) => currenciesApi.updateRate(code, rate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currencies'] }),
  });
  const addMut = useMutation({
    mutationFn: currenciesApi.upsert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['currencies'] }); setShowAdd(false); setForm({ code:'',symbol:'',name:'',rateVsUSD:'' }); },
  });
  const delMut = useMutation({
    mutationFn: currenciesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currencies'] }),
  });

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>🌐 Currencies & Exchange Rates</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>+ Add Currency</button>
      </div>
      <div className="tip-box" style={{ marginBottom: 12 }}>Exchange rates are vs USD. Update monthly. Changes recompute current-period cost rates instantly. Historical P&L always uses the rate locked at time of entry.</div>
      {showAdd && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, marginBottom: 12 }}>
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label">Code</label><input className="form-input" placeholder="EUR" maxLength={3} value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} /></div>
            <div className="form-group"><label className="form-label">Symbol</label><input className="form-input" placeholder="€" value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Euro" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Rate vs USD (1 USD = ? units)</label><input className="form-input" type="number" placeholder="0.93" value={form.rateVsUSD} onChange={e=>setForm(f=>({...f,rateVsUSD:e.target.value}))} /></div>
          <div className="form-footer">
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => addMut.mutate(form)}>Save</button>
          </div>
        </div>
      )}
      {currencies.map(c => (
        <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800, width: 28, color: 'var(--accent)' }}>{c.symbol}</span>
          <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 120 }}>{c.name}</span>
          <span className="text-muted text-xs">{c.isBase ? '' : '1 USD ='}</span>
          {c.isBase ? (
            <span style={{ fontWeight: 700, fontSize: 13 }}>1.00</span>
          ) : (
            <input className="form-input" type="number" style={{ width: 110, textAlign: 'right' }} defaultValue={c.rateVsUSD} step="0.01"
              onBlur={e => rateMut.mutate({ code: c.code, rate: parseFloat(e.target.value) })} />
          )}
          <span className="text-muted text-xs">{c.isBase ? '' : c.code}</span>
          {c.isBase ? <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Base</span> : (
            <button className="btn btn-danger btn-xs" style={{ marginLeft: 'auto' }} onClick={() => delMut.mutate(c.code)}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
}

function SystemConfigSettings({ config, qc }) {
  const mut = useMutation({
    mutationFn: configApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });

  const rows = [
    { key: 'STANDARD_HOURS_YEAR', label: 'Standard Hours / Year',        sub: 'Divisor for FT/PT cost rate. 1800 covers bench + mandatory leave.', step: 1 },
    { key: 'OVERHEAD_MULTIPLIER',  label: 'Overhead Multiplier (FT/PT)', sub: 'Covers benefits, HR overhead. Contractors/C2C always 1.0×.',        step: 0.05 },
    { key: 'DEFAULT_WORKING_DAYS', label: 'Default Working Days / Month', sub: 'Used for planned revenue and bench burn calculations.',              step: 1 },
    { key: 'WORKING_HOURS_DAY',    label: 'Working Hours / Day',          sub: 'Standard billable hours per working day.',                          step: 1 },
  ];

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>⚙ Cost Calculation Parameters</div>
      {rows.map(r => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.label}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.sub}</div>
          </div>
          <input
            className="form-input" type="number" step={r.step}
            style={{ width: 130, textAlign: 'right' }}
            defaultValue={config[r.key] || ''}
            onBlur={e => mut.mutate({ [r.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function SkillsSettings({ skills, qc }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', submods: '' });
  const [showSubmod, setShowSubmod] = useState(null); // skillId for add-submod inline

  const createMut = useMutation({
    mutationFn: skillsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); setShowAdd(false); setForm({ name:'',submods:'' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => skillsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); setEditId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: skillsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });

  function startEdit(sk) {
    setEditId(sk.id);
    setForm({ name: sk.name, submods: sk.submods.join(', ') });
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>🎯 Skills & Sub-modules Master Data</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(s=>!s); setEditId(null); }}>+ Add Skill</button>
      </div>
      <div className="info-box" style={{ marginBottom: 10 }}>Changes apply immediately to all resource dropdowns.</div>
      {showAdd && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, marginBottom: 12 }}>
          <div className="form-group"><label className="form-label">Skill Name *</label><input className="form-input" placeholder="e.g. SAP IBP" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          <div className="form-group"><label className="form-label">Sub-modules (comma-separated)</label><input className="form-input" placeholder="e.g. Demand Planning, Supply Planning, S&OP" value={form.submods} onChange={e=>setForm(f=>({...f,submods:e.target.value}))} /></div>
          <div className="form-footer">
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => createMut.mutate({ name: form.name, submods: form.submods.split(',').map(s=>s.trim()).filter(Boolean) })}>Save Skill</button>
          </div>
        </div>
      )}
      {skills.map(sk => (
        <div key={sk.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {editId === sk.id ? (
            <div style={{ flex: 1 }}>
              <div className="form-grid-2" style={{ marginBottom: 8 }}>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                <input className="form-input" value={form.submods} onChange={e=>setForm(f=>({...f,submods:e.target.value}))} placeholder="comma-separated sub-modules" />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-xs" onClick={() => setEditId(null)}>Cancel</button>
                <button className="btn btn-primary btn-xs" onClick={() => updateMut.mutate({ id: sk.id, data: { name: form.name, submods: form.submods.split(',').map(s=>s.trim()).filter(Boolean) } })}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 5 }}>{sk.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {sk.submods.map(s => <span key={s} className="chip chip-gray" style={{ fontSize: 9.5 }}>{s}</span>)}
                  <span style={{ fontSize: 10, color: 'var(--muted)', alignSelf: 'center' }}>{sk.submods.length} sub-modules</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="btn btn-outline btn-xs" onClick={() => startEdit(sk)}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => { if(confirm(`Delete skill "${sk.name}"?`)) deleteMut.mutate(sk.id); }}>✕</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
