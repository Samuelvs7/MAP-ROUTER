// ============================================================
// History API Endpoints (with in-memory fallback)
// ============================================================

import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();
let memoryHistory = [];

function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

async function getModel() {
  const mod = await import('../models/Route.js');
  return mod.default;
}

/** POST /api/history — Save search */
router.post('/', async (req, res, next) => {
  try {
    const entry = { ...req.body, createdAt: new Date() };
    if (isDBConnected()) {
      const RouteHistory = await getModel();
      const doc = await RouteHistory.create(entry);
      return res.status(201).json({ success: true, id: doc._id });
    }
    entry._id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    memoryHistory.unshift(entry);
    if (memoryHistory.length > 50) memoryHistory = memoryHistory.slice(0, 50);
    res.status(201).json({ success: true, id: entry._id });
  } catch (err) { next(err); }
});

/** GET /api/history — Get history */
router.get('/', async (req, res, next) => {
  try {
    if (isDBConnected()) {
      const RouteHistory = await getModel();
      const history = await RouteHistory.find().sort({ createdAt: -1 }).limit(20).lean();
      return res.json({ success: true, history });
    }
    res.json({ success: true, history: memoryHistory.slice(0, 20) });
  } catch (err) { next(err); }
});

/** GET /api/history/stats — Usage stats */
router.get('/stats', async (req, res, next) => {
  try {
    let totalSearches = 0;
    let preferenceBreakdown = {};
    if (isDBConnected()) {
      const RouteHistory = await getModel();
      totalSearches = await RouteHistory.countDocuments();
      const prefs = await RouteHistory.aggregate([{ $group: { _id: '$preference', count: { $sum: 1 } } }]);
      prefs.forEach(p => { preferenceBreakdown[p._id] = p.count; });
    } else {
      totalSearches = memoryHistory.length;
      memoryHistory.forEach(h => {
        preferenceBreakdown[h.preference] = (preferenceBreakdown[h.preference] || 0) + 1;
      });
    }
    res.json({ success: true, totalSearches, preferenceBreakdown });
  } catch (err) { next(err); }
});

/** DELETE /api/history/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    if (isDBConnected()) {
      const RouteHistory = await getModel();
      await RouteHistory.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    memoryHistory = memoryHistory.filter(h => h._id !== req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
