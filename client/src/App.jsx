import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Topbar  from './components/layout/Topbar';
import Dashboard      from './pages/Dashboard';
import Resources      from './pages/Resources';
import ResourceProfile from './pages/ResourceProfile';
import Projects       from './pages/Projects';
import Pipeline       from './pages/Pipeline';
import Team           from './pages/Team';
import Financials     from './pages/Financials';
import Settings       from './pages/Settings';

export default function App() {
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
        <div className="page-body">
          <Routes>
            <Route path="/"              element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/resources"     element={<Resources />} />
            <Route path="/resources/:id" element={<ResourceProfile />} />
            <Route path="/projects"      element={<Projects />} />
            <Route path="/pipeline"      element={<Pipeline />} />
            <Route path="/team"          element={<Team />} />
            <Route path="/financials"    element={<Financials />} />
            <Route path="/settings"      element={<Settings />} />
            <Route path="*"              element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
