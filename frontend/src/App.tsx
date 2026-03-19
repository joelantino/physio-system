// src/App.tsx
// Main app router with navigation

import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import PhysioDashboard from './pages/PhysioDashboard';
import UserView from './pages/UserView';
import SessionHistory from './pages/SessionHistory';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Navigation Bar */}
        <nav className="nav-bar">
          <NavLink to="/" className="nav-logo" style={{ textDecoration: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            PhysioAI
          </NavLink>

          <div className="nav-links">
            <NavLink
              to="/user"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 10l4.553-2.278A1 1 0 0121 8.68v6.64a1 1 0 01-1.447.898L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              User View
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              Physio Dashboard
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session History
            </NavLink>
          </div>

          <div className="nav-status">
            <div className="status-dot" id="backend-status-dot" />
            <span id="backend-status-text">Backend Connected</span>
          </div>
        </nav>

        {/* Page Content */}
        <Routes>
          <Route path="/" element={<UserView />} />
          <Route path="/user" element={<UserView />} />
          <Route path="/dashboard" element={<PhysioDashboard />} />
          <Route path="/history" element={<SessionHistory />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
