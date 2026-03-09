// src/components/layout/Topbar.jsx
import { useLocation } from 'react-router-dom';

const PAGE_META = {
  '/dashboard':  { title: 'COO 360° View',        sub: 'Live operational snapshot' },
  '/resources':  { title: 'Resource Management',   sub: 'Full roster · cost rates · deployment history' },
  '/projects':   { title: 'Projects (SOW)',         sub: 'Active engagements · roles · actuals' },
  '/pipeline':   { title: 'Pipeline',               sub: 'Opportunities · conversion tracking' },
  '/financials': { title: 'P&L / Financials',       sub: 'Revenue · cost · margin by project & company' },
  '/settings':   { title: 'Settings & Master Data', sub: 'Currencies · skills · system parameters' },
};

export default function Topbar({ theme, toggleTheme }) {
  const loc  = useLocation();
  const base = '/' + loc.pathname.split('/')[1];
  const meta = PAGE_META[base] || { title: 'Delivery Command Center', sub: '' };

  return (
    <div style={{
      height: 52, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 22px', gap: 10,
      background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50,
      boxShadow: 'var(--shadow2)',
    }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
        {meta.title}
      </span>
      {meta.sub && (
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>— {meta.sub}</span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 20 }}>
          <div className="pulse-dot" />
          Live
        </div>

        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '3px 8px 3px 7px', cursor: 'pointer',
            fontSize: 10.5, color: 'var(--muted)', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <span style={{ fontSize: 12 }}>{theme === 'dark' ? '☀' : '🌙'}</span>
          <div style={{ width: 28, height: 15, background: theme === 'dark' ? 'var(--border2)' : 'var(--accent)', borderRadius: 8, position: 'relative', transition: 'background 0.25s' }}>
            <div style={{ position: 'absolute', top: 2, left: 2, width: 11, height: 11, background: '#fff', borderRadius: '50%', transition: 'transform 0.2s', transform: theme === 'light' ? 'translateX(13px)' : 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }} />
          </div>
          <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </div>
  );
}
