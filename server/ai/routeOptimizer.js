// ============================================================
// Route Optimizer — Main Orchestrator (REAL DATA)
// ============================================================
// 1. Fetches REAL routes from OSRM (actual road distances)
// 2. Fetches weather data
// 3. Runs graph algorithms for analysis
// 4. Applies AI scoring with REAL route features
// 5. Returns ranked routes with explanations
// ============================================================

import { getRoutes } from '../services/orsService.js';
import { getWeather } from '../services/weatherService.js';
import { buildGraph, dijkstra } from './dijkstra.js';
import { astar } from './astar.js';
import { scoreRoutes } from './scoringModel.js';

/**
 * Main route optimization function
 */
export async function optimizeRoute({ source, destination, preference = 'fastest', departureTime = null }) {
  console.log(`\n🧠 AI Route Optimizer`);
  console.log(`   From: (${source.lat}, ${source.lon}) ${source.name || ''}`);
  console.log(`   To: (${destination.lat}, ${destination.lon}) ${destination.name || ''}`);
  console.log(`   Preference: ${preference}`);

  // Step 1: Fetch REAL routes from OSRM
  const routes = await getRoutes(source.lat, source.lon, destination.lat, destination.lon);
  console.log(`   📍 Got ${routes.length} real routes from OSRM`);
  routes.forEach((r, i) => console.log(`      Route ${i}: ${(r.distance / 1000).toFixed(1)} km, ${Math.round(r.duration / 60)} min`));

  // Step 2: Fetch weather
  let weather = { condition: 'Clear', temperature: 25 };
  try {
    weather = await getWeather(destination.lat, destination.lon);
    console.log(`   🌤️ Weather: ${weather.condition}, ${weather.temperature}°C`);
  } catch (e) {
    console.log(`   ⚠️ Weather fetch failed, using defaults`);
  }

  // Step 3: Run graph algorithms on the best route for analysis/comparison
  let algorithmComparison = [];
  try {
    const mainRoute = routes[0];
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

  // Step 4: AI Scoring with REAL data
  const { scoredRoutes, bestRouteIndex, explanation } = scoreRoutes(routes, preference, weather, departureTime);
  console.log(`   🏆 Best route: #${bestRouteIndex} (score: ${scoredRoutes[0].score})`);

  return {
    success: true,
    bestRouteIndex,
    routes: scoredRoutes,
    explanation,
    weather,
    algorithmComparison,
    metadata: {
      source,
      destination,
      preference,
      departureTime: departureTime || new Date().toISOString(),
      processedAt: new Date().toISOString(),
      dataSource: 'OSRM (real road data)',
    },
  };
}

export default { optimizeRoute };
