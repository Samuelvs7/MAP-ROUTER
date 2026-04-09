import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRoute } from '../../context/RouteContext';

// Fix default marker icons for Leaflet in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom colored markers
function createIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: ${color}; transform: rotate(-45deg);
      border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    "><div style="
      width: 8px; height: 8px; border-radius: 50%;
      background: white; transform: rotate(45deg);
    "></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

const sourceIcon = createIcon('#10b981');    // Green
const destIcon = createIcon('#f43f5e');      // Rose
const waypointIcon = createIcon('#f59e0b');  // Amber

// Route colors
const ROUTE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
const ROUTE_STYLES = [
  { weight: 5, opacity: 0.9, dashArray: null },      // Best: solid thick
  { weight: 4, opacity: 0.6, dashArray: '12, 8' },   // Alt 1: dashed
  { weight: 3, opacity: 0.5, dashArray: '6, 10' },   // Alt 2: dotted
  { weight: 3, opacity: 0.4, dashArray: '4, 12' },   // Alt 3
];

// Component to handle map bounds fitting
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 0.8 });
      } catch (e) { /* bounds invalid */ }
    }
  }, [bounds, map]);
  return null;
}

// Component to highlight selected route
function SelectedRouteHighlight() {
  const { state } = useRoute();
  const map = useMap();

  useEffect(() => {
    if (state.selectedRouteIndex !== null && state.routes.length > 0) {
      const route = state.routes.find(r => r.index === state.selectedRouteIndex);
      if (route?.geometry?.coordinates) {
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        try {
          map.fitBounds(coords, { padding: [60, 60], maxZoom: 14, animate: true, duration: 0.5 });
        } catch { /* */ }
      }
    }
  }, [state.selectedRouteIndex]);

  return null;
}

export default function MapView() {
  const { state, dispatch } = useRoute();
  const defaultCenter = [20.5937, 78.9629]; // India center
  const defaultZoom = 5;

  // Compute bounds from all route data
  const allBounds = useMemo(() => {
    const points = [];
    if (state.source) points.push([state.source.lat, state.source.lon]);
    if (state.destination) points.push([state.destination.lat, state.destination.lon]);
    state.routes.forEach(r => {
      if (r.geometry?.coordinates) {
        r.geometry.coordinates.forEach(c => points.push([c[1], c[0]]));
      }
    });
    return points.length >= 2 ? points : null;
  }, [state.source, state.destination, state.routes]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="w-full h-full"
      style={{ minHeight: '500px', borderRadius: '16px' }}
      zoomControl={true}
    >
      {/* Dark themed map tiles */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      <FitBounds bounds={allBounds} />
      <SelectedRouteHighlight />

      {/* Route Polylines — render non-selected first, then selected on top */}
      {state.routes
        .sort((a, b) => {
          if (a.index === state.selectedRouteIndex) return 1;  // selected last = on top
          if (b.index === state.selectedRouteIndex) return -1;
          return a.isBest ? 1 : -1;
        })
        .map((route, renderIdx) => {
          if (!route.geometry?.coordinates) return null;
          const positions = route.geometry.coordinates.map(c => [c[1], c[0]]);
          const isSelected = route.index === state.selectedRouteIndex;
          const isBest = route.isBest;
          const styleIdx = isBest ? 0 : Math.min(route.rank || renderIdx, ROUTE_STYLES.length - 1);
          const color = isSelected ? ROUTE_COLORS[0] : ROUTE_COLORS[Math.min(route.index, ROUTE_COLORS.length - 1)];

          return (
            <Polyline
              key={route.index}
              positions={positions}
              pathOptions={{
                color: isSelected ? '#10b981' : color,
                weight: isSelected ? 6 : ROUTE_STYLES[styleIdx]?.weight || 3,
                opacity: isSelected ? 1 : ROUTE_STYLES[styleIdx]?.opacity || 0.5,
                dashArray: isSelected ? null : ROUTE_STYLES[styleIdx]?.dashArray,
              }}
              eventHandlers={{
                click: () => dispatch({ type: 'SELECT_ROUTE', payload: route.index }),
              }}
            >
              <Popup>
                <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                  <strong>{route.summary || `Route ${route.index + 1}`}</strong>
                  {route.isBest && <span style={{ color: '#10b981', marginLeft: '6px' }}>★ Best</span>}
                  <br />
                  📏 {(route.distance / 1000).toFixed(1)} km &nbsp;
                  ⏱️ {Math.round((route.adjustedDuration || route.duration) / 60)} min &nbsp;
                  💰 ₹{route.estimatedCost}
                  <br />
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Score: {route.score}</span>
                </div>
              </Popup>
            </Polyline>
          );
        })}

      {/* Source Marker */}
      {state.source && (
        <Marker position={[state.source.lat, state.source.lon]} icon={sourceIcon}>
          <Popup>
            <div style={{ color: '#e2e8f0' }}>
              <strong>📍 Source</strong><br />{state.source.name}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Destination Marker */}
      {state.destination && (
        <Marker position={[state.destination.lat, state.destination.lon]} icon={destIcon}>
          <Popup>
            <div style={{ color: '#e2e8f0' }}>
              <strong>🏁 Destination</strong><br />{state.destination.name}
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
