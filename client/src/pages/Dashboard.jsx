// src/pages/Dashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';
import { fmtUSD } from '../lib/costEngine';

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get, refetchInterval: 60_000 });

  if (isLoading) return <div className="empty-state"><div className="empty-text">Loading…</div></div>;

  const r = data?.resources || {};
  const alerts = data?.alerts || [];

  return (
    <div>
      {/* Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {alerts.length === 0 ? (
          <div className="alert alert-ok">✓ No active alerts — all resources healthy</div>
        ) : alerts.map((a, i) => (
          <div key={i} className={`alert alert-${a.type === 'danger' ? 'danger' : 'warn'}`}>
            {a.type === 'danger' ? '🔴' : '⚠'} <strong>{a.resourceName}</strong> — {a.msg}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi" style={{ '--kpi-color': 'var(--accent)' }}>
          <div className="kpi-label">Total Resources</div>
          <div className="kpi-value">{r.total || 0}</div>
          <div className="kpi-delta"><span className="text-accent">{r.deployed || 0} deployed</span></div>
          <div className="kpi-icon">👥</div>
        </div>
        <div className="kpi" style={{ '--kpi-color': 'var(--danger)' }}>
          <div className="kpi-label">On Bench</div>
          <div className="kpi-value text-danger">{r.bench || 0}</div>
          <div className="kpi-delta">{r.bench > 3 ? <span className="text-danger">⚠ High bench count</span> : <span className="text-muted">Manageable</span>}</div>
          <div className="kpi-icon">⚠</div>
        </div>
        <div className="kpi" style={{ '--kpi-color': 'var(--accent3)' }}>
          <div className="kpi-label">Avg Utilization</div>
          <div className="kpi-value">{r.avgUtil || 0}%</div>
          <div className="kpi-delta">{(r.avgUtil || 0) >= 80 ? <span className="text-accent">↑ Healthy</span> : <span className="text-danger">↓ Below target</span>}</div>
          <div className="kpi-icon">⚡</div>
        </div>
        <div className="kpi" style={{ '--kpi-color': 'var(--accent2)' }}>
          <div className="kpi-label">Bench Burn / mo</div>
          <div className="kpi-value">{fmtUSD(r.benchBurnPerMonth || 0)}</div>
          <div className="kpi-delta text-muted">Undeployed cost</div>
          <div className="kpi-icon">🔥</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title"><div className="card-dot" />Active Alerts Detail</div></div>
        <div className="card-body">
          {alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}><div className="empty-text">All clear</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12 }}><strong>{a.resourceName}</strong> — {a.msg}</span>
                  <span className={`badge badge-${a.type === 'danger' ? 'red' : 'yellow'}`}>{a.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
