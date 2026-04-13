import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, Pause, Play, FastForward, X, MapPin, Clock, ArrowRight, Volume2, VolumeX, Gauge } from 'lucide-react';

/**
 * Navigation Simulator — Google Maps-style turn-by-turn navigation
 * Moves a marker along the route, shows current instruction, remaining distance/time
 */
export default function NavigationPanel({ route, onPositionUpdate, onClose }) {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 3x, 10x
  const [progress, setProgress] = useState(0); // 0 to 1
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [elapsedDistance, setElapsedDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const intervalRef = useRef(null);
  const coordsRef = useRef([]);
  const totalDistRef = useRef(0);
  const posIdxRef = useRef(0);

  const directions = route?.directions || [];
  const totalDist = route?.distance || 0;
  const totalDur = route?.duration || 0;
  const coords = route?.geometry?.coordinates || [];

  // Build cumulative distances for each coordinate
  useEffect(() => {
    if (coords.length < 2) return;
    const cumDist = [0];
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      const d = Math.sqrt(dx * dx + dy * dy) * 111000; // rough meters
      total += d;
      cumDist.push(total);
    }
    coordsRef.current = cumDist;
    totalDistRef.current = total;
  }, [coords]);

  // Find which direction step we're currently at based on elapsed distance
  useEffect(() => {
    if (!directions.length || progress >= 1) return;
    let cumDist = 0;
    for (let i = 0; i < directions.length; i++) {
      cumDist += directions[i].distance;
      if (cumDist > elapsedDistance) {
        if (currentStepIdx !== i) { // Step changed!
          setCurrentStepIdx(i);
          if (!isMuted && isRunning) { // Voice Navigation
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(directions[i].instruction));
          }
        }
        return;
      }
    }
  }, [elapsedDistance, directions, currentStepIdx, isMuted, isRunning, progress]);

  // Animation loop
  useEffect(() => {
    if (!isRunning || coords.length < 2) return;

    const stepMs = 50; // update every 50ms
    const metersPerTick = (totalDist / totalDur) * (stepMs / 1000) * speed;

    intervalRef.current = setInterval(() => {
      setElapsedDistance(prev => {
        const next = prev + metersPerTick;
        if (next >= totalDist) {
          setIsRunning(false);
          setProgress(1);
          return totalDist;
        }

        // Find position on polyline
        const fraction = next / totalDist;
        setProgress(fraction);
        setElapsedTime(totalDur * fraction);

        // Speedometer calculation
        const baseSpeedMs = (totalDist / totalDur) * speed;
        const jitter = (Math.random() - 0.5) * 2; // +/- 1 m/s variance
        setCurrentSpeedKmh(Math.max(0, Math.round((baseSpeedMs + jitter) * 3.6)));

        const targetDist = (fraction) * totalDistRef.current;
        const cumDist = coordsRef.current;
        let idx = 0;
        for (let i = 0; i < cumDist.length - 1; i++) {
          if (cumDist[i + 1] >= targetDist) { idx = i; break; }
          idx = i;
        }

        if (idx < coords.length - 1) {
          const segStart = cumDist[idx];
          const segEnd = cumDist[idx + 1];
          const segFrac = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
          const lat = coords[idx][1] + (coords[idx + 1][1] - coords[idx][1]) * segFrac;
          const lon = coords[idx][0] + (coords[idx + 1][0] - coords[idx][0]) * segFrac;

          // Calculate bearing for arrow rotation
          const dLon = coords[idx + 1][0] - coords[idx][0];
          const dLat = coords[idx + 1][1] - coords[idx][1];
          const bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);

          onPositionUpdate({ lat, lon, bearing, progress: fraction });
        }

        return next;
      });
    }, stepMs);

    return () => clearInterval(intervalRef.current);
  }, [isRunning, speed, coords, totalDist, totalDur, onPositionUpdate]);

  const handleStart = () => {
    if (progress >= 1) {
      // Reset
      setProgress(0);
      setElapsedDistance(0);
      setElapsedTime(0);
      setCurrentStepIdx(0);
      posIdxRef.current = 0;
    }
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  const fmtTime = (s) => { const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };

  const currentStep = directions[currentStepIdx];
  const nextStep = directions[currentStepIdx + 1];
  const remainDist = Math.max(0, totalDist - elapsedDistance);
  const remainTime = Math.max(0, totalDur - elapsedTime);

  const getStepIcon = (type, modifier) => {
    if (type === 'depart') return '🚗';
    if (type === 'arrive') return '🏁';
    if (type === 'turn' && modifier?.includes('left')) return '↰';
    if (type === 'turn' && modifier?.includes('right')) return '↱';
    if (type === 'roundabout') return '🔄';
    return '→';
  };

  // Distance to next turn
  let distToNextTurn = 0;
  if (currentStep) {
    let cumBefore = 0;
    for (let i = 0; i < currentStepIdx; i++) cumBefore += directions[i].distance;
    distToNextTurn = Math.max(0, cumBefore + currentStep.distance - elapsedDistance);
  }

  if (!route || coords.length < 2) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Current Instruction — Big Display */}
      <div style={{ padding: 16, background: progress >= 1 ? '#1a3d24' : '#1a2744', borderBottom: '1px solid var(--border)' }}>
        {progress >= 1 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>🏁</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>You have arrived!</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{fmtDist(totalDist)} traveled</div>
          </div>
        ) : currentStep ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>{getStepIcon(currentStep.type, currentStep.modifier)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                  {currentStep.instruction}
                </div>
                {distToNextTurn > 0 && (
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)', marginTop: 4 }}>
                    {fmtDist(distToNextTurn)}
                  </div>
                )}
              </div>
            </div>
            {/* Next instruction preview */}
            {nextStep && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                <span style={{ fontSize: 16 }}>{getStepIcon(nextStep.type, nextStep.modifier)}</span>
                <span>Then: {nextStep.instruction}</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>Press Start to begin navigation</div>
        )}
      </div>

      {/* HUD Bar (Speed & Voice) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#1a1d27', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(66, 133, 244, 0.1)', border: '2px solid rgba(66, 133, 244, 0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(66, 133, 244, 0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{isRunning ? currentSpeedKmh : 0}</div>
            <div style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 600 }}>km/h</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>LIVE SPEED</div>
        </div>
        <button 
          onClick={() => {
            setIsMuted(!isMuted);
            if (isMuted) {
              window.speechSynthesis.speak(new SpeechSynthesisUtterance('Voice navigation enabled'));
            } else {
              window.speechSynthesis.cancel();
            }
          }}
          title={isMuted ? 'Unmute voice navigation' : 'Mute voice navigation'}
          style={{ background: isMuted ? 'rgba(234, 67, 53, 0.1)' : 'rgba(52, 168, 83, 0.1)', color: isMuted ? '#ea4335' : '#34a853', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: progress >= 1 ? 'var(--green)' : 'var(--blue)',
          width: `${progress * 100}%`, transition: 'width 0.1s linear' }} />
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Remaining</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtDist(remainDist)}</div>
        </div>
        <div style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Time Left</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(remainTime)}</div>
        </div>
        <div style={{ padding: '10px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Traveled</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{fmtDist(elapsedDistance)}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        {!isRunning ? (
          <button onClick={handleStart} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: progress >= 1 ? 'var(--green)' : '#4285f4', color: 'white', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(66,133,244,0.3)' }}>
            <Play style={{ width: 16, height: 16 }} /> {progress >= 1 ? 'Restart' : progress > 0 ? 'Resume' : 'Start Navigation'}
          </button>
        ) : (
          <button onClick={handlePause} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: '#f59e0b', color: '#1a1d27', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
            <Pause style={{ width: 16, height: 16 }} /> Pause
          </button>
        )}

        {/* Speed selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 3, 10].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              style={{ padding: '8px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
                background: speed === s ? 'var(--blue-dim)' : 'var(--panel-alt)',
                color: speed === s ? 'var(--blue)' : 'var(--text-muted)' }}>
              {s}x
            </button>
          ))}
        </div>

        <button onClick={onClose} style={{ padding: 8, borderRadius: 6, border: 'none',
          background: 'var(--panel-alt)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Upcoming Directions */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: 0.5, marginBottom: 6 }}>
          Upcoming
        </div>
        {directions.slice(currentStepIdx).map((step, i) => (
          <div key={currentStepIdx + i} style={{
            display: 'flex', gap: 8, padding: '6px 0',
            borderBottom: i < directions.length - currentStepIdx - 1 ? '1px solid var(--border)' : 'none',
            opacity: i === 0 ? 1 : 0.6,
          }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>
              {getStepIcon(step.type, step.modifier)}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: i === 0 ? 'var(--text)' : 'var(--text-dim)', fontWeight: i === 0 ? 600 : 400 }}>
                {step.instruction}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fmtDist(step.distance)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
