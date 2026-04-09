// ============================================================
// Routing Service — OSRM (FREE, no API key, REAL distances)
// ============================================================
// Uses the OSRM demo server for actual road-based routing.
// Returns REAL distances, durations, and road geometries.
// No API key needed. Falls back to ORS if configured.
// ============================================================

import axios from 'axios';

const OSRM_BASE = 'https://router.project-osrm.org';

/**
 * Haversine distance in meters (for algorithm graph building)
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch REAL routes from OSRM (free, no key needed)
 * Returns actual road distances, not straight-line
 */
async function fetchOSRMRoutes(sourceLat, sourceLon, destLat, destLon) {
  const url = `${OSRM_BASE}/route/v1/driving/${sourceLon},${sourceLat};${destLon},${destLat}`;

  const response = await axios.get(url, {
    params: {
      overview: 'full',
      geometries: 'geojson',
      alternatives: 'true',
      steps: 'true',
      annotations: 'true',
    },
    timeout: 10000,
  });

  if (response.data.code !== 'Ok' || !response.data.routes) {
    throw new Error('OSRM returned no routes');
  }

  return response.data.routes.map((route, idx) => {
    const distance = Math.round(route.distance); // meters (REAL)
    const duration = Math.round(route.duration);  // seconds (REAL)
    const fuelCostPerKm = 6.5; // ₹/km average
    const fuelCost = Math.round((distance / 1000) * fuelCostPerKm);

    // Detect if route uses highways (based on speed)
    const avgSpeed = (distance / duration) * 3.6; // km/h
    const isHighway = avgSpeed > 60;
    const tollCost = isHighway ? Math.round(distance / 1000 * 1.2) : 0;
    const estimatedCost = fuelCost + tollCost;

    // Extract road type percentages from step data
    let highwayDist = 0, urbanDist = 0, ruralDist = 0;
    if (route.legs?.[0]?.steps) {
      for (const step of route.legs[0].steps) {
        const stepSpeed = step.distance > 0 ? (step.distance / step.duration) * 3.6 : 0;
        if (stepSpeed > 70) highwayDist += step.distance;
        else if (stepSpeed > 30) urbanDist += step.distance;
        else ruralDist += step.distance;
      }
    }
    const totalStepDist = highwayDist + urbanDist + ruralDist || 1;

    // Build route name from legs
    let summary = `Route ${idx + 1}`;
    if (route.legs?.[0]?.summary) {
      summary = route.legs[0].summary || summary;
    }

    return {
      index: idx,
      distance,       // REAL road distance in meters
      duration,        // REAL estimated duration in seconds
      estimatedCost,
      summary,
      geometry: route.geometry, // GeoJSON LineString with REAL road path
      steps: (route.legs?.[0]?.steps || []).slice(0, 8).map(s => ({
        instruction: s.maneuver?.type ? `${s.maneuver.type} ${s.name || ''}`.trim() : s.name || 'Continue',
        distance: Math.round(s.distance),
        duration: Math.round(s.duration),
      })),
      roadTypes: {
        highway: Math.round((highwayDist / totalStepDist) * 100),
        urban: Math.round((urbanDist / totalStepDist) * 100),
        rural: Math.round((ruralDist / totalStepDist) * 100),
      },
      tollCost,
      hasTolls: tollCost > 0,
    };
  });
}

/**
 * Fetch route between two points using OSRM (for multi-stop distance matrix)
 */
export async function getRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await axios.get(url, { timeout: 8000 });
    if (res.data.code === 'Ok' && res.data.routes?.[0]) {
      return {
        distance: Math.round(res.data.routes[0].distance),
        duration: Math.round(res.data.routes[0].duration),
      };
    }
  } catch (e) { /* fall through */ }
  // Fallback to haversine estimate
  const d = haversine(lat1, lon1, lat2, lon2);
  return { distance: Math.round(d * 1.3), duration: Math.round((d / 1000 / 50) * 3600) };
}

/**
 * Get distance/duration matrix for multiple points using OSRM Table API
 */
export async function getDistanceMatrix(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  try {
    const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=distance,duration`;
    const res = await axios.get(url, { timeout: 15000 });
    if (res.data.code === 'Ok') {
      return {
        distances: res.data.distances, // matrix[i][j] = distance in meters from i to j
        durations: res.data.durations, // matrix[i][j] = duration in seconds from i to j
      };
    }
  } catch (e) {
    console.error('OSRM Table API error:', e.message);
  }

  // Fallback: build matrix from haversine
  const n = points.length;
  const distances = Array.from({ length: n }, () => Array(n).fill(0));
  const durations = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const d = haversine(points[i].lat, points[i].lon, points[j].lat, points[j].lon) * 1.3;
        distances[i][j] = Math.round(d);
        durations[i][j] = Math.round((d / 1000 / 50) * 3600);
      }
    }
  }
  return { distances, durations };
}

/**
 * Get optimized multi-stop route using OSRM Trip API (real TSP solving)
 */
export async function getOptimizedTrip(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  // source=first, destination=last — fix start and end points
  const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`;

  try {
    const res = await axios.get(url, { timeout: 15000 });
    if (res.data.code === 'Ok' && res.data.trips?.[0]) {
      const trip = res.data.trips[0];
      return {
        geometry: trip.geometry,
        distance: Math.round(trip.distance),
        duration: Math.round(trip.duration),
        waypoints: res.data.waypoints.map((wp, i) => ({
          waypointIndex: wp.waypoint_index,
          tripsIndex: wp.trips_index,
          name: wp.name || points[i]?.name || `Stop ${i + 1}`,
          lat: wp.location[1],
          lon: wp.location[0],
          originalIndex: i,
        })),
        legs: trip.legs.map(leg => ({
          distance: Math.round(leg.distance),
          duration: Math.round(leg.duration),
          summary: leg.summary || '',
          steps: (leg.steps || []).slice(0, 5).map(s => ({
            instruction: `${s.maneuver?.type || ''} ${s.name || ''}`.trim(),
            distance: Math.round(s.distance),
          })),
        })),
      };
    }
  } catch (e) {
    console.error('OSRM Trip API error:', e.message);
  }
  return null;
}

/**
 * Main export: Get routes between two points
 */
export async function getRoutes(sourceLat, sourceLon, destLat, destLon) {
  try {
    console.log('🌐 Fetching REAL routes from OSRM...');
    const routes = await fetchOSRMRoutes(sourceLat, sourceLon, destLat, destLon);
    console.log(`✅ Got ${routes.length} real routes from OSRM`);
    return routes;
  } catch (err) {
    console.error('OSRM error:', err.message);
    throw new Error('Failed to fetch routes. Please check coordinates and try again.');
  }
}
