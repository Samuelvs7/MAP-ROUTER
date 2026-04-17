import { Link, useLocation } from 'react-router-dom';
import { Map, History, Navigation2, Bookmark, Sparkles } from 'lucide-react';

export default function Navbar() {
  const loc = useLocation();
  const isActive = (p) => loc.pathname === p;

  return (
    <nav style={{ 
      width: 72, 
      height: '100%',
      background: 'var(--panel)', 
      borderRight: '1px solid var(--border)', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      padding: '24px 0', 
      zIndex: 1000, 
      position: 'relative',
      boxShadow: '2px 0 12px rgba(0,0,0,0.1)'
    }}>
      <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', marginBottom: 32, gap: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
          <Navigation2 style={{ width: 20, height: 20, color: 'white' }} />
        </div>
      </Link>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', alignItems: 'center' }}>
        {[
          { path: '/planner', label: 'Planner', icon: Map },
          { path: '/history', label: 'History', icon: History },
          { path: '/saved', label: 'Saved', icon: Bookmark },
          { path: '/ai-suggestions', label: 'Magic', icon: Sparkles },
        ].map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link key={path} to={path} title={label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, 
              padding: '12px 0', width: 60, borderRadius: 14,
              textDecoration: 'none', transition: 'all 0.2s',
              background: active ? 'var(--blue-dim)' : 'transparent',
              color: active ? 'var(--blue)' : 'var(--text-dim)',
            }}>
              <Icon style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
