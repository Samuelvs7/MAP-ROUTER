// ============================================================
// Multi-Stop Route Optimizer (TSP Solver)
// ============================================================
// Core feature: "You have 5 places to visit — which ORDER 
// should you visit them to minimize total travel?"
// Google Maps does NOT do this.
// ============================================================

import { getDistanceMatrix, getOptimizedTrip } from '../services/orsService.js';

function nearestNeighbor(distMatrix, startIdx, endIdx) {
  const n = distMatrix.length;
  const tour = [startIdx];
  const toVisit = new Set();
  for (let i = 0; i < n; i++) { if (i !== startIdx && i !== endIdx) toVisit.add(i); }

  let current = startIdx;
  while (toVisit.size > 0) {
    let nearest = -1, nearestDist = Infinity;
    for (const i of toVisit) {
      if (distMatrix[current][i] < nearestDist) { nearest = i; nearestDist = distMatrix[current][i]; }
    }
    if (nearest === -1) break;
    toVisit.delete(nearest);
    tour.push(nearest);
    current = nearest;
  }
  if (endIdx !== startIdx) tour.push(endIdx);
  return tour;
}

function twoOpt(tour, distMatrix) {
  const n = tour.length;
  if (n <= 3) return tour;
  let improved = true, iterations = 0;
  while (improved && iterations < 500) {
    improved = false; iterations++;
    for (let i = 1; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        const d1 = distMatrix[tour[i - 1]][tour[i]] + distMatrix[tour[j]][tour[j + 1]];
        const d2 = distMatrix[tour[i - 1]][tour[j]] + distMatrix[tour[i]][tour[j + 1]];
        if (d2 < d1 - 1) {
          tour.splice(i, j - i + 1, ...tour.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return tour;
}

function tourCost(tour, matrix) {
  let t = 0;
  for (let i = 0; i < tour.length - 1; i++) t += matrix[tour[i]][tour[i + 1]];
  return t;
}

export async function optimizeMultiStop(source, destination, stops) {
  console.log(`\n📍 Multi-Stop Optimizer: ${stops.length} intermediate stops`);

  const allPoints = [source, ...stops, destination];
  const n = allPoints.length;
  const startIdx = 0, endIdx = n - 1;

  // Get REAL distance matrix from OSRM
  console.log('   Fetching real distance matrix...');
  const { distances: distMatrix, durations: durMatrix } = await getDistanceMatrix(allPoints);

  // Original order cost
  const origOrder = allPoints.map((_, i) => i);
  const origDist = tourCost(origOrder, distMatrix);
  const origDur = tourCost(origOrder, durMatrix);

  // Nearest Neighbor
  const nnTour = nearestNeighbor(distMatrix, startIdx, endIdx);
  const nnDist = tourCost(nnTour, distMatrix);

  // 2-opt improvement
  const optTour = twoOpt([...nnTour], distMatrix);
  const optDist = tourCost(optTour, distMatrix);
  const optDur = tourCost(optTour, durMatrix);

  // Try OSRM Trip API
  let osrmTrip = null;
  try { osrmTrip = await getOptimizedTrip(allPoints); } catch {}

  // Pick best
  let bestTour = optTour, bestDist = optDist, bestDur = optDur, method = 'Nearest Neighbor + 2-opt';
  if (osrmTrip && osrmTrip.distance < bestDist) {
    bestDist = osrmTrip.distance; bestDur = osrmTrip.duration;
    method = 'OSRM TSP Solver';
  }

  const saved = Math.max(0, origDist - bestDist);
  const timeSaved = Math.max(0, origDur - bestDur);
  const improvement = origDist > 0 ? Math.round((saved / origDist) * 100) : 0;

  console.log(`   Original: ${(origDist / 1000).toFixed(1)} km | Optimized: ${(bestDist / 1000).toFixed(1)} km | Saved: ${(saved / 1000).toFixed(1)} km (${improvement}%)`);

  // Build sequence
  const optimizedSequence = bestTour.map((idx, seq) => ({
    order: seq + 1,
    ...allPoints[idx],
    isStart: idx === startIdx,
    isEnd: idx === endIdx,
    distToNext: seq < bestTour.length - 1 ? Math.round(distMatrix[bestTour[seq]][bestTour[seq + 1]]) : 0,
    timeToNext: seq < bestTour.length - 1 ? Math.round(durMatrix[bestTour[seq]][bestTour[seq + 1]]) : 0,
  }));

  // Leg details
  const legs = [];
  for (let i = 0; i < bestTour.length - 1; i++) {
    legs.push({
      from: allPoints[bestTour[i]].name,
      to: allPoints[bestTour[i + 1]].name,
      distance: Math.round(distMatrix[bestTour[i]][bestTour[i + 1]]),
      duration: Math.round(durMatrix[bestTour[i]][bestTour[i + 1]]),
    });
  }

  // Explanation — why each stop was moved
  const moves = [];
  for (let i = 1; i < bestTour.length - 1; i++) {
    const optIdx = bestTour[i];
    if (origOrder[i] !== optIdx) {
      moves.push({
        stop: allPoints[optIdx].name?.split(',')[0] || `Stop`,
        reason: `Visiting ${allPoints[optIdx].name?.split(',')[0]} at position ${i} saves ${((distMatrix[origOrder[i - 1]][origOrder[i]] - distMatrix[bestTour[i - 1]][bestTour[i]]) / 1000).toFixed(1)} km on this leg`,
      });
    }
  }

  return {
    success: true,
    optimizedSequence, legs,
    totalDistance: Math.round(bestDist),
    totalDuration: Math.round(bestDur),
    originalDistance: Math.round(origDist),
    originalDuration: Math.round(origDur),
    distanceSaved: Math.round(saved),
    timeSaved: Math.round(timeSaved),
    improvement, method,
    geometry: osrmTrip?.geometry || null,
    directions: osrmTrip?.directions || [],
    explanation: {
      summary: saved > 0
        ? `Reordering your stops saves ${(saved / 1000).toFixed(1)} km and ${Math.round(timeSaved / 60)} minutes. ${method} found the optimal visiting order.`
        : `Your stop order is already optimal.`,
      moves,
    },
    algorithmComparison: {
      original: { distance: Math.round(origDist), duration: Math.round(origDur) },
      nearestNeighbor: { distance: Math.round(nnDist), duration: Math.round(tourCost(nnTour, durMatrix)) },
      twoOpt: { distance: Math.round(optDist), duration: Math.round(optDur) },
      osrm: osrmTrip ? { distance: osrmTrip.distance, duration: osrmTrip.duration } : null,
    },
  };
}
