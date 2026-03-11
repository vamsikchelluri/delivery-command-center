import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar   from './components/layout/Sidebar';
import Topbar    from './components/layout/Topbar';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import ResourceProfile from './pages/ResourceProfile';
import Projects  from './pages/Projects';
import Pipeline  from './pages/Pipeline';
import Team      from './pages/Team';
import Financials from './pages/Financials';
import PLReport   from './pages/PLReport';
import Settings  from './pages/Settings';

// Protected route wrapper
function Protected({ children, module, level = 'READ' }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)', color:'var(--muted)', fontSize:13 }}>
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (module && !can(module, level)) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <div style={{ fontSize:40 }}>🔒</div>
      <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>Access Denied</div>
      <div style={{ fontSize:13, color:'var(--muted)' }}>You don't have permission to view this page.</div>
    </div>
  );
  return children;
}

// Shell — sidebar + topbar
function Shell({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('dcc-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dcc-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="page-content">
        <Topbar theme={theme} toggleTheme={toggleTheme} />
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0f', color:'rgba(255,255,255,0.4)', fontSize:13 }}>
      Loading…
    </div>
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Protected — all inside Shell */}
      <Route path="/*" element={
        <Protected>
          <Shell>
            <Routes>
              <Route path="/"              element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"     element={<Protected module="dashboard"><Dashboard /></Protected>} />
              <Route path="/resources"     element={<Protected module="resources"><Resources /></Protected>} />
              <Route path="/resources/:id" element={<Protected module="resources"><ResourceProfile /></Protected>} />
              <Route path="/projects"      element={<Protected module="projects"><Projects /></Protected>} />
              <Route path="/pipeline"      element={<Protected module="pipeline"><Pipeline /></Protected>} />
              <Route path="/team"          element={<Protected module="team"><Team /></Protected>} />
              <Route path="/financials"    element={<Protected module="financials"><Financials /></Protected>} />
              <Route path="/pl-report"     element={<Protected module="financials"><PLReport /></Protected>} />
              <Route path="/settings"      element={<Protected module="settings"><Settings /></Protected>} />
              <Route path="*"              element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Shell>
        </Protected>
      } />
    </Routes>
  );
}
