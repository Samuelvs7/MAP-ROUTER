import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRoute } from '../../context/RouteContext';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createDot(color, label = '') {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${label ? 26 : 22}px;height:${label ? 26 : 22}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:white;font-size:${label ? 10 : 0}px;font-weight:700">${label}</span></div>`,
    iconSize: [label ? 26 : 22, label ? 26 : 22],
    iconAnchor: [label ? 13 : 11, label ? 26 : 22],
    popupAnchor: [0, -26],
  });
}

const ROUTE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#8b5cf6'];

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length >= 2) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.6 }); } catch {}
    }
  }, [bounds, map]);
  return null;
}

export default function MapView({ deliveryStops = [], deliveryResult }) {
  const { state, dispatch } = useRoute();

  const allBounds = useMemo(() => {
    const pts = [];
    if (state.source) pts.push([state.source.lat, state.source.lon]);
    if (state.destination) pts.push([state.destination.lat, state.destination.lon]);
    deliveryStops.forEach(s => { if (s.lat) pts.push([s.lat, s.lon]); });
    state.routes.forEach(r => {
      if (r.geometry?.coordinates) r.geometry.coordinates.forEach(c => pts.push([c[1], c[0]]));
    });
    return pts.length >= 2 ? pts : null;
  }, [state.source, state.destination, state.routes, deliveryStops]);

  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} className="w-full h-full" style={{ background: '#1a1a2e' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' />
      <FitBounds bounds={allBounds} />

      {/* Route Polylines */}
      {state.routes
        .slice().sort((a, b) => (a.index === state.selectedRouteIndex ? 1 : -1))
        .map((route) => {
          if (!route.geometry?.coordinates) return null;
          const positions = route.geometry.coordinates.map(c => [c[1], c[0]]);
          const isSelected = route.index === state.selectedRouteIndex;
          const color = isSelected ? '#10b981' : ROUTE_COLORS[Math.min(route.index, 3)];
          return (
            <Polyline key={route.index} positions={positions}
              pathOptions={{
                color, weight: isSelected ? 5 : 3,
                opacity: isSelected ? 1 : 0.5,
                dashArray: isSelected ? null : '8, 6',
              }}
              eventHandlers={{ click: () => dispatch({ type: 'SELECT_ROUTE', payload: route.index }) }}>
              <Popup>
                <div style={{ color: '#e2e8f0', fontSize: '12px', lineHeight: '1.5' }}>
                  <strong>{route.summary}</strong>
                  {route.isBest && <span style={{ color: '#10b981' }}> ★ Best</span>}
                  <br />📏 {(route.distance / 1000).toFixed(1)} km
                  <br />⏱️ {Math.round((route.adjustedDuration || route.duration) / 60)} min
                  <br />💰 ₹{route.estimatedCost}
                </div>
              </Popup>
            </Polyline>
          );
        })}

      {/* Source Marker */}
      {state.source && (
        <Marker position={[state.source.lat, state.source.lon]} icon={createDot('#10b981', 'S')}>
          <Popup><div style={{ color: '#e2e8f0' }}><strong>📍 Start</strong><br />{state.source.name}</div></Popup>
        </Marker>
      )}

      {/* Destination Marker */}
      {state.destination && (
        <Marker position={[state.destination.lat, state.destination.lon]} icon={createDot('#f43f5e', 'E')}>
          <Popup><div style={{ color: '#e2e8f0' }}><strong>🏁 End</strong><br />{state.destination.name}</div></Popup>
        </Marker>
      )}

      {/* Delivery Stop Markers (numbered) */}
      {deliveryStops.map((stop, i) => (
        stop.lat && (
          <Marker key={i} position={[stop.lat, stop.lon]} icon={createDot('#f59e0b', `${i + 1}`)}>
            <Popup><div style={{ color: '#e2e8f0' }}>
              <strong>📦 Stop {i + 1}</strong><br />{stop.name}
              {deliveryResult?.optimizedSequence && (
                <><br /><span style={{ color: '#10b981' }}>
                  Optimized order: #{deliveryResult.optimizedSequence.findIndex(s => Math.abs(s.lat - stop.lat) < 0.001 && Math.abs(s.lon - stop.lon) < 0.001) + 1}
                </span></>
              )}
            </div></Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
}
