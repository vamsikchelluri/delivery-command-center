// src/pages/ResourceProfile.jsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { resourcesApi } from '../lib/api';
import { statusBadgeClass, statusLabel, getCurrentUSDRate, fmtUSD, fmtRate, getInitials, currentCostRecord } from '../lib/costEngine';

export default function ResourceProfile() {
  const { id } = useParams();
  const { data: r, isLoading } = useQuery({ queryKey: ['resource', id], queryFn: () => resourcesApi.get(id) });

  if (isLoading) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;
  if (!r) return <div className="empty-state"><div className="empty-text">Resource not found</div></div>;

  const rate = getCurrentUSDRate(r);
  const initials = getInitials(r.name);

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">{r.name}</div>
          <div className="section-sub">{r.primarySkill?.name} · {r.location === 'OFFSHORE' ? 'Offshore' : 'Onsite'} · {r.employmentType?.replace(/_/g,' ')} · {statusLabel(r.status)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/resources" className="btn btn-outline">← Back to Roster</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Identity card */}
          <div className="card"><div className="card-body">
            <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,var(--accent2),var(--accent))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 10 }}>{initials}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>{r.primarySkill?.name}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${statusBadgeClass(r.status)}`}><span className="badge-dot"/>{statusLabel(r.status)}</span>
            </div>
            {[
              ['ID',      r.empId],
              ['Email',   r.email],
              ['Phone',   r.phone],
            ].map(([k,v]) => v && (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text2)', fontSize: 10 }}>{v}</span>
              </div>
            ))}
          </div></div>

          {/* Employment card */}
          <div className="card"><div className="card-body">
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>Employment</div>
            {[
              ['Location',     r.location === 'OFFSHORE' ? 'Offshore' : 'Onsite'],
              ['Type',         r.employmentType?.replace(/_/g,' ')],
              ['Joined',       r.joiningDate?.split('T')[0]],
              ['Contract Start', r.contractStart?.split('T')[0]],
              ['Contract End', r.contractEnd?.split('T')[0]],
              ['Notice Period', r.noticePeriod ? `${r.noticePeriod} days` : null],
              ['Roll-off',     r.rolloffDate?.split('T')[0]],
              ['Visa',         r.visaType],
              ['Visa Expiry',  r.visaExpiry?.split('T')[0]],
              ['BG Check',     r.bgCheckStatus?.replace(/_/g,' ')],
            ].filter(([,v]) => v).map(([k,v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text2)' }}>{v}</span>
              </div>
            ))}
          </div></div>

          {/* Cost card */}
          <div className="card"><div className="card-body">
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>Current Cost Rate</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>USD/hr</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>{fmtRate(rate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>Monthly Cost</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtUSD(rate * 21 * 8)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>Payment</span>
              <span style={{ fontSize: 10, color: 'var(--text2)' }}>{r.paymentTerms} · {r.payCurrency}</span>
            </div>
          </div></div>

          {/* Skills card */}
          <div className="card"><div className="card-body">
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>Skills Profile</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5 }}>Primary: <span style={{ color: 'var(--text2)' }}>{r.primarySkill?.name}</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
              {(r.primarySubmods || []).map(s => <span key={s} className="chip" style={{ fontSize: 10 }}>{s}</span>)}
            </div>
            {(r.secondarySkills || []).map(ss => (
              <div key={ss.id} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{ss.skill?.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {(ss.submods || []).map(s => <span key={s} className="chip chip-blue" style={{ fontSize: 10 }}>{s}</span>)}
                </div>
              </div>
            ))}
          </div></div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Current deployments */}
          <div className="card">
            <div className="card-header"><div className="card-title"><div className="card-dot"/>Current Deployment</div></div>
            <div className="card-body">
              {(r.deployments || []).filter(d => {
                const t = new Date(); return new Date(d.startDate) <= t && new Date(d.endDate) >= t;
              }).length === 0 ? (
                <div className="empty-state" style={{ padding: '12px 0' }}><div className="empty-text">Not currently deployed</div></div>
              ) : (r.deployments || []).filter(d => {
                const t = new Date(); return new Date(d.startDate) <= t && new Date(d.endDate) >= t;
              }).map(d => (
                <div key={d.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{d.role?.project?.client} — {d.role?.project?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.role?.title} · {d.allocation}% allocation</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{d.startDate?.split('T')[0]} → {d.endDate?.split('T')[0]}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 12 }}>{fmtUSD((d.role?.billRate || 0) * 21 * 8 * d.allocation / 100)}/mo</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>revenue</div></div>
                    <div><div style={{ fontWeight: 700, fontSize: 12 }}>{fmtUSD(rate * 21 * 8 * d.allocation / 100)}/mo</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>cost</div></div>
                    <div><div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>{fmtUSD(((d.role?.billRate || 0) - rate) * 21 * 8 * d.allocation / 100)}/mo</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>margin</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost history */}
          <div className="card">
            <div className="card-header"><div className="card-title"><div className="card-dot" style={{ background: 'var(--accent3)' }}/>Cost Rate History (Point-in-Time)</div></div>
            <div className="card-body">
              {[...(r.costHistory || [])].reverse().map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, marginBottom: 5, fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 180, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {h.effectiveFrom?.split('T')[0]} → {h.effectiveTo ? h.effectiveTo.split('T')[0] : 'now'}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{fmtRate(h.computedUSDhr)}/hr</span>
                  <span style={{ color: 'var(--text2)', fontSize: 10 }}>{h.inputCurrency === 'INR' ? '₹' : '$'}{Number(h.inputValue).toLocaleString()} {h.inputCurrency}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>FX: {h.fxSnapshot}</span>
                  <span style={{ marginLeft: 'auto' }}><span className="badge badge-gray">{h.reason}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
