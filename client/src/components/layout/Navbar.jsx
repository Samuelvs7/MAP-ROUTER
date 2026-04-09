import { Link, useLocation } from 'react-router-dom';
import { Map, History, Home, Navigation2 } from 'lucide-react';

export default function Navbar() {
  const loc = useLocation();
  const isActive = (p) => loc.pathname === p;

  return (
    <nav style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 1000, position: 'relative' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 32 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Navigation2 style={{ width: 16, height: 16, color: 'white' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>SmartRoute AI</span>
      </Link>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { path: '/', label: 'Home', icon: Home },
          { path: '/planner', label: 'Planner', icon: Map },
          { path: '/history', label: 'History', icon: History },
        ].map(({ path, label, icon: Icon }) => (
          <Link key={path} to={path} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
            fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s',
            background: isActive(path) ? 'var(--blue-dim)' : 'transparent',
            color: isActive(path) ? 'var(--blue)' : 'var(--text-dim)',
          }}>
            <Icon style={{ width: 15, height: 15 }} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
