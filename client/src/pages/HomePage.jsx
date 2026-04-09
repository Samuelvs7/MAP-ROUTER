import { Link } from 'react-router-dom';
import { Navigation2, Route, Brain, MapPin, ArrowRight, Clock, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', padding: '60px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--blue)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Navigation2 style={{ width: 28, height: 28, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 12, lineHeight: 1.2 }}>
            SmartRoute AI
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-dim)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Multi-stop route optimizer that finds the <strong style={{ color: 'var(--text)' }}>best order</strong> to visit
            your locations. Real road distances. Turn-by-turn directions. What Google Maps doesn't do.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/planner" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: 14, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
                Open Planner <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </Link>
          </div>
        </div>

        {/* What makes this different */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: 1.5, marginBottom: 20, textAlign: 'center' }}>
            What Google Maps Can't Do
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { icon: Route, title: 'Multi-Stop Optimization', desc: 'You have 5 places to visit — we tell you the best ORDER. Google Maps just follows your order.', color: 'var(--green)' },
              { icon: Brain, title: 'AI Scoring Engine', desc: 'Weighted scoring across distance, time, traffic, cost, weather. Not just shortest path.', color: 'var(--blue)' },
              { icon: Zap, title: 'Algorithm Comparison', desc: 'See how Nearest Neighbor, 2-opt, and OSRM TSP compare for YOUR stops.', color: 'var(--amber)' },
              { icon: MapPin, title: 'Real Road Data', desc: 'OSRM for real distances, Nominatim for geocoding. No fake/mock data.', color: 'var(--red)' },
              { icon: Clock, title: 'Turn-by-Turn Directions', desc: 'Full step-by-step navigation: left, right, distance, time remaining.', color: '#8b5cf6' },
              { icon: Navigation2, title: 'Smart Explanations', desc: '"Stop 3 moved to position 2 because it saves 12km." AI that explains itself.', color: 'var(--green)' },
            ].map((f, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <f.icon style={{ width: 20, height: 20, color: f.color, marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: 1.5, marginBottom: 20, textAlign: 'center' }}>
            How It Works
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { step: '1', title: 'Enter your locations', desc: 'Add start, end, and any intermediate stops you need to visit' },
              { step: '2', title: 'We find the optimal order', desc: 'Nearest Neighbor + 2-opt algorithms compute the best visiting sequence' },
              { step: '3', title: 'Get real directions', desc: 'Turn-by-turn navigation with actual road distances from OSRM' },
              { step: '4', title: 'See what you saved', desc: 'Compare original vs optimized distance — understand WHY each stop was moved' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Built with</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            React · Node.js · OSRM (routing) · Nominatim (geocoding) · Leaflet (maps) · Dijkstra · A* · TSP Solver
          </div>
        </div>
      </div>
    </div>
  );
}
