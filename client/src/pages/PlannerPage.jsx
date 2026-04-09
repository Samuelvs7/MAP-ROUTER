import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Navigation, Clock, Plus, X, Loader2, Zap, Cloud, BarChart3, Brain } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import { optimizeRoute, geocodePlace, saveHistory } from '../services/api';
import MapView from '../components/map/MapView';

const PREFERENCES = [
  { value: 'fastest', label: 'Fastest', icon: '⚡', desc: 'Minimize travel time' },
  { value: 'cheapest', label: 'Cheapest', icon: '💰', desc: 'Minimize fuel & tolls' },
  { value: 'scenic', label: 'Scenic', icon: '🌿', desc: 'Prefer rural & scenic roads' },
  { value: 'avoid_tolls', label: 'No Tolls', icon: '🚫', desc: 'Avoid toll roads' },
];

function LocationInput({ placeholder, value, onChange, icon: Icon }) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (val.length >= 2) {
      timeoutRef.current = setTimeout(async () => {
        try {
          const res = await geocodePlace(val);
          setSuggestions(res.data.results || []);
          setShowSuggestions(true);
        } catch { setSuggestions([]); }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s) => {
    setQuery(s.name);
    onChange(s);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
        <input
          type="text"
          className="input-glass pl-10"
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
      </div>
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full left-0 right-0 mt-1 glass z-50 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => selectSuggestion(s)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-500/10 transition-colors text-sm"
              >
                <MapPin className="w-4 h-4 text-primary-400 shrink-0" />
                <span className="text-surface-200 truncate">{s.name}</span>
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
  const [showAlgoDetails, setShowAlgoDetails] = useState(false);

  const handleOptimize = useCallback(async () => {
    if (!state.source || !state.destination) {
      toast.error('Please enter both source and destination');
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await optimizeRoute({
        source: state.source,
        destination: state.destination,
        preference: state.preference,
        departureTime: state.departureTime,
      });
      dispatch({ type: 'SET_RESULTS', payload: res.data });
      toast.success('Routes optimized by AI!');

      // Save to history
      try {
        await saveHistory({
          source: state.source,
          destination: state.destination,
          preference: state.preference,
          selectedRoute: res.data.routes[0],
          alternativeRoutes: res.data.routes.slice(1),
          weatherCondition: res.data.weather?.condition,
          aiExplanation: res.data.explanation?.summary,
        });
      } catch { /* History save failure is non-critical */ }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      toast.error('Failed to optimize routes');
    }
  }, [state.source, state.destination, state.preference, state.departureTime, dispatch]);

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left Panel ── */}
          <div className="w-full lg:w-[380px] shrink-0 space-y-5">
            {/* Route Input Card */}
            <div className="glass p-5">
              <h2 className="text-lg font-bold text-surface-100 mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary-400" />
                Plan Your Route
              </h2>

              <div className="space-y-3">
                <LocationInput
                  placeholder="Enter source city..."
                  value={state.source}
                  onChange={(val) => dispatch({ type: 'SET_SOURCE', payload: val })}
                  icon={MapPin}
                />
                <LocationInput
                  placeholder="Enter destination city..."
                  value={state.destination}
                  onChange={(val) => dispatch({ type: 'SET_DESTINATION', payload: val })}
                  icon={Search}
                />
              </div>

              {/* Preference Selector */}
              <div className="mt-4">
                <label className="text-sm font-medium text-surface-400 mb-2 block">Route Preference</label>
                <div className="grid grid-cols-2 gap-2">
                  {PREFERENCES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => dispatch({ type: 'SET_PREFERENCE', payload: p.value })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                        ${state.preference === p.value
                          ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-lg shadow-primary-500/10'
                          : 'bg-surface-800/50 text-surface-400 border border-surface-700 hover:border-surface-600'
                        }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Departure Time */}
              <div className="mt-4">
                <label className="text-sm font-medium text-surface-400 mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Departure Time (optional)
                </label>
                <input
                  type="datetime-local"
                  className="input-glass text-sm"
                  onChange={(e) => dispatch({ type: 'SET_DEPARTURE', payload: e.target.value || null })}
                />
              </div>

              {/* Optimize Button */}
              <button
                onClick={handleOptimize}
                disabled={state.loading || !state.source || !state.destination}
                className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
              >
                {state.loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Optimizing...</>
                ) : (
                  <><Brain className="w-5 h-5" /> Optimize with AI</>
                )}
              </button>
            </div>

            {/* ── Results Panel ── */}
            <AnimatePresence>
              {state.routes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {/* Weather Badge */}
                  {state.weather && (
                    <div className="glass-sm p-3 mb-4 flex items-center gap-3">
                      <Cloud className="w-5 h-5 text-accent-cyan" />
                      <div>
                        <span className="text-sm text-surface-200 font-medium">{state.weather.condition}</span>
                        <span className="text-xs text-surface-400 ml-2">{state.weather.temperature}°C</span>
                      </div>
                    </div>
                  )}

                  {/* Route Cards */}
                  <div className="space-y-3">
                    {state.routes.map((route, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => dispatch({ type: 'SELECT_ROUTE', payload: route.index })}
                        className={`glass p-4 cursor-pointer transition-all duration-300
                          ${state.selectedRouteIndex === route.index
                            ? 'border-primary-500/40 shadow-lg shadow-primary-500/10'
                            : 'hover:border-surface-600'
                          }
                          ${route.isBest ? 'ring-1 ring-accent-green/30' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-surface-100 font-semibold text-sm">
                                {route.summary || `Route ${idx + 1}`}
                              </span>
                              {route.isBest && (
                                <span className="score-badge score-best">
                                  <Zap className="w-3 h-3 mr-1" /> Best
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-mono px-2 py-1 rounded-lg
                            ${route.isBest ? 'bg-accent-green/15 text-accent-green' : 'bg-surface-800 text-surface-400'}`}>
                            Score: {route.score}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div>
                            <div className="text-xs text-surface-500">Distance</div>
                            <div className="text-sm font-semibold text-surface-200">{(route.distance / 1000).toFixed(1)} km</div>
                          </div>
                          <div>
                            <div className="text-xs text-surface-500">Time</div>
                            <div className="text-sm font-semibold text-surface-200">
                              {Math.round((route.adjustedDuration || route.duration) / 60)} min
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-surface-500">Cost</div>
                            <div className="text-sm font-semibold text-surface-200">₹{route.estimatedCost}</div>
                          </div>
                        </div>

                        {/* Road type bar */}
                        {route.roadTypes && (
                          <div className="flex gap-0.5 mt-3 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-primary-500" style={{ width: `${route.roadTypes.highway}%` }} title="Highway" />
                            <div className="bg-accent-amber" style={{ width: `${route.roadTypes.urban}%` }} title="Urban" />
                            <div className="bg-accent-green" style={{ width: `${route.roadTypes.rural}%` }} title="Rural" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* AI Explanation */}
                  {state.explanation && (
                    <div className="glass p-4 mt-4 border-primary-500/20">
                      <h4 className="text-sm font-semibold text-primary-400 mb-2 flex items-center gap-1.5">
                        <Brain className="w-4 h-4" /> AI Analysis
                      </h4>
                      <p className="text-sm text-surface-300 leading-relaxed">{state.explanation.summary}</p>

                      {state.explanation.factors && (
                        <div className="mt-3 space-y-2">
                          {state.explanation.factors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-surface-400">{f.factor}</span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full
                                  ${f.impact === 'high' ? 'bg-accent-rose/15 text-accent-rose' :
                                    f.impact === 'medium' ? 'bg-accent-amber/15 text-accent-amber' :
                                    'bg-surface-700 text-surface-400'}`}>
                                  {f.impact}
                                </span>
                                <span className="text-surface-500 max-w-[140px] truncate">{f.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Algorithm Comparison */}
                  {state.algorithmComparison && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowAlgoDetails(!showAlgoDetails)}
                        className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        {showAlgoDetails ? 'Hide' : 'Show'} Algorithm Comparison
                      </button>
                      <AnimatePresence>
                        {showAlgoDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="glass-sm p-3 mt-2 space-y-2">
                              {state.algorithmComparison.map((cmp, i) => (
                                <div key={i} className="text-xs">
                                  <div className="text-surface-300 font-medium mb-1">Route {cmp.routeIndex + 1}</div>
                                  <div className="flex justify-between text-surface-500">
                                    <span>Dijkstra: {cmp.dijkstra.nodesVisited} nodes</span>
                                    <span>A*: {cmp.astar.nodesVisited} nodes</span>
                                    <span className="text-accent-green">{cmp.astar.improvement}% faster</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right Panel: Map ── */}
          <div className="flex-1 min-h-[500px] lg:min-h-[calc(100vh-120px)]">
            <div className="glass overflow-hidden h-full" style={{ minHeight: '500px' }}>
              <MapView />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
