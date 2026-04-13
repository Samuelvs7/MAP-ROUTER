// ============================================================
// Route Optimizer — Main Orchestrator (ORS + Traffic + AI)
// ============================================================
// 1. Fetches REAL routes from OpenRouteService (with preferences)
// 2. Fetches weather data
// 3. Applies simulated traffic zone delays
// 4. Runs graph algorithms for analysis/comparison
// 5. Applies AI scoring with all data
// 6. Returns ranked routes with explanations
// ============================================================

import { getRoutes } from '../services/orsService.js';
import { getWeather } from '../services/weatherService.js';
import { buildGraph, dijkstra } from './dijkstra.js';
import { astar } from './astar.js';
import { scoreRoutes } from './scoringModel.js';
import { analyzeRoutesTraffic, getTrafficZones, refreshTraffic } from './trafficSimulator.js';

/**
 * Main route optimization function
 * @param {Object} params
 * @param {Object} params.source - { lat, lon, name }
 * @param {Object} params.destination - { lat, lon, name }
 * @param {string} params.preference - 'fastest', 'shortest', 'avoid_tolls', 'avoid_highways', 'scenic', 'cheapest'
 * @param {string} params.departureTime - ISO timestamp
 * @param {boolean} params.isRefresh - Whether this is a dynamic refresh call
 */
export async function optimizeRoute({ source, destination, preference = 'fastest', departureTime = null, isRefresh = false }) {
  console.log(`\n🧠 AI Route Optimizer ${isRefresh ? '(REFRESH)' : ''}`);
  console.log(`   From: (${source.lat}, ${source.lon}) ${source.name || ''}`);
  console.log(`   To: (${destination.lat}, ${destination.lon}) ${destination.name || ''}`);
  console.log(`   Preference: ${preference}`);

  // Step 1: Fetch REAL routes from ORS (with preference support)
  const routes = await getRoutes(source.lat, source.lon, destination.lat, destination.lon, preference);
  console.log(`   📍 Got ${routes.length} routes (source: ${routes[0]?.dataSource || 'unknown'})`);
  routes.forEach((r, i) => console.log(`      Route ${i}: ${(r.distance / 1000).toFixed(1)} km, ${Math.round(r.duration / 60)} min`));

  // Step 2: Fetch weather
  let weather = { condition: 'Clear', temperature: 25 };
  try {
    weather = await getWeather(destination.lat, destination.lon);
    console.log(`   🌤️ Weather: ${weather.condition}, ${weather.temperature}°C`);
  } catch (e) {
    console.log(`   ⚠️ Weather fetch failed, using defaults`);
  }

  // Step 3: Apply simulated traffic zone analysis
  let trafficZones = [];
  let routesWithTraffic;
  try {
    if (isRefresh) {
      // Force regenerate traffic for refresh calls
      trafficZones = refreshTraffic(source.lat, source.lon, destination.lat, destination.lon);
    } else {
      trafficZones = getTrafficZones(source.lat, source.lon, destination.lat, destination.lon);
    }

    routesWithTraffic = analyzeRoutesTraffic(routes, source.lat, source.lon, destination.lat, destination.lon);
    console.log(`   🚦 Traffic analysis applied (${trafficZones.length} zones)`);
    routesWithTraffic.forEach((r, i) => console.log(`      Route ${i}: traffic ${r.trafficLevel} (${r.trafficMultiplier}x), +${Math.round(r.trafficDelay / 60)} min delay`));
  } catch (e) {
    console.log(`   ⚠️ Traffic simulation skipped: ${e.message}`);
    routesWithTraffic = routes;
    trafficZones = [];
  }

  // Step 4: Run graph algorithms on the best route for analysis/comparison
  let algorithmComparison = [];
  try {
    const mainRoute = routesWithTraffic[0];
    if (mainRoute.geometry?.coordinates?.length > 2) {
      const coords = mainRoute.geometry.coordinates;
      const graph = buildGraph(coords, {
        distanceWeight: 1,
        timeWeight: preference === 'fastest' ? 2 : 0.5,
        trafficWeight: 0.5,
      });

      const startNode = '0';
      const endNode = `${coords.length - 1}`;
      const dijkstraResult = dijkstra(graph, startNode, endNode);
      const astarResult = astar(graph, startNode, endNode, coords);

      algorithmComparison.push({
        routeIndex: 0,
        dijkstra: {
          cost: Math.round(dijkstraResult.totalCost),
          nodesVisited: dijkstraResult.nodesVisited,
        },
        astar: {
          cost: Math.round(astarResult.totalCost),
          nodesVisited: astarResult.nodesVisited,
          improvement: dijkstraResult.nodesVisited > 0
            ? Math.round((1 - astarResult.nodesVisited / dijkstraResult.nodesVisited) * 100)
            : 0,
        },
      });
    }
  } catch (e) {
    console.log(`   ⚠️ Graph analysis skipped: ${e.message}`);
  }

  // Step 5: AI Scoring with REAL data + traffic
  const { scoredRoutes, bestRouteIndex, explanation } = scoreRoutes(routesWithTraffic, preference, weather, departureTime);
  console.log(`   🏆 Best route: #${bestRouteIndex} (score: ${scoredRoutes[0].score})`);

  return {
    success: true,
    bestRouteIndex,
    routes: scoredRoutes,
    explanation,
    weather,
    trafficZones, // Send to frontend for map overlay
    algorithmComparison,
    metadata: {
      source,
      destination,
      preference,
      departureTime: departureTime || new Date().toISOString(),
      processedAt: new Date().toISOString(),
      dataSource: routes[0]?.dataSource || 'unknown',
      isRefresh,
      trafficZoneCount: trafficZones.length,
    },
  };
}

export default { optimizeRoute };
