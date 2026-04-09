import { Link, useLocation } from 'react-router-dom';
import { Map, History, Home, Zap } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const links = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/planner', label: 'Route Planner', icon: Map },
    { path: '/history', label: 'History', icon: History },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-surface-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center
                          group-hover:shadow-lg group-hover:shadow-primary-500/30 transition-all duration-300">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-accent-cyan bg-clip-text text-transparent
                           hidden sm:block">
              AI Smart Router
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {links.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300
                  ${isActive(path)
                    ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:block">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
