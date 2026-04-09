// ============================================================
// Route API Endpoints
// ============================================================

import { Router } from 'express';
import { optimizeRoute } from '../ai/routeOptimizer.js';
import { optimizeMultiStop } from '../ai/multiStopOptimizer.js';
import { geocode, reverseGeocode } from '../services/geocodeService.js';

const router = Router();

/**
 * POST /api/routes/optimize
 * Single route optimization (A → B)
 */
router.post('/optimize', async (req, res, next) => {
  try {
    const { source, destination, preference = 'fastest', departureTime } = req.body;

    if (!source?.lat || !source?.lon || !destination?.lat || !destination?.lon) {
      return res.status(400).json({ success: false, error: 'Source and destination with lat/lon are required' });
    }

    const result = await optimizeRoute({ source, destination, preference, departureTime });
    res.json(result);
  } catch (err) {
    console.error('Route optimize error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/routes/multi-stop
 * Multi-stop delivery optimization (TSP)
 * This is the CORE FEATURE — what Google Maps can't do!
 */
router.post('/multi-stop', async (req, res, next) => {
  try {
    const { source, destination, stops = [] } = req.body;

    if (!source?.lat || !destination?.lat) {
      return res.status(400).json({ success: false, error: 'Source and destination required' });
    }
    if (stops.length === 0) {
      return res.status(400).json({ success: false, error: 'At least 1 delivery stop required' });
    }
    if (stops.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 stops allowed' });
    }

    const result = await optimizeMultiStop(source, destination, stops);
    res.json(result);
  } catch (err) {
    console.error('Multi-stop optimize error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/routes/geocode?q=
 */
router.get('/geocode', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ success: false, error: 'Query too short' });

    const results = await geocode(q);
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/routes/reverse-geocode?lat=&lon=
 */
router.get('/reverse-geocode', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, error: 'lat and lon required' });
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

export default router;
