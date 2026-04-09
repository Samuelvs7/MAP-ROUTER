// ============================================================
// Routing Service — OSRM (100% Real Data, No Mocks)
// ============================================================

import axios from 'axios';

const OSRM_BASE = 'https://router.project-osrm.org';

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Turn type to human-readable instruction
function formatInstruction(step) {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const name = step.name || step.ref || 'the road';
  const dist = step.distance;

  const dirMap = {
    'turn-left': '↰ Turn left',
    'turn-right': '↱ Turn right',
    'turn-sharp left': '↰ Sharp left',
    'turn-sharp right': '↱ Sharp right',
    'turn-slight left': '↰ Slight left',
    'turn-slight right': '↱ Slight right',
    'depart-': '🚗 Start',
    'arrive-': '🏁 Arrive',
    'merge-': '⤵ Merge',
    'fork-left': '↰ Keep left at fork',
    'fork-right': '↱ Keep right at fork',
    'roundabout-': '🔄 Roundabout',
    'new name-': '➡ Continue',
    'continue-': '➡ Continue',
  };

  const key = `${type}-${modifier}`;
  const prefix = dirMap[key] || dirMap[`${type}-`] || '➡ Continue';

  if (type === 'depart') return `🚗 Head ${modifier || 'forward'} on ${name}`;
  if (type === 'arrive') return `🏁 Arrive at destination`;
  return `${prefix} onto ${name}`;
}

/**
 * Fetch REAL routes with full turn-by-turn directions
 */
export async function getRoutes(sourceLat, sourceLon, destLat, destLon) {
  const url = `${OSRM_BASE}/route/v1/driving/${sourceLon},${sourceLat};${destLon},${destLat}`;

  const response = await axios.get(url, {
    params: { overview: 'full', geometries: 'geojson', alternatives: 'true', steps: 'true', annotations: 'duration,distance,speed' },
    timeout: 10000,
  });

  if (response.data.code !== 'Ok') throw new Error('OSRM: ' + (response.data.message || 'No routes'));

  return response.data.routes.map((route, idx) => {
    const distance = Math.round(route.distance);
    const duration = Math.round(route.duration);
    const fuelCost = Math.round((distance / 1000) * 6.5);
    const avgSpeed = (distance / duration) * 3.6;
    const tollCost = avgSpeed > 60 ? Math.round(distance / 1000 * 1.2) : 0;

    // Full turn-by-turn directions
    const directions = [];
    let cumDist = 0;
    let cumTime = 0;
    for (const leg of route.legs) {
      for (const step of (leg.steps || [])) {
        if (step.distance < 5 && step.maneuver?.type !== 'depart' && step.maneuver?.type !== 'arrive') continue;
        cumDist += step.distance;
        cumTime += step.duration;
        directions.push({
          instruction: formatInstruction(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          cumulativeDistance: Math.round(cumDist),
          cumulativeTime: Math.round(cumTime),
          remainingDistance: Math.round(distance - cumDist),
          remainingTime: Math.round(duration - cumTime),
          name: step.name || '',
          type: step.maneuver?.type || 'continue',
          modifier: step.maneuver?.modifier || '',
        });
      }
    }

    // Road type analysis
    let highwayDist = 0, urbanDist = 0, ruralDist = 0;
    for (const leg of route.legs) {
      for (const step of (leg.steps || [])) {
        const spd = step.distance > 0 ? (step.distance / step.duration) * 3.6 : 0;
        if (spd > 70) highwayDist += step.distance;
        else if (spd > 30) urbanDist += step.distance;
        else ruralDist += step.distance;
      }
    }
    const total = highwayDist + urbanDist + ruralDist || 1;

    return {
      index: idx,
      distance, duration,
      estimatedCost: fuelCost + tollCost,
      summary: route.legs?.[0]?.summary || `Route ${idx + 1}`,
      geometry: route.geometry,
      directions,
      roadTypes: {
        highway: Math.round((highwayDist / total) * 100),
        urban: Math.round((urbanDist / total) * 100),
        rural: Math.round((ruralDist / total) * 100),
      },
      tollCost, hasTolls: tollCost > 0,
    };
  });
}

/**
 * Get route between two specific points (for matrix building)
 */
export async function getRouteDistance(lat1, lon1, lat2, lon2) {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await axios.get(url, { timeout: 8000 });
    if (res.data.code === 'Ok' && res.data.routes?.[0]) {
      return { distance: Math.round(res.data.routes[0].distance), duration: Math.round(res.data.routes[0].duration) };
    }
  } catch {}
  return null;
}

/**
 * Get distance matrix using OSRM Table API
 */
export async function getDistanceMatrix(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=distance,duration`;
  const res = await axios.get(url, { timeout: 15000 });
  if (res.data.code === 'Ok') {
    return { distances: res.data.distances, durations: res.data.durations };
  }
  throw new Error('Failed to get distance matrix');
}

/**
 * Get optimized trip using OSRM Trip API
 */
export async function getOptimizedTrip(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`;

  const res = await axios.get(url, { timeout: 15000 });
  if (res.data.code === 'Ok' && res.data.trips?.[0]) {
    const trip = res.data.trips[0];
    // Build directions for the full trip
    const directions = [];
    let legIdx = 0;
    for (const leg of trip.legs) {
      for (const step of (leg.steps || [])) {
        if (step.distance < 5 && step.maneuver?.type !== 'depart' && step.maneuver?.type !== 'arrive') continue;
        directions.push({
          instruction: formatInstruction(step),
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
          name: step.name || '',
          type: step.maneuver?.type || '',
          legIndex: legIdx,
        });
      }
      legIdx++;
    }

    return {
      geometry: trip.geometry,
      distance: Math.round(trip.distance),
      duration: Math.round(trip.duration),
      directions,
      waypoints: res.data.waypoints.map((wp, i) => ({
        waypointIndex: wp.waypoint_index,
        name: wp.name || points[i]?.name || `Stop ${i + 1}`,
        lat: wp.location[1], lon: wp.location[0],
        originalIndex: i,
      })),
      legs: trip.legs.map((leg, i) => ({
        distance: Math.round(leg.distance),
        duration: Math.round(leg.duration),
        summary: leg.summary || '',
      })),
    };
  }
  return null;
}
