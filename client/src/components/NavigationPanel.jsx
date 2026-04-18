import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigation, Pause, Play, X, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const lambda = toRad(lon2 - lon1);

  const y = Math.sin(lambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);

  const angle = toDeg(Math.atan2(y, x));
  return (angle + 360) % 360;
}

function projectToSegment(point, start, end) {
  const scaleX = Math.max(1, 111320 * Math.cos((point.lat * Math.PI) / 180));
  const scaleY = 110540;

  const px = point.lon * scaleX;
  const py = point.lat * scaleY;
  const ax = start.lon * scaleX;
  const ay = start.lat * scaleY;
  const bx = end.lon * scaleX;
  const by = end.lat * scaleY;

  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;

  if (ab2 <= 0.000001) {
    const dx = px - ax;
    const dy = py - ay;
    return { t: 0, distance: Math.hypot(dx, dy) };
  }

  const apx = px - ax;
  const apy = py - ay;
  const rawT = (apx * abx + apy * aby) / ab2;
  const t = Math.min(1, Math.max(0, rawT));

  const cx = ax + abx * t;
  const cy = ay + aby * t;

  return {
    t,
    distance: Math.hypot(px - cx, py - cy),
  };
}

function fmtDist(meters = 0) {
  if (!Number.isFinite(meters)) return '--';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(meters))} m`;
}

function fmtTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '--';
  const totalMin = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

export default function NavigationPanel({ route, onPositionUpdate, onClose }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [navMode, setNavMode] = useState('sim'); // 'sim' or 'live'
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedDistance, setElapsedDistance] = useState(0);
  const [remainDistance, setRemainDistance] = useState(0);
  const [remainTimeSeconds, setRemainTimeSeconds] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [eta, setEta] = useState('--:--');
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [simDist, setSimDist] = useState(0);

  const watchIdRef = useRef(null);
  const prevPointRef = useRef(null);
  const lastSpokenStepRef = useRef(-1);

  const directions = route?.directions || [];
  const totalDistance = route?.distance || 0;
  const totalDuration = route?.adjustedDuration || route?.duration || 0;

  const polyline = useMemo(() => {
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const segments = [];
    let cumulative = 0;

    for (let i = 1; i < coords.length; i += 1) {
      const start = { lon: coords[i - 1][0], lat: coords[i - 1][1] };
      const end = { lon: coords[i][0], lat: coords[i][1] };
      const length = haversineMeters(start.lat, start.lon, end.lat, end.lon);
      segments.push({ start, end, length, cumulativeStart: cumulative });
      cumulative += length;
    }

    return { segments, total: cumulative };
  }, [route?.geometry?.coordinates]);

  const directionCumulative = useMemo(() => {
    const values = [];
    let running = 0;
    for (const step of directions) {
      running += Number(step?.distance) || 0;
      values.push(running);
    }
    return values;
  }, [directions]);

  const updateNavigationState = useCallback((coords) => {
    if (!polyline || polyline.segments.length === 0) return;

    const point = { lat: coords.latitude, lon: coords.longitude };

    let bestMatch = null;
    for (const segment of polyline.segments) {
      const projection = projectToSegment(point, segment.start, segment.end);
      if (!bestMatch || projection.distance < bestMatch.distance) {
        bestMatch = {
          ...projection,
          segment,
        };
      }
    }

    if (!bestMatch) return;

    const traveled =
      bestMatch.segment.cumulativeStart + bestMatch.segment.length * bestMatch.t;
    const progressValue = polyline.total > 0 ? Math.min(1, Math.max(0, traveled / polyline.total)) : 0;
    const remaining = Math.max(0, polyline.total - traveled);
    const remainingTime =
      totalDistance > 0 && totalDuration > 0
        ? Math.round((remaining / totalDistance) * totalDuration)
        : Math.max(0, Math.round((1 - progressValue) * totalDuration));

    let heading = computeBearing(
      bestMatch.segment.start.lat,
      bestMatch.segment.start.lon,
      bestMatch.segment.end.lat,
      bestMatch.segment.end.lon,
    );

    const speedFromSensor = Number(coords.speed);
    let speed = Number.isFinite(speedFromSensor) && speedFromSensor >= 0
      ? Math.round(speedFromSensor * 3.6)
      : 0;

    const previous = prevPointRef.current;
    if (previous) {
      const deltaDistance = haversineMeters(previous.lat, previous.lon, point.lat, point.lon);
      const deltaSeconds = Math.max(0.001, (Date.now() - previous.time) / 1000);
      if (speed === 0) speed = Math.round((deltaDistance / deltaSeconds) * 3.6);
      if (deltaDistance >= 3) heading = computeBearing(previous.lat, previous.lon, point.lat, point.lon);
    }
    prevPointRef.current = { ...point, time: Date.now() };

    let stepIdx = 0;
    while (stepIdx < directionCumulative.length && traveled > directionCumulative[stepIdx]) {
      stepIdx += 1;
    }
    stepIdx = Math.min(stepIdx, Math.max(0, directions.length - 1));

    const distToNext =
      directionCumulative.length > 0
        ? Math.max(0, (directionCumulative[stepIdx] || directionCumulative[directionCumulative.length - 1]) - traveled)
        : 0;

    const arrival = new Date(Date.now() + remainingTime * 1000);
    const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setCurrentStepIdx(stepIdx);
    setProgress(progressValue);
    setElapsedDistance(traveled);
    setRemainDistance(remaining);
    setRemainTimeSeconds(remainingTime);
    setSpeedKmh(Math.max(0, speed));
    setEta(etaText);
    setDistanceToTurn(distToNext);

    onPositionUpdate?.({
      lat: point.lat,
      lon: point.lon,
      bearing: heading,
      progress: progressValue,
      currentStepIdx: stepIdx,
      distToNextTurn: distToNext,
      elapsedDistance: traveled,
      speedKmh: Math.max(0, speed),
      remainDist: remaining,
      remainTimeSeconds: remainingTime,
      eta: etaText,
      currentInstruction: directions[stepIdx] || null,
      nextInstruction: directions[stepIdx + 1] || null,
    });
  }, [polyline, totalDistance, totalDuration, directionCumulative, directions, onPositionUpdate]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (navMode === 'sim') {
      setIsTracking(true);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported in this browser.');
      return;
    }
    if (watchIdRef.current != null) return;

    setGpsError('');
    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateNavigationState(position.coords);
        setIsTracking(true);
      },
      (error) => {
        if (error.code === 1) {
          setGpsError('Location permission denied. Please allow GPS access.');
        } else if (error.code === 2) {
          setGpsError('Unable to read current location.');
        } else if (error.code === 3) {
          setGpsError('Location request timed out.');
        } else {
          setGpsError('GPS update failed.');
        }
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );

    watchIdRef.current = id;
  }, [updateNavigationState, navMode]);

  // ── Simulation Ticker ──
  useEffect(() => {
    if (navMode !== 'sim' || !isTracking || !polyline) return;

    const interval = setInterval(() => {
      setSimDist((prev) => {
        const next = prev + (40 / 3.6); // 40 km/h in m/s
        if (next >= polyline.total) {
          clearInterval(interval);
          return polyline.total;
        }

        // Interpolate position
        let target = next;
        let found = false;
        for (const segment of polyline.segments) {
          if (target >= segment.cumulativeStart && target <= segment.cumulativeStart + segment.length) {
            const segmentT = segment.length > 0 ? (target - segment.cumulativeStart) / segment.length : 0;
            const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * segmentT;
            const lon = segment.start.lon + (segment.end.lon - segment.start.lon) * segmentT;
            updateNavigationState({ latitude: lat, longitude: lon, speed: 11.1 }); // 40kmh
            found = true;
            break;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navMode, isTracking, polyline, updateNavigationState]);

  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [startTracking, stopTracking]);

  useEffect(() => {
    if (isMuted || !isTracking || !directions[currentStepIdx]) return;
    if (currentStepIdx === lastSpokenStepRef.current) return;

    lastSpokenStepRef.current = currentStepIdx;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(directions[currentStepIdx].instruction || 'Continue on route');
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    }
  }, [currentStepIdx, directions, isMuted, isTracking]);

  const currentStep = directions[currentStepIdx];
  const nextStep = directions[currentStepIdx + 1];

  if (!route?.geometry?.coordinates || route.geometry.coordinates.length < 2) {
    return (
      <div style={{ padding: 16, color: 'var(--text-dim)' }}>
        No route geometry available for navigation.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: 14,
          background: 'rgba(24, 76, 149, 0.9)',
          color: '#fff',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Navigation style={{ width: 18, height: 18 }} />
            <div style={{ fontSize: 13, display: 'flex', borderRadius: 6, background: 'rgba(0,0,0,0.2)', padding: 2 }}>
              <button 
                onClick={() => { stopTracking(); setNavMode('sim'); setSimDist(0); }}
                style={{ 
                  padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: navMode === 'sim' ? '#fff' : 'transparent', color: navMode === 'sim' ? '#111' : '#fff'
                }}>Simulate</button>
              <button 
                onClick={() => { stopTracking(); setNavMode('live'); }}
                style={{ 
                  padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: navMode === 'live' ? '#fff' : 'transparent', color: navMode === 'live' ? '#111' : '#fff'
                }}>Live GPS</button>
            </div>
          </div>
          <button
            onClick={() => {
              stopTracking();
              onClose?.();
            }}
            title="Close navigation"
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: 8,
              width: 30,
              height: 30,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ fontWeight: 600 }}>{currentStep?.instruction || 'Waiting for GPS update...'}</div>
          <div style={{ opacity: 0.9, marginTop: 4 }}>
            Next turn in {fmtDist(distanceToTurn)}
          </div>
          {nextStep && (
            <div style={{ marginTop: 3, opacity: 0.85, fontSize: 12 }}>Then: {nextStep.instruction}</div>
          )}
        </div>
      </div>

      {gpsError && (
        <div
          style={{
            margin: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          <AlertTriangle style={{ width: 14, height: 14 }} />
          <span>{gpsError}</span>
        </div>
      )}

      <div style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Remaining</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtDist(remainDistance)}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ETA</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtTime(remainTimeSeconds)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{eta}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Speed</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{speedKmh} km/h</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Traveled</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmtDist(elapsedDistance)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(progress * 100)}%</div>
        </div>
      </div>

      <div style={{ padding: '0 10px 10px', display: 'flex', gap: 8 }}>
        {isTracking ? (
          <button
            onClick={stopTracking}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 8,
              padding: '10px 12px',
              background: '#f59e0b',
              color: '#111827',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Pause style={{ width: 16, height: 16 }} /> Pause GPS
          </button>
        ) : (
          <button
            onClick={startTracking}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 8,
              padding: '10px 12px',
              background: '#22c55e',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Play style={{ width: 16, height: 16 }} /> Start GPS
          </button>
        )}

        <button
          onClick={() => {
            setIsMuted((prev) => !prev);
            if (!isMuted && typeof window !== 'undefined' && window.speechSynthesis) {
              window.speechSynthesis.cancel();
            }
          }}
          title={isMuted ? 'Unmute voice' : 'Mute voice'}
          style={{
            width: 42,
            border: 'none',
            borderRadius: 8,
            background: 'var(--panel-alt)',
            color: isMuted ? '#f87171' : 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isMuted ? <VolumeX style={{ width: 16, height: 16 }} /> : <Volume2 style={{ width: 16, height: 16 }} />}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
          Upcoming steps
        </div>
        {directions.slice(currentStepIdx).map((step, idx) => (
          <div
            key={`${step.instruction}-${idx}`}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              opacity: idx === 0 ? 1 : 0.7,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{step.instruction}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDist(step.distance)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}