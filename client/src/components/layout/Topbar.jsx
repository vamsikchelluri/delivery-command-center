import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Topbar({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header style={{
      height: 52, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      padding: '0 20px', gap: 12, background: 'var(--surface)', flexShrink: 0,
    }}>
      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{ background:'none', border:'1px solid var(--border)', borderRadius:7, padding:'5px 10px', cursor:'pointer', color:'var(--muted)', fontSize:12 }}>
        {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
      </button>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowMenu(p => !p)} style={{
          display:'flex', alignItems:'center', gap:8, background:'var(--surface2)',
          border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px',
          cursor:'pointer', color:'var(--text)',
        }}>
          <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg, var(--accent2), var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff' }}>
            {user?.name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:'var(--text)' }}>{user?.name}</div>
            <div style={{ fontSize:9.5, color:'var(--muted)' }}>{user?.roleLabel}</div>
          </div>
          <span style={{ fontSize:10, color:'var(--muted)', marginLeft:2 }}>▾</span>
        </button>

        {showMenu && (
          <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:8, minWidth:180, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
            <div style={{ padding:'6px 10px', fontSize:11, color:'var(--muted)', borderBottom:'1px solid var(--border)', marginBottom:6 }}>
              {user?.email}
            </div>
            <button onClick={() => { setShowMenu(false); navigate('/settings'); }}
              style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, color:'var(--text)' }}
              onMouseEnter={e => e.target.style.background='var(--surface2)'}
              onMouseLeave={e => e.target.style.background='none'}>
              ⚙ Settings
            </button>
            <button onClick={handleLogout}
              style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, color:'var(--danger)' }}
              onMouseEnter={e => e.target.style.background='rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.target.style.background='none'}>
              ⎋ Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
