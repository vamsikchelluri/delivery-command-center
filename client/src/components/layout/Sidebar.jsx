import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { resourcesApi, pipelineApi } from '../../lib/api';

const NAV = [
  { group: 'Overview', items: [
    { to: '/dashboard', label: 'COO 360° View',    icon: '⊞' },
  ]},
  { group: 'Operations', items: [
    { to: '/resources', label: 'Resources',         icon: '👥', countKey: 'resources' },
    { to: '/projects',  label: 'Projects (SOW)',    icon: '📋', countKey: 'projects'  },
  ]},
  { group: 'Growth', items: [
    { to: '/pipeline',  label: 'Pipeline',          icon: '📡', countKey: 'pipeline' },
    { to: '/team',      label: 'Team',              icon: '🤝' },
    { to: '/financials',label: 'P&L / Financials',  icon: '$'  },
  ]},
  { group: 'Admin', items: [
    { to: '/settings',  label: 'Settings',          icon: '⚙' },
  ]},
];

export default function Sidebar() {
  const { data: resources } = useQuery({ queryKey: ['resources'], queryFn: () => resourcesApi.list() });
  const { data: pipeline  } = useQuery({ queryKey: ['pipeline'],  queryFn: () => pipelineApi.list({ stage: 'QUALIFYING' }).catch(() => []) });

  const counts = {
    resources: resources?.length || 0,
    pipeline:  pipeline?.length  || 0,
  };

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 228,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto',
    }}>
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 8.5, letterSpacing: 3, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 5, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>// delivery ops</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
          Command<br /><span style={{ color: 'var(--accent)' }}>Center</span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>v4.1 · Railway</div>
      </div>

      <nav style={{ flex: 1, paddingBottom: 12 }}>
        {NAV.map(group => (
          <div key={group.group}>
            <div style={{ fontSize: 8.5, letterSpacing: 2.5, color: 'var(--muted)', textTransform: 'uppercase', padding: '13px 18px 4px', fontFamily: 'var(--font-mono)' }}>
              {group.group}
            </div>
            {group.items.map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 18px', cursor: 'pointer',
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isActive ? 'rgba(0,229,160,0.055)' : 'transparent',
                  fontSize: 11.5, transition: 'all 0.14s', textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                })}>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{item.icon}</span>
                {item.label}
                {item.countKey && counts[item.countKey] > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'rgba(0,229,160,0.13)', color: 'var(--accent)', fontSize: 9.5, padding: '1px 6px', borderRadius: 20, fontFamily: 'var(--font-mono)' }}>
                    {counts[item.countKey]}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg, var(--accent2), var(--accent))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>SK</div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 700 }}>S. Krishnan</div>
          <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>COO · Delivery Head</div>
        </div>
      </div>
    </aside>
  );
}
