import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRoute } from '../../context/RouteContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function dot(color, label = '') {
  return L.divIcon({
    className: '',
    html: `<div style="width:${label?24:18}px;height:${label?24:18}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:${label?10:0}px;font-weight:700;">${label}</span></div>`,
    iconSize: [label?24:18, label?24:18],
    iconAnchor: [label?12:9, label?24:18],
    popupAnchor: [0, -24],
  });
}

const COLORS = ['#34a853', '#4285f4', '#fbbc04', '#ea4335', '#8b5cf6'];

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length >= 2) {
      try { map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true }); } catch {}
    }
  }, [JSON.stringify(bounds)]);
  return null;
}

export default function MapView({ stops = [], multiResult }) {
  const { state, dispatch } = useRoute();

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

  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: '100%', height: '100%' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OSM &copy; CARTO' />
      <FitBounds bounds={allBounds} />

      {/* Route lines */}
      {state.routes.slice().sort((a, b) => (a.index === state.selectedRouteIndex ? 1 : -1)).map(route => {
        if (!route.geometry?.coordinates) return null;
        const pos = route.geometry.coordinates.map(c => [c[1], c[0]]);
        const sel = route.index === state.selectedRouteIndex;
        return (
          <Polyline key={route.index} positions={pos}
            pathOptions={{ color: sel ? '#4285f4' : '#888', weight: sel ? 5 : 3, opacity: sel ? 1 : 0.4, dashArray: sel ? null : '6,6' }}
            eventHandlers={{ click: () => dispatch({ type: 'SELECT_ROUTE', payload: route.index }) }}>
            <Popup><div style={{ color: '#e4e6ed', fontSize: 12 }}>
              <b>{route.summary}</b>{route.isBest && <span style={{ color: '#34a853' }}> ★ Best</span>}<br />
              📏 {(route.distance/1000).toFixed(1)} km · ⏱ {Math.round(route.duration/60)} min · 💰 ₹{route.estimatedCost}
            </div></Popup>
          </Polyline>
        );
      })}

      {/* Source */}
      {state.source && (
        <Marker position={[state.source.lat, state.source.lon]} icon={dot('#34a853', 'S')}>
          <Popup><div style={{ color: '#e4e6ed' }}><b>Start</b><br />{state.source.name}</div></Popup>
        </Marker>
      )}

      {/* Destination */}
      {state.destination && (
        <Marker position={[state.destination.lat, state.destination.lon]} icon={dot('#ea4335', 'E')}>
          <Popup><div style={{ color: '#e4e6ed' }}><b>End</b><br />{state.destination.name}</div></Popup>
        </Marker>
      )}

      {/* Intermediate stops (numbered) */}
      {stops.map((s, i) => (
        <Marker key={i} position={[s.lat, s.lon]} icon={dot('#fbbc04', `${i+1}`)}>
          <Popup><div style={{ color: '#e4e6ed' }}><b>Stop {i+1}</b><br />{s.name}</div></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
