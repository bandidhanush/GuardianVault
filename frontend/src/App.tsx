import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Video, Upload, AlertTriangle, Shield,
  Camera, Activity, Wifi, WifiOff, MapPin, Bell
} from 'lucide-react';
import './index.css';

import Dashboard from './pages/Dashboard';
import LiveFeed from './pages/LiveFeed';
import UploadVideo from './pages/UploadVideo';
import Incidents from './pages/Incidents';
import EvidencePage from './pages/Evidence';
import CameraConfig from './pages/CameraConfig';
import { useWebSocket } from './hooks/useWebSocket';
import { useLocation as useGeoLocation } from './hooks/useLocation';

// ── Toast Notification System ─────────────────────────────────────────────────
interface Toast {
  id: string;
  type: 'danger' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => (
  <div className="toast-container">
    <AnimatePresence>
      {toasts.map(toast => (
        <motion.div
          key={toast.id}
          className={`toast ${toast.type}`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          onClick={() => onRemove(toast.id)}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{toast.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{toast.message}</div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ── Sidebar ───────────────────────────────────────────────────────────────────
const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/live', icon: Video, label: 'Live Feed' },
  { path: '/upload', icon: Upload, label: 'Upload Video' },
  { path: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { path: '/cameras', icon: Camera, label: 'Camera Config' },
];

const Sidebar: React.FC<{ isConnected: boolean; accidentCount: number }> = ({ isConnected, accidentCount }) => {
  const location = useGeoLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-cyan)',
          }}>
            <Shield size={20} color="#000" />
          </div>
          <div>
            <h1 style={{ fontSize: 11, letterSpacing: '0.08em' }}>ROAD SAFETY<br />MONITOR</h1>
          </div>
        </div>
        <p>AI Accident Detection v1.0</p>
      </div>

      {/* Connection Status */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          <span style={{ fontSize: 12, color: isConnected ? 'var(--success)' : 'var(--danger)' }}>
            {isConnected ? 'System Online' : 'Connecting...'}
          </span>
          {isConnected ? <Wifi size={12} color="var(--success)" /> : <WifiOff size={12} color="var(--danger)" />}
        </div>
        {accidentCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Bell size={12} color="var(--danger)" />
            <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
              {accidentCount} alert{accidentCount > 1 ? 's' : ''} today
            </span>
          </div>
        )}
      </div>

      {/* Location */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <MapPin size={12} color="var(--accent-cyan)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {location.loading ? 'Locating...' : location.display}
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}

        <div className="nav-section-title" style={{ marginTop: 16 }}>Evidence</div>
        <NavLink
          to="/evidence"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Shield size={18} />
          Evidence Viewer
        </NavLink>
      </nav>

      {/* System Info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div className="flex items-center gap-2">
            <Activity size={10} />
            <span>AES-256-CBC Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={10} />
            <span>Section 65B Compliant</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
function AppInner() {
  const { isConnected, lastMessage } = useWebSocket();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accidentCount, setAccidentCount] = useState(0);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'accident_detected') {
      const data = lastMessage.data as Record<string, unknown>;
      setAccidentCount(c => c + 1);
      addToast({
        type: 'danger',
        title: '🚨 ACCIDENT DETECTED',
        message: `Severity: ${data?.severity || 'Unknown'} | Confidence: ${((data?.confidence as number || 0) * 100).toFixed(1)}%`,
      });
    } else if (lastMessage.type === 'alert_sent') {
      addToast({
        type: 'success',
        title: '📱 SMS Alert Sent',
        message: `Emergency services notified at ${new Date().toLocaleTimeString()}`,
      });
    }
  }, [lastMessage]);

  return (
    <div className="app-layout">
      <Sidebar isConnected={isConnected} accidentCount={accidentCount} />
      <main className="main-content">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live" element={<LiveFeed />} />
            <Route path="/upload" element={<UploadVideo />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/cameras" element={<CameraConfig />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/evidence/:id" element={<EvidencePage />} />
          </Routes>
        </AnimatePresence>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
