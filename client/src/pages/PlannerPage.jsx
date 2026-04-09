import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, MapPin, Plus, X, Loader2, Navigation, ChevronRight, Clock, Route as RouteIcon, ArrowRight, CornerDownRight, CornerUpRight, TrendingUp, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import { optimizeRoute, optimizeMultiStop, geocodePlace, saveHistory } from '../services/api';
import MapView from '../components/map/MapView';

/* ── Location Input ── */
function LocationInput({ placeholder, value, onChange, onClear, color = 'var(--blue)' }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const ref = useRef(null);

  useEffect(() => { if (value?.name && value.name !== query) setQuery(value.name); }, [value]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length >= 3) {
      setLoading(true);
      timer.current = setTimeout(async () => {
        try {
          const res = await geocodePlace(v);
          setSuggestions(res.data.results || []);
          setShow(true);
        } catch { setSuggestions([]); }
        setLoading(false);
      }, 400);
    } else { setSuggestions([]); setShow(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 10, width: 10, height: 10, borderRadius: '50%', background: color }} />
        <input className="input-field" style={{ paddingLeft: 28, paddingRight: value ? 56 : 12 }}
          placeholder={placeholder} value={query} onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setShow(true)} />
        {loading && <Loader2 style={{ position: 'absolute', right: value ? 32 : 10, width: 14, height: 14, color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />}
        {value && onClear && (
          <button onClick={() => { setQuery(''); onChange(null); if (onClear) onClear(); }}
            style={{ position: 'absolute', right: 6, padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      {show && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--panel)',
          border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { setQuery(s.name); onChange(s); setShow(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', textAlign: 'left', color: 'var(--text)', fontSize: 12 }}>
              <MapPin style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Direction Step ── */
function DirectionStep({ step, idx, isLast }) {
  const getIcon = (type, modifier) => {
    if (type === 'depart') return '🚗';
    if (type === 'arrive') return '🏁';
    if (type === 'turn' && modifier?.includes('left')) return '↰';
    if (type === 'turn' && modifier?.includes('right')) return '↱';
    if (type === 'roundabout') return '🔄';
    if (type === 'fork') return '⑂';
    return '→';
  };
  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ width: 22, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>
        {getIcon(step.type, step.modifier)}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text)', lineHeight: 1.4 }}>{step.instruction}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
          {fmtDist(step.distance)} · {step.remainingDistance != null ? `${fmtDist(step.remainingDistance)} left` : ''}
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const { state, dispatch } = useRoute();
  const [stops, setStops] = useState([]); // Multi-stop
  const [multiResult, setMultiResult] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [tab, setTab] = useState('routes'); // 'routes' | 'directions' | 'multi'
  const [directionsRoute, setDirectionsRoute] = useState(null);

  const isMultiStop = stops.length > 0;
  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  const fmtTime = (s) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };

  // ── Find Route (A → B) ──
  const handleFindRoute = useCallback(async () => {
    if (!state.source || !state.destination) return toast.error('Enter source and destination');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await optimizeRoute({ source: state.source, destination: state.destination, preference: state.preference });
      dispatch({ type: 'SET_RESULTS', payload: res.data });
      setDirectionsRoute(res.data.routes[0]); // Show best route directions
      setTab('routes');
      toast.success(`${res.data.routes.length} route${res.data.routes.length > 1 ? 's' : ''} found`);
      try { await saveHistory({ source: state.source, destination: state.destination, preference: state.preference, selectedRoute: res.data.routes[0] }); } catch {}
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || err.message });
      toast.error(err.response?.data?.error || 'Failed to find routes');
    }
  }, [state.source, state.destination, state.preference, dispatch]);

  // ── Optimize Multi-Stop ──
  const handleMultiOptimize = useCallback(async () => {
    if (!state.source) return toast.error('Enter start location');
    if (!state.destination) return toast.error('Enter end location');
    const valid = stops.filter(s => s.lat);
    if (valid.length === 0) return toast.error('Add at least 1 intermediate stop');
    setMultiLoading(true); setMultiResult(null);
    try {
      const res = await optimizeMultiStop({ source: state.source, destination: state.destination, stops: valid });
      setMultiResult(res.data);
      if (res.data.geometry) {
        dispatch({ type: 'SET_RESULTS', payload: {
          routes: [{ index: 0, distance: res.data.totalDistance, duration: res.data.totalDuration,
            estimatedCost: Math.round(res.data.totalDistance / 1000 * 6.5), score: 0, isBest: true,
            summary: 'Optimized Route', geometry: res.data.geometry, adjustedDuration: res.data.totalDuration,
            directions: res.data.directions || [] }],
          bestRouteIndex: 0, explanation: { summary: res.data.explanation?.summary || '' },
        }});
        setDirectionsRoute({ directions: res.data.directions || [], distance: res.data.totalDistance, duration: res.data.totalDuration });
      }
      setTab('multi');
      toast.success(`Optimized! Saved ${fmtDist(res.data.distanceSaved)}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Optimization failed'); }
    setMultiLoading(false);
  }, [state.source, state.destination, stops, dispatch]);

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', overflow: 'hidden' }}>
      {/* ── LEFT PANEL ── */}
      <div style={{ width: 360, flexShrink: 0, background: 'var(--panel)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search Section */}
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LocationInput placeholder="Start location..." value={state.source}
              onChange={(v) => dispatch({ type: 'SET_SOURCE', payload: v })} color="#34a853" />

            {/* Multi-stop inputs */}
            {stops.map((stop, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <LocationInput placeholder={`Stop ${i + 1}...`} value={stop.lat ? stop : null} color="#fbbc04"
                    onChange={(v) => { const ns = [...stops]; ns[i] = v || { name: '', lat: null, lon: null }; setStops(ns); }}
                    onClear={() => setStops(stops.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}

            <LocationInput placeholder="Destination..." value={state.destination}
              onChange={(v) => dispatch({ type: 'SET_DESTINATION', payload: v })} color="#ea4335" />
          </div>

          {/* Add Stop Button */}
          <button onClick={() => { if (stops.length < 8) setStops([...stops, { name: '', lat: null, lon: null }]); }}
            style={{ width: '100%', padding: '8px', marginTop: 8, background: 'none', border: '1px dashed var(--border)',
              borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.target.style.borderColor = 'var(--blue)'; e.target.style.color = 'var(--blue)'; }}
            onMouseLeave={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)'; }}>
            <Plus style={{ width: 14, height: 14 }} /> Add stop
          </button>

          {/* Preference Pills (for direct route) */}
          {!isMultiStop && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {[
                { v: 'fastest', l: '⚡ Fastest' }, { v: 'cheapest', l: '💰 Cheapest' },
                { v: 'scenic', l: '🌿 Scenic' }, { v: 'avoid_tolls', l: '🚫 No Tolls' },
              ].map(p => (
                <button key={p.v} onClick={() => dispatch({ type: 'SET_PREFERENCE', payload: p.v })}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: 'none',
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: state.preference === p.v ? 'var(--blue-dim)' : 'var(--panel-alt)',
                    color: state.preference === p.v ? 'var(--blue)' : 'var(--text-muted)' }}>
                  {p.l}
                </button>
              ))}
            </div>
          )}

          {/* Action Button */}
          <div style={{ marginTop: 10 }}>
            {isMultiStop ? (
              <button className="btn-green" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={handleMultiOptimize} disabled={multiLoading || !state.source || !state.destination}>
                {multiLoading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Optimizing {stops.filter(s=>s.lat).length + 2} stops...</>
                 : <><RouteIcon style={{ width: 14, height: 14 }} /> Optimize {stops.filter(s=>s.lat).length + 2}-Stop Route</>}
              </button>
            ) : (
              <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={handleFindRoute} disabled={state.loading || !state.source || !state.destination}>
                {state.loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Finding routes...</>
                 : <><Navigation style={{ width: 14, height: 14 }} /> Find Route</>}
              </button>
            )}
          </div>
        </div>

        {/* ── Results Tabs ── */}
        {(state.routes.length > 0 || multiResult) && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'routes', label: 'Routes' },
              { id: 'directions', label: 'Directions' },
              ...(multiResult ? [{ id: 'multi', label: 'Optimization' }] : []),
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 500, border: 'none', background: 'none',
                  cursor: 'pointer', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                  color: tab === t.id ? 'var(--blue)' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

          {/* Routes Tab */}
          {tab === 'routes' && state.routes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.routes.map((route, idx) => (
                <div key={idx} onClick={() => { dispatch({ type: 'SELECT_ROUTE', payload: route.index }); setDirectionsRoute(route); }}
                  style={{ padding: 12, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                    background: state.selectedRouteIndex === route.index ? 'var(--blue-dim)' : 'var(--panel-alt)',
                    border: `1px solid ${state.selectedRouteIndex === route.index ? 'var(--blue)' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{route.summary || `Route ${idx + 1}`}</span>
                      {route.isBest && (
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                          background: 'var(--green-dim)', color: 'var(--green)' }}>Best</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Distance</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDist(route.distance)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Time</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtTime(route.adjustedDuration || route.duration)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cost</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>₹{route.estimatedCost}</div>
                    </div>
                  </div>
                  {/* Click to see directions hint */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Navigation style={{ width: 10, height: 10 }} /> Click → tap "Directions" tab for turn-by-turn
                  </div>
                </div>
              ))}

              {/* AI Explanation */}
              {state.explanation?.summary && (
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)', marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    AI Analysis
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{state.explanation.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Directions Tab — Google Maps style */}
          {tab === 'directions' && directionsRoute?.directions && (
            <div>
              {/* Summary bar */}
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--blue-dim)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(directionsRoute.duration)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDist(directionsRoute.distance)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                  {directionsRoute.directions.length} steps<br />
                  via {directionsRoute.summary || 'road'}
                </div>
              </div>

              {/* Step-by-step directions */}
              <div>
                {directionsRoute.directions.map((step, i) => (
                  <DirectionStep key={i} step={step} idx={i} isLast={i === directionsRoute.directions.length - 1} />
                ))}
              </div>
            </div>
          )}

          {/* Multi-Stop Optimization Tab */}
          {tab === 'multi' && multiResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Savings banner */}
              {multiResult.distanceSaved > 0 && (
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--green-dim)', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>
                    Saved {fmtDist(multiResult.distanceSaved)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {multiResult.improvement}% shorter · {fmtTime(multiResult.timeSaved)} faster · {multiResult.method}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Distance</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtDist(multiResult.totalDistance)}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Time</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(multiResult.totalDuration)}</div>
                </div>
              </div>

              {/* Optimized Stop Order */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Optimized Visit Order
                </div>
                {multiResult.optimizedSequence?.map((stop, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
                    {/* Line connector */}
                    {i < multiResult.optimizedSequence.length - 1 && (
                      <div style={{ position: 'absolute', left: 9, top: 22, width: 2, height: 'calc(100% - 4px)',
                        background: 'var(--border)' }} />
                    )}
                    {/* Circle */}
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, zIndex: 1,
                      background: stop.isStart ? 'var(--green)' : stop.isEnd ? 'var(--red)' : 'var(--amber)',
                      color: stop.isStart || stop.isEnd ? 'white' : '#1a1d27' }}>
                      {stop.isStart ? 'S' : stop.isEnd ? 'E' : i}
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, paddingBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{stop.name?.split(',').slice(0, 2).join(',')}</div>
                      {stop.distToNext > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          ↓ {fmtDist(stop.distToNext)} · {fmtTime(stop.timeToNext)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Algorithm Comparison */}
              {multiResult.algorithmComparison && (
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Algorithm Comparison
                  </div>
                  {[
                    { label: 'Your order', val: multiResult.algorithmComparison.original, c: 'var(--text-muted)' },
                    { label: 'Nearest Neighbor', val: multiResult.algorithmComparison.nearestNeighbor, c: 'var(--amber)' },
                    { label: '2-opt Optimized', val: multiResult.algorithmComparison.twoOpt, c: 'var(--green)' },
                    ...(multiResult.algorithmComparison.osrm ? [{ label: 'OSRM TSP', val: multiResult.algorithmComparison.osrm, c: 'var(--blue)' }] : []),
                  ].map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                      <span style={{ color: a.c }}>{a.label}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{fmtDist(a.val.distance)} · {fmtTime(a.val.duration)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Explanation */}
              {multiResult.explanation?.summary && (
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>🧠 Why this order?</div>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{multiResult.explanation.summary}</p>
                  {multiResult.explanation.moves?.map((m, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--amber)' }}>→</span> <span>{m.stop}: {m.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* View Directions button */}
              {directionsRoute?.directions?.length > 0 && (
                <button onClick={() => setTab('directions')}
                  style={{ width: '100%', padding: 10, borderRadius: 8, background: 'var(--blue-dim)',
                    border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Navigation style={{ width: 14, height: 14 }} /> View Turn-by-Turn Directions
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {state.routes.length === 0 && !multiResult && !state.loading && !multiLoading && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Navigation style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Enter locations to find routes</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Add stops to optimize visiting order
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          Routes: OSRM · Maps: OpenStreetMap · Geocoding: Nominatim · All real data
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView stops={stops.filter(s => s.lat)} multiResult={multiResult} />
      </div>
    </div>
  );
}
