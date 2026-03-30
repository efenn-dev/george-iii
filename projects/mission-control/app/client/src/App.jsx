import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Agents from './pages/Agents.jsx';
import Runs from './pages/Runs.jsx';
import Tasks from './pages/Tasks.jsx';
import CronJobs from './pages/CronJobs.jsx';
import ShortsBot from './pages/ShortsBot.jsx';
import Runbook from './pages/Runbook.jsx';
import SystemStatus from './pages/SystemStatus.jsx';

const NAV = [
  { to: '/', label: '🎛️ Dashboard', end: true },
  { to: '/agents', label: '🤖 Agents & Pipeline' },
  { to: '/runs', label: '📊 Runs' },
  { to: '/tasks', label: '📋 Kanban' },
  { to: '/cron', label: '⏱️ Cron Jobs' },
  { to: '/shorts', label: '🎬 Shorts Bot' },
  { to: '/runbook', label: '📖 Runbook' },
  { to: '/system', label: '⚙️ System' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <nav style={styles.nav}>
          <div style={styles.navBrand}>Mission Control</div>
          <div style={styles.navLinks}>
            {NAV.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/cron" element={<CronJobs />} />
            <Route path="/shorts" element={<ShortsBot />} />
            <Route path="/runbook" element={<Runbook />} />
            <Route path="/system" element={<SystemStatus />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const styles = {
  nav: {
    width: 220,
    minHeight: '100vh',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    flexShrink: 0,
  },
  navBrand: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--accent)',
    padding: '0 20px 24px',
    letterSpacing: '0.02em',
  },
  navLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 10px',
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
};
