import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useRoute } from '../../context/RouteContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ══════════════════════════════════════════════
   CUSTOM ICONS
   ══════════════════════════════════════════════ */
function dot(color, label = '') {
  return L.divIcon({
    className: '',
    html: `<div style="width:${label?26:18}px;height:${label?26:18}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:${label?11:0}px;font-weight:700;">${label}</span></div>`,
    iconSize: [label?26:18, label?26:18],
    iconAnchor: [label?13:9, label?26:18],
    popupAnchor: [0, -26],
  });
}

function navArrow(bearing = 0) {
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="width:20px;height:20px;background:#4285f4;border-radius:50%;border:3px solid #fff;
        box-shadow:0 0 12px rgba(66,133,244,0.6), 0 2px 8px rgba(0,0,0,0.4);position:relative;">
        <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%) rotate(${bearing}deg);
          width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
          border-bottom:10px solid #4285f4;filter:drop-shadow(0 0 2px rgba(66,133,244,0.8));"></div>
      </div>
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;border:2px solid rgba(66,133,244,0.3);
        animation:navPulse 2s infinite;"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Dropped pin icon (for click-on-map)
function droppedPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#6366f1;
        transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(99,102,241,0.5);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:12px;">📍</span>
      </div>
      <div style="width:2px;height:6px;background:rgba(99,102,241,0.4);margin-top:-2px;"></div>
    </div>`,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
  });
}

// GPS user location icon
function gpsIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:#4285f4;border-radius:50%;border:3px solid #fff;
      box-shadow:0 0 0 2px rgba(66,133,244,0.3), 0 0 16px rgba(66,133,244,0.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* ══════════════════════════════════════════════
   MAP TILE LAYERS
   ══════════════════════════════════════════════ */
const MAP_LAYERS = {
  standard: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    label: '🗺️ Map',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    label: '🌙 Dark',
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite',
    label: '🛰️ Satellite',
  },
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Hybrid',
    label: '🏙️ Hybrid',
  },
};

const COLORS = ['#34a853', '#4285f4', '#fbbc04', '#ea4335', '#8b5cf6'];

/* ══════════════════════════════════════════════
   MAP SUB-COMPONENTS
   ══════════════════════════════════════════════ */
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length >= 2) {
      try { map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 0.8 }); } catch {}
    }
  }, [JSON.stringify(bounds)]);
  return null;
}

function FollowMarker({ position, isFollowing }) {
  const map = useMap();
  useEffect(() => {
    if (position && isFollowing) {
      map.setView([position.lat, position.lon], 16, { animate: true, duration: 0.3 });
    }
  }, [position, isFollowing, map]);
  return null;
}

/* ── Map Click / Right-Click Handler ── */
function MapInteractionHandler({ onMapClick, onMapRightClick, onMapInteract }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onMapRightClick(e.latlng, e.containerPoint);
    },
    dragstart() {
      if (onMapInteract) onMapInteract();
    },
    zoomstart() {
      if (onMapInteract) onMapInteract();
    }
  });
  return null;
}

/* ── Context Menu Component ── */
function ContextMenu({ position, latlng, address, loading, onDirectionsFrom, onDirectionsTo, onAddStop, onClose }) {
  const map = useMap();
  
  useEffect(() => {
    const handleClick = () => onClose();
    const handleMove = () => onClose();
    map.on('movestart', handleMove);
    document.addEventListener('click', handleClick, { once: true, capture: true });
    return () => {
      map.off('movestart', handleMove);
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [map, onClose]);

  if (!position) return null;

  const menuStyle = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    zIndex: 1000,
    background: 'rgba(26, 29, 39, 0.97)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 12,
    padding: '4px 0',
    minWidth: 220,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
    animation: 'ctxMenuIn 0.15s ease-out',
  };

  const itemStyle = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    fontSize: 13, color: '#e4e6ed', cursor: 'pointer', border: 'none',
    background: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit',
    transition: 'background 0.15s',
  };

  const coordStr = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;

  return (
    <div style={menuStyle} className="map-context-menu" onClick={(e) => e.stopPropagation()}>
      {/* Address / Coords header */}
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e6ed', lineHeight: 1.3, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? '⏳ Looking up...' : address || coordStr}
        </div>
        <div style={{ fontSize: 10, color: '#5c6078', marginTop: 2 }}>{coordStr}</div>
      </div>

      <button style={itemStyle} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(66,133,244,0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        onClick={() => { onDirectionsFrom(); onClose(); }}>
        <span style={{ fontSize: 16 }}>🟢</span> Directions from here
      </button>

      <button style={itemStyle} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(234,67,53,0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        onClick={() => { onDirectionsTo(); onClose(); }}>
        <span style={{ fontSize: 16 }}>🔴</span> Directions to here
      </button>

      <button style={itemStyle} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(251,188,4,0.15)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        onClick={() => { onAddStop(); onClose(); }}>
        <span style={{ fontSize: 16 }}>🟡</span> Add as stop
      </button>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />

      <button style={{ ...itemStyle, fontSize: 12, color: '#8b8fa3' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        onClick={() => { navigator.clipboard.writeText(coordStr); onClose(); }}>
        <span style={{ fontSize: 14 }}>📋</span> Copy coordinates
      </button>
    </div>
  );
}

/* ── Locate Me Button ── */
function LocateMeButton({ onLocate, locating }) {
  return (
    <button
      onClick={onLocate}
      className="map-floating-btn"
      title="My Location"
      style={{
        position: 'absolute', bottom: 100, right: 12, zIndex: 800,
        width: 42, height: 42, borderRadius: '50%',
        background: 'rgba(26,29,39,0.92)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
        color: locating ? '#4285f4' : '#8b8fa3',
      }}
    >
      {locating ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      )}
    </button>
  );
}

/* ── Map Layer Switcher ── */
function LayerSwitcher({ current, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'absolute', bottom: 152, right: 12, zIndex: 800 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 50, right: 0,
          background: 'rgba(26,29,39,0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'ctxMenuIn 0.15s ease-out', minWidth: 130,
        }}>
          {Object.entries(MAP_LAYERS).map(([key, layer]) => (
            <button key={key} onClick={() => { onChange(key); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, border: 'none',
                background: current === key ? 'rgba(66,133,244,0.15)' : 'none',
                color: current === key ? '#4285f4' : '#e4e6ed',
                fontSize: 12, fontWeight: current === key ? 600 : 400,
                cursor: 'pointer', width: '100%', textAlign: 'left',
                fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (current !== key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (current !== key) e.currentTarget.style.background = 'none'; }}
            >
              {layer.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="map-floating-btn"
        title="Map layers"
        style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'rgba(26,29,39,0.92)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', color: '#8b8fa3',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 22 8.5 12 15 2 8.5" /><polyline points="2 15.5 12 22 22 15.5" />
        </svg>
      </button>
    </div>
  );
}

// ── Geospatial Haversine Utility ──
function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* ══════════════════════════════════════════════
   MAIN MAP VIEW COMPONENT
   ══════════════════════════════════════════════ */
export default function MapView({
  stops = [], multiResult, navPosition, navigating,
  onMapSetSource, onMapSetDestination, onMapAddStop,
  onDragSource, onDragDestination, onDragStop,
  userLocation,
}) {
  const { state, dispatch } = useRoute();
  const [mapLayer, setMapLayer] = useState('standard');
  const [locating, setLocating] = useState(false);
  const [droppedPin, setDroppedPin] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [ctxAddress, setCtxAddress] = useState('');
  const [ctxLoading, setCtxLoading] = useState(false);
  const mapRef = useRef(null);

  // ── Pro Navigation State ──
  const [isFollowing, setIsFollowing] = useState(true);
  const [is3DMode, setIs3DMode] = useState(true);

  // Auto-reset navigation features when it starts/stops
  useEffect(() => {
    if (navigating) {
      setIsFollowing(true);
      setIs3DMode(true);
    }
  }, [navigating]);

  // ── Compute bounds ──
  const allBounds = useMemo(() => {
    const pts = [];
    if (state.source) pts.push([state.source.lat, state.source.lon]);
    if (state.destination) pts.push([state.destination.lat, state.destination.lon]);
    stops.forEach(s => pts.push([s.lat, s.lon]));
    state.routes.forEach(r => {
      if (r.geometry?.coordinates) r.geometry.coordinates.forEach(c => pts.push([c[1], c[0]]));
    });
    return pts.length >= 2 ? pts : null;
  }, [state.source, state.destination, state.routes, stops]);

  // ── Traffic Segmentation Logic ──
  const segmentedRoutes = useMemo(() => {
    if (!state.routes.length) return [];
    
    return state.routes.map(r => {
      if (!r.geometry?.coordinates) return { ...r, segments: [] };
      const coords = r.geometry.coordinates.map(c => [c[1], c[0]]); // [lat, lon]
      
      // If not the selected route, just return one grey segment
      if (r.index !== state.selectedRouteIndex) {
        return { ...r, segments: [{ pos: coords, color: '#666' }] };
      }

      // Selected Route: Segment it based on traffic zones
      const zones = state.trafficZones || [];
      if (zones.length === 0) {
         return { ...r, segments: [{ pos: coords, color: '#4285f4' }] };
      }

      const TRAFFIC_COLORS = { heavy: '#ea4335', moderate: '#fbbc04', light: '#34a853', clear: '#4285f4' };
      
      const segments = [];
      let currentChunk = [coords[0]];
      let currentColor = '#4285f4';

      for (let i = 1; i < coords.length; i++) {
        const p1 = coords[i - 1];
        const p2 = coords[i];
        const midLat = (p1[0] + p2[0]) / 2;
        const midLon = (p1[1] + p2[1]) / 2;

        let segColor = '#4285f4'; // default
        let maxDelay = 1;

        for (const zone of zones) {
           const dist = getDistanceKM(midLat, midLon, zone.lat, zone.lon);
           if (dist <= zone.radiusKm) {
              if (zone.delayMultiplier > maxDelay) {
                 maxDelay = zone.delayMultiplier;
                 segColor = TRAFFIC_COLORS[zone.congestionLevel] || '#ea4335';
              }
           }
        }

        if (segColor === currentColor) {
           currentChunk.push(p2);
        } else {
           segments.push({ pos: currentChunk, color: currentColor });
           // Start new chunk with the last point to ensure visual connectivity
           currentChunk = [p1, p2];  
           currentColor = segColor;
        }
      }
      if (currentChunk.length > 0) {
        segments.push({ pos: currentChunk, color: currentColor });
      }

      return { ...r, segments };
    });
  }, [state.routes, state.selectedRouteIndex, state.trafficZones]);

  // ── Reverse geocode helper ──
  const reverseGeocode = useCallback(async (lat, lon) => {
    try {
      const resp = await fetch(`/api/routes/reverse-geocode?lat=${lat}&lon=${lon}`);
      const data = await resp.json();
      return data.result || { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    } catch {
      return { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    }
  }, []);

  // ── Map Click: drop a temporary pin ──
  const handleMapClick = useCallback((latlng) => {
    // Close context menu if open
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    setDroppedPin({ lat: latlng.lat, lon: latlng.lng });
  }, [contextMenu]);

  // ── Map Right-Click: show context menu ──
  const handleMapRightClick = useCallback(async (latlng, containerPoint) => {
    setDroppedPin(null);
    setCtxAddress('');
    setCtxLoading(true);
    setContextMenu({ position: containerPoint, latlng });

    // Reverse geocode in background
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    setCtxAddress(result.name || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    setCtxLoading(false);
  }, [reverseGeocode]);

  // ── Context Menu Actions ──
  const handleDirectionsFrom = useCallback(async () => {
    if (!contextMenu) return;
    const { latlng } = contextMenu;
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    if (onMapSetSource) onMapSetSource({ ...result, lat: latlng.lat, lon: latlng.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapSetSource]);

  const handleDirectionsTo = useCallback(async () => {
    if (!contextMenu) return;
    const { latlng } = contextMenu;
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    if (onMapSetDestination) onMapSetDestination({ ...result, lat: latlng.lat, lon: latlng.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapSetDestination]);

  const handleAddStop = useCallback(async () => {
    if (!contextMenu) return;
    const { latlng } = contextMenu;
    const result = await reverseGeocode(latlng.lat, latlng.lng);
    if (onMapAddStop) onMapAddStop({ ...result, lat: latlng.lat, lon: latlng.lng });
    setDroppedPin(null);
  }, [contextMenu, reverseGeocode, onMapAddStop]);

  // ── GPS Locate Me ──
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const result = await reverseGeocode(latitude, longitude);
        if (onMapSetSource) onMapSetSource({ ...result, lat: latitude, lon: longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [reverseGeocode, onMapSetSource]);

  const currentLayer = MAP_LAYERS[mapLayer];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', perspective: '1200px', overflow: 'hidden' }}>
      <div style={{
        width: '100%', height: '100%',
        transition: 'transform 0.5s ease-in-out',
        transform: navigating && is3DMode 
          ? 'rotateX(55deg) scale(1.4) translateY(10%)' 
          : 'rotateX(0deg) scale(1) translateY(0%)',
        transformOrigin: 'bottom center',
        pointerEvents: navigating && is3DMode ? 'auto' : 'auto'
      }}>
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ width: '100%', height: '100%' }}
          ref={mapRef}
          zoomControl={false}
        >
          <TileLayer key={mapLayer} url={currentLayer.url} attribution={currentLayer.attribution} />

          {/* Zoom control in bottom-right */}
          <ZoomControl />

          {!navigating && <FitBounds bounds={allBounds} />}
          {navigating && navPosition && <FollowMarker position={navPosition} isFollowing={isFollowing} />}

          {/* Map interaction handler */}
          <MapInteractionHandler 
            onMapClick={handleMapClick} 
            onMapRightClick={handleMapRightClick} 
            onMapInteract={() => isFollowing && setIsFollowing(false)} 
          />

      {/* ── Route Polylines (Segmented with Traffic + White Border) ── */}
      {segmentedRoutes.slice().sort((a, b) => (a.index === state.selectedRouteIndex ? 1 : -1)).map((route) => {
        const sel = route.index === state.selectedRouteIndex;

        const PopupContent = () => (
          <Popup><div style={{ color: '#e4e6ed', fontSize: 12 }}>
            <b>{route.summary}</b>{route.isBest && <span style={{ color: '#34a853' }}> ★ Best</span>}<br />
            📏 {(route.distance/1000).toFixed(1)} km · ⏱ {Math.round(route.duration/60)} min · 💰 ₹{route.estimatedCost}
            {!sel && <div style={{ fontSize: 11, color: '#8ab4f8', marginTop: 4 }}>Click to select this route</div>}
          </div></Popup>
        );

        // Unselected route: classic gray
        if (!sel) {
          return (
            <Polyline key={`unsel_${route.index}`} positions={route.segments[0]?.pos || []}
              pathOptions={{ color: '#666', weight: 4, opacity: 0.5, dashArray: '8,6', lineCap: 'round', lineJoin: 'round' }}
              eventHandlers={{
                click: () => dispatch({ type: 'SELECT_ROUTE', payload: route.index }),
                mouseover: (e) => { e.target.setStyle({ color: '#8ab4f8', opacity: 0.7, weight: 5 }); },
                mouseout: (e) => { e.target.setStyle({ color: '#666', opacity: 0.5, weight: 4 }); },
              }}>
              <PopupContent />
            </Polyline>
          );
        }

        // ── Dynamic Array Slicing (Vanishing Trail) ──
        const fullCoords = route.segments.flatMap((req) => req.pos);
        let activeFullCoords = fullCoords;
        let activeSegments = route.segments;

        if (sel && navigating && navPosition && navPosition.progress > 0) {
           // We scale progress by length to roughly find the cutoff index
           const cutoffIdx = Math.floor(navPosition.progress * fullCoords.length);
           if (cutoffIdx > 0 && cutoffIdx < fullCoords.length) {
              activeFullCoords = fullCoords.slice(cutoffIdx);
              
              // Slice the grouped segments to avoid drawing them
              activeSegments = [];
              let currentRunningLen = 0;
              for (const seg of route.segments) {
                 const segLen = seg.pos.length;
                 if (currentRunningLen + segLen <= cutoffIdx) {
                    // Entire segment is passed, skip it
                    currentRunningLen += segLen;
                 } else if (currentRunningLen < cutoffIdx) {
                    // Segment overlaps cutoff, slice the segment to only show upcoming
                    activeSegments.push({ color: seg.color, pos: seg.pos.slice(cutoffIdx - currentRunningLen) });
                    currentRunningLen += segLen;
                 } else {
                    // Segment is entirely upcoming, keep it
                    activeSegments.push(seg);
                 }
              }
           }
        }

        const elements = [
          // Outline (Google style white base map stroke, only for upcoming)
          <Polyline key={`sel_bg_${route.index}`} positions={activeFullCoords}
            pathOptions={{ color: '#fff', weight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
        ];

        // Inner colored segments (Traffic, only upcoming)
        activeSegments.forEach((seg, idx) => {
          elements.push(
            <Polyline key={`seg_${route.index}_${idx}`} positions={seg.pos}
              pathOptions={{ color: seg.color, weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}>
              <PopupContent />
            </Polyline>
          );
        });

        return elements;
      })}

      {/* ── Source Marker (Draggable) ── */}
      {state.source && !navigating && (
        <Marker
          position={[state.source.lat, state.source.lon]}
          icon={dot('#34a853', 'S')}
          draggable={true}
          eventHandlers={{
            dragend: async (e) => {
              const { lat, lng } = e.target.getLatLng();
              const result = await reverseGeocode(lat, lng);
              if (onDragSource) onDragSource({ ...result, lat, lon: lng });
            },
          }}
        >
          <Popup><div style={{ color: '#e4e6ed' }}>
            <b>Start</b><br />{state.source.name}
            <div style={{ fontSize: 10, color: '#5c6078', marginTop: 4 }}>Drag to change start point</div>
          </div></Popup>
        </Marker>
      )}

      {/* ── Destination Marker (Draggable) ── */}
      {state.destination && (
        <Marker
          position={[state.destination.lat, state.destination.lon]}
          icon={dot('#ea4335', 'E')}
          draggable={true}
          eventHandlers={{
            dragend: async (e) => {
              const { lat, lng } = e.target.getLatLng();
              const result = await reverseGeocode(lat, lng);
              if (onDragDestination) onDragDestination({ ...result, lat, lon: lng });
            },
          }}
        >
          <Popup><div style={{ color: '#e4e6ed' }}>
            <b>End</b><br />{state.destination.name}
            <div style={{ fontSize: 10, color: '#5c6078', marginTop: 4 }}>Drag to change end point</div>
          </div></Popup>
        </Marker>
      )}

      {/* ── Intermediate Stop Markers (Draggable) ── */}
      {stops.map((s, i) => (
        <Marker
          key={i}
          position={[s.lat, s.lon]}
          icon={dot('#fbbc04', `${i+1}`)}
          draggable={true}
          eventHandlers={{
            dragend: async (e) => {
              const { lat, lng } = e.target.getLatLng();
              const result = await reverseGeocode(lat, lng);
              if (onDragStop) onDragStop(i, { ...result, lat, lon: lng });
            },
          }}
        >
          <Popup><div style={{ color: '#e4e6ed' }}>
            <b>Stop {i+1}</b><br />{s.name}
            <div style={{ fontSize: 10, color: '#5c6078', marginTop: 4 }}>Drag to reposition</div>
          </div></Popup>
        </Marker>
      ))}

      {/* ── Dropped pin (temporary) ── */}
      {droppedPin && !contextMenu && (
        <Marker position={[droppedPin.lat, droppedPin.lon]} icon={droppedPinIcon()}>
          <Popup><DroppedPinPopup lat={droppedPin.lat} lon={droppedPin.lon}
            onFrom={async () => {
              const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
              if (onMapSetSource) onMapSetSource({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
              setDroppedPin(null);
            }}
            onTo={async () => {
              const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
              if (onMapSetDestination) onMapSetDestination({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
              setDroppedPin(null);
            }}
            onStop={async () => {
              const result = await reverseGeocode(droppedPin.lat, droppedPin.lon);
              if (onMapAddStop) onMapAddStop({ ...result, lat: droppedPin.lat, lon: droppedPin.lon });
              setDroppedPin(null);
            }}
            onClose={() => setDroppedPin(null)}
          /></Popup>
        </Marker>
      )}

      {/* ── User GPS Location ── */}
      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lon]} icon={gpsIcon()} zIndexOffset={500} />
          <CircleMarker center={[userLocation.lat, userLocation.lon]} radius={30}
            pathOptions={{ color: '#4285f4', fillColor: '#4285f4', fillOpacity: 0.08, weight: 1, dashArray: '4,4' }} />
        </>
      )}

      {/* ── NAVIGATION MARKER ── */}
      {navigating && navPosition && (
        <>
          <Marker position={[navPosition.lat, navPosition.lon]} icon={navArrow(navPosition.bearing || 0)} zIndexOffset={1000} />
          <CircleMarker center={[navPosition.lat, navPosition.lon]} radius={12}
            pathOptions={{ color: '#4285f4', fillColor: '#4285f4', fillOpacity: 0.1, weight: 1 }} />
        </>
      )}

      {/* ── Context Menu Overlay ── */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          latlng={contextMenu.latlng}
          address={ctxAddress}
          loading={ctxLoading}
          onDirectionsFrom={handleDirectionsFrom}
          onDirectionsTo={handleDirectionsTo}
          onAddStop={handleAddStop}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Traffic Zones overlay completely removed per Google Maps design paradigm */}

      {/* ── Floating Controls ── */}
      <LocateMeButton onLocate={handleLocateMe} locating={locating} />
      <LayerSwitcher current={mapLayer} onChange={setMapLayer} />
        </MapContainer>
      </div>
      
      {/* ── Pro Navigation Overlay Buttons ── */}
      {navigating && (
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isFollowing && (
            <button 
              onClick={() => setIsFollowing(true)} 
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              style={{ padding: '10px 16px', background: '#4285f4', color: '#fff', borderRadius: '24px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              🎯 Re-center
            </button>
          )}
          <button 
            onClick={() => setIs3DMode(!is3DMode)} 
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(26,29,39,0.9)'}
            style={{ padding: '8px 12px', background: 'rgba(26,29,39,0.9)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
            {is3DMode ? '🗺️ 2D Mode' : '🛣️ 3D Mode'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Zoom control positioned at bottom-right ── */
function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const zoomControl = L.control.zoom({ position: 'bottomright' });
    zoomControl.addTo(map);
    return () => { try { zoomControl.remove(); } catch {} };
  }, [map]);
  return null;
}

/* ── Dropped Pin Popup Content ── */
function DroppedPinPopup({ lat, lon, onFrom, onTo, onStop, onClose }) {
  const [addr, setAddr] = useState('Loading...');
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`/api/routes/reverse-geocode?lat=${lat}&lon=${lon}`);
        const data = await resp.json();
        setAddr(data.result?.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        setAddr(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    })();
  }, [lat, lon]);

  const btnStyle = {
    padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, fontFamily: 'inherit', transition: 'opacity 0.15s',
    display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center',
  };

  return (
    <div style={{ color: '#e4e6ed', minWidth: 200 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{addr}</div>
      <div style={{ fontSize: 10, color: '#5c6078', marginBottom: 8 }}>{lat.toFixed(5)}, {lon.toFixed(5)}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button style={{ ...btnStyle, background: 'rgba(52,168,83,0.2)', color: '#34a853' }} onClick={onFrom}>
          🟢 From
        </button>
        <button style={{ ...btnStyle, background: 'rgba(234,67,53,0.2)', color: '#ea4335' }} onClick={onTo}>
          🔴 To
        </button>
        <button style={{ ...btnStyle, background: 'rgba(251,188,4,0.2)', color: '#fbbc04' }} onClick={onStop}>
          🟡 Stop
        </button>
      </div>
    </div>
  );
}
