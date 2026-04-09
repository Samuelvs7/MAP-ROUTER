import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Navigation, Clock, Plus, X, Loader2, Zap, Cloud, BarChart3, Brain, Truck, ArrowRight, GripVertical, Package, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import { optimizeRoute, optimizeMultiStop, geocodePlace, saveHistory } from '../services/api';
import MapView from '../components/map/MapView';

const PREFERENCES = [
  { value: 'fastest', label: 'Fastest', icon: '⚡' },
  { value: 'cheapest', label: 'Cheapest', icon: '💰' },
  { value: 'scenic', label: 'Scenic', icon: '🌿' },
  { value: 'avoid_tolls', label: 'No Tolls', icon: '🚫' },
];

/* ── Location Input with Real Geocoding ── */
function LocationInput({ placeholder, value, onChange, icon: Icon, onClear }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShow(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length >= 3) {
      setLoading(true);
      timerRef.current = setTimeout(async () => {
        try {
          const res = await geocodePlace(val);
          setSuggestions(res.data.results || []);
          setShow(true);
        } catch { setSuggestions([]); }
        setLoading(false);
      }, 500);
    } else {
      setSuggestions([]);
      setShow(false);
    }
  };

  const select = (s) => { setQuery(s.name); onChange(s); setShow(false); };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative flex items-center">
        <Icon className="absolute left-3 w-4 h-4 text-slate-400" />
        <input type="text" className="input-glass pl-9 pr-8 text-sm" placeholder={placeholder}
          value={query} onChange={handleInput} onFocus={() => suggestions.length > 0 && setShow(true)} />
        {loading && <Loader2 className="absolute right-8 w-4 h-4 text-indigo-400 animate-spin" />}
        {value && onClear && (
          <button onClick={() => { setQuery(''); onChange(null); onClear(); }}
            className="absolute right-2 p-1 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {show && suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg z-50 overflow-hidden shadow-xl">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => select(s)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-indigo-500/10 transition-colors text-xs">
                <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-200 truncate">{s.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlannerPage() {
  const { state, dispatch } = useRoute();
  const [mode, setMode] = useState('route'); // 'route' or 'delivery'
  const [stops, setStops] = useState([]);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  // ── Single Route Optimization ──
  const handleOptimize = useCallback(async () => {
    if (!state.source || !state.destination) return toast.error('Enter source & destination');
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await optimizeRoute({
        source: state.source, destination: state.destination,
        preference: state.preference, departureTime: state.departureTime,
      });
      dispatch({ type: 'SET_RESULTS', payload: res.data });
      toast.success(`${res.data.routes.length} routes found (${res.data.metadata?.dataSource || 'OSRM'})`);
      try { await saveHistory({ source: state.source, destination: state.destination, preference: state.preference,
        selectedRoute: res.data.routes[0], weatherCondition: res.data.weather?.condition, aiExplanation: res.data.explanation?.summary }); } catch {}
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.response?.data?.error || err.message });
      toast.error(err.response?.data?.error || 'Failed to optimize');
    }
  }, [state.source, state.destination, state.preference, state.departureTime, dispatch]);

  // ── Multi-Stop Delivery Optimization ──
  const handleDeliveryOptimize = useCallback(async () => {
    if (!state.source) return toast.error('Enter start location');
    if (!state.destination) return toast.error('Enter end location');
    const validStops = stops.filter(s => s.lat && s.lon);
    if (validStops.length === 0) return toast.error('Add at least 1 delivery stop');

    setDeliveryLoading(true);
    setDeliveryResult(null);
    try {
      const res = await optimizeMultiStop({
        source: state.source, destination: state.destination, stops: validStops,
      });
      setDeliveryResult(res.data);
      // Put the delivery route geometry on the map
      if (res.data.geometry) {
        dispatch({ type: 'SET_RESULTS', payload: {
          routes: [{ index: 0, distance: res.data.totalDistance, duration: res.data.totalDuration,
            estimatedCost: Math.round((res.data.totalDistance / 1000) * 6.5), score: 0,
            isBest: true, rank: 1, summary: 'Optimized Delivery Route', geometry: res.data.geometry,
            adjustedDuration: res.data.totalDuration, roadTypes: { highway: 40, urban: 40, rural: 20 } }],
          bestRouteIndex: 0, explanation: { summary: res.data.explanation?.summary || '', factors: [] },
          weather: state.weather || { condition: 'Clear', temperature: 25 },
        }});
      }
      toast.success(`Delivery route optimized! Saved ${(res.data.distanceSaved / 1000).toFixed(1)} km`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Optimization failed');
    }
    setDeliveryLoading(false);
  }, [state.source, state.destination, stops, dispatch]);

  const addStop = () => { if (stops.length < 8) setStops([...stops, { name: '', lat: null, lon: null }]); };
  const removeStop = (idx) => setStops(stops.filter((_, i) => i !== idx));
  const updateStop = (idx, val) => { const ns = [...stops]; ns[idx] = val || { name: '', lat: null, lon: null }; setStops(ns); };

  const formatDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  const formatTime = (s) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden">
      {/* ── Left Panel ── */}
      <div className="w-[380px] shrink-0 bg-slate-900/95 border-r border-slate-800 flex flex-col overflow-y-auto">
        {/* Mode Toggle */}
        <div className="p-3 border-b border-slate-800">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button onClick={() => { setMode('route'); setDeliveryResult(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all
              ${mode === 'route' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              <Route className="w-3.5 h-3.5" /> Route Mode
            </button>
            <button onClick={() => setMode('delivery')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all
              ${mode === 'delivery' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              <Truck className="w-3.5 h-3.5" /> Delivery Mode
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="p-3 space-y-2 border-b border-slate-800">
          <LocationInput placeholder={mode === 'delivery' ? 'Start location (warehouse/hub)...' : 'Source...'}
            value={state.source} onChange={(v) => dispatch({ type: 'SET_SOURCE', payload: v })} icon={MapPin} />
          
          {/* Delivery Stops */}
          {mode === 'delivery' && (
            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <LocationInput placeholder={`Delivery stop ${idx + 1}...`} value={stop.lat ? stop : null}
                      onChange={(v) => updateStop(idx, v)} icon={Package} onClear={() => removeStop(idx)} />
                  </div>
                  <button onClick={() => removeStop(idx)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {stops.length < 8 && (
                <button onClick={addStop}
                  className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-xs text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Delivery Stop
                </button>
              )}
            </div>
          )}

          <LocationInput placeholder={mode === 'delivery' ? 'Final destination...' : 'Destination...'}
            value={state.destination} onChange={(v) => dispatch({ type: 'SET_DESTINATION', payload: v })} icon={Search} />
        </div>

        {/* Preferences (Route Mode only) */}
        {mode === 'route' && (
          <div className="p-3 border-b border-slate-800">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium block mb-2">Preference</label>
            <div className="grid grid-cols-4 gap-1">
              {PREFERENCES.map(p => (
                <button key={p.value} onClick={() => dispatch({ type: 'SET_PREFERENCE', payload: p.value })}
                  className={`py-2 rounded-lg text-[11px] font-medium transition-all
                  ${state.preference === p.value ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent hover:border-slate-700'}`}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="p-3 border-b border-slate-800">
          {mode === 'route' ? (
            <button onClick={handleOptimize} disabled={state.loading || !state.source || !state.destination}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2">
              {state.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Optimizing...</>
               : <><Brain className="w-4 h-4" /> Find Optimal Route</>}
            </button>
          ) : (
            <button onClick={handleDeliveryOptimize} disabled={deliveryLoading || !state.source || !state.destination || stops.filter(s => s.lat).length === 0}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all
                bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
              {deliveryLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</>
               : <><Truck className="w-4 h-4" /> Optimize Delivery Route</>}
            </button>
          )}
        </div>

        {/* ── Results Section ── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Weather */}
          {state.weather && state.routes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg text-xs">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">{state.weather.condition}</span>
              <span className="text-slate-500">{state.weather.temperature}°C</span>
            </div>
          )}

          {/* Route Results (Route Mode) */}
          {mode === 'route' && state.routes.length > 0 && (
            <>
              {state.routes.map((route, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}
                  onClick={() => dispatch({ type: 'SELECT_ROUTE', payload: route.index })}
                  className={`p-3 rounded-lg cursor-pointer transition-all border
                    ${state.selectedRouteIndex === route.index
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-slate-800/30 border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{route.summary || `Route ${idx + 1}`}</span>
                      {route.isBest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          ⚡ Best
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Score: {route.score}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><div className="text-[10px] text-slate-500">Distance</div>
                      <div className="text-sm font-semibold text-slate-200">{formatDist(route.distance)}</div></div>
                    <div><div className="text-[10px] text-slate-500">Time</div>
                      <div className="text-sm font-semibold text-slate-200">{formatTime(route.adjustedDuration || route.duration)}</div></div>
                    <div><div className="text-[10px] text-slate-500">Cost</div>
                      <div className="text-sm font-semibold text-slate-200">₹{route.estimatedCost}</div></div>
                  </div>
                  {route.roadTypes && (
                    <div className="flex gap-px mt-2 h-1 rounded-full overflow-hidden">
                      <div className="bg-indigo-500" style={{ width: `${route.roadTypes.highway}%` }} />
                      <div className="bg-amber-500" style={{ width: `${route.roadTypes.urban}%` }} />
                      <div className="bg-emerald-500" style={{ width: `${route.roadTypes.rural}%` }} />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* AI Explanation */}
              {state.explanation?.summary && (
                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-medium mb-1.5 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> AI Analysis
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{state.explanation.summary}</p>
                  {state.explanation.factors?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {state.explanation.factors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">{f.factor}</span>
                          <span className={`px-1.5 py-0.5 rounded
                            ${f.impact === 'high' ? 'bg-rose-500/15 text-rose-400' : f.impact === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                            {f.impact}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Data source badge */}
              <div className="text-center text-[10px] text-slate-600 py-1">
                Data: OSRM (real road distances) • Map: OpenStreetMap
              </div>
            </>
          )}

          {/* Delivery Results */}
          {mode === 'delivery' && deliveryResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {/* Summary Card */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-2">
                  📦 Optimized Delivery Route
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-[10px] text-slate-500">Total Distance</div>
                    <div className="text-lg font-bold text-slate-100">{formatDist(deliveryResult.totalDistance)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Total Time</div>
                    <div className="text-lg font-bold text-slate-100">{formatTime(deliveryResult.totalDuration)}</div>
                  </div>
                </div>

                {deliveryResult.distanceSaved > 0 && (
                  <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 text-center">
                    <div className="text-emerald-400 text-sm font-bold">
                      🎉 Saved {formatDist(deliveryResult.distanceSaved)} ({deliveryResult.improvement}%)
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      vs. original order • {deliveryResult.method}
                    </div>
                  </div>
                )}
              </div>

              {/* Stop Sequence Timeline */}
              <div className="space-y-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2 px-1">
                  Optimized Stop Order
                </div>
                {deliveryResult.optimizedSequence?.map((stop, idx) => (
                  <div key={idx} className="flex items-start gap-2 relative">
                    {/* Timeline line */}
                    {idx < deliveryResult.optimizedSequence.length - 1 && (
                      <div className="absolute left-[9px] top-5 w-px h-full bg-slate-700" />
                    )}
                    {/* Dot */}
                    <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold z-10
                      ${stop.isStart ? 'bg-emerald-500 text-white' :
                        stop.isEnd ? 'bg-rose-500 text-white' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                      {stop.isStart ? 'S' : stop.isEnd ? 'E' : stop.sequenceNumber - 1}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-3">
                      <div className="text-xs font-medium text-slate-200 leading-tight">{stop.name}</div>
                      {stop.distanceToNext > 0 && (
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>→ {formatDist(stop.distanceToNext)}</span>
                          <span>{formatTime(stop.durationToNext)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leg Breakdown */}
              {deliveryResult.legs?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium px-1">Leg Details</div>
                  {deliveryResult.legs.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded text-[11px]">
                      <span className="text-slate-300 truncate flex-1">{leg.from.split(',')[0]} → {leg.to.split(',')[0]}</span>
                      <span className="text-slate-400 ml-2 whitespace-nowrap">{formatDist(leg.distance)} • {formatTime(leg.duration)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Algorithm Comparison */}
              {deliveryResult.algorithmComparison && (
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">Algorithm Comparison</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Original order</span>
                      <span className="text-slate-300">{formatDist(deliveryResult.algorithmComparison.original.distance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nearest Neighbor</span>
                      <span className="text-slate-300">{formatDist(deliveryResult.algorithmComparison.nearestNeighbor.distance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">2-opt optimized</span>
                      <span className="text-emerald-400 font-medium">{formatDist(deliveryResult.algorithmComparison.twoOpt.distance)}</span>
                    </div>
                    {deliveryResult.algorithmComparison.osrm && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">OSRM Trip API</span>
                        <span className="text-indigo-400 font-medium">{formatDist(deliveryResult.algorithmComparison.osrm.distance)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {deliveryResult.explanation && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-1.5">
                    🧠 AI Explanation
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{deliveryResult.explanation.summary}</p>
                  {deliveryResult.explanation.moves?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {deliveryResult.explanation.moves.map((move, i) => (
                        <div key={i} className="text-[10px] text-slate-400 flex items-start gap-1">
                          <span className="text-amber-400">→</span>
                          <span><strong className="text-slate-300">{move.stop.split(',')[0]}</strong>: {move.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Map (Full remaining width) ── */}
      <div className="flex-1 relative">
        <MapView deliveryStops={mode === 'delivery' ? stops.filter(s => s.lat) : []}
          deliveryResult={deliveryResult} />
        {/* Mode indicator badge */}
        <div className="absolute top-3 right-3 z-[500]">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg backdrop-blur
            ${mode === 'delivery' ? 'bg-emerald-500/90 text-white' : 'bg-indigo-500/90 text-white'}`}>
            {mode === 'delivery' ? '📦 Delivery Mode' : '🗺️ Route Mode'}
          </div>
        </div>
      </div>
    </div>
  );
}
