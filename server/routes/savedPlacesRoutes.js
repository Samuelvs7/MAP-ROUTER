import { Router } from 'express';
import jwt from 'jsonwebtoken';
import SavedPlace from '../models/SavedPlace.js';

const router = Router();
const GUEST_USER_ID = 'guest';

function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mapRouterAI2026SecretKey');
      if (decoded?.id) return String(decoded.id);
    } catch {
      // Fallback to guest mode.
    }
  }
  return GUEST_USER_ID;
}

function normalizeCoords(payload = {}) {
  const lat = Number(payload.lat);
  const lon = Number(payload.lon ?? payload.lng);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const places = await SavedPlace.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, places });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch saved places' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { name, address, category, notes } = req.body;
    const { lat, lon } = normalizeCoords(req.body);

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, error: 'Name, lat, and lon are required' });
    }

    const place = await SavedPlace.create({
      userId,
      name,
      lat,
      lon,
      lng: lon,
      address: address || '',
      category: category || 'favorite',
      notes: notes || '',
    });

    res.status(201).json({ success: true, place });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save place' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { lat, lon } = normalizeCoords(req.body);
    const updatePayload = { ...req.body };

    if (Number.isFinite(lat)) updatePayload.lat = lat;
    if (Number.isFinite(lon)) {
      updatePayload.lon = lon;
      updatePayload.lng = lon;
    }

    const place = await SavedPlace.findOneAndUpdate(
      { _id: req.params.id, userId },
      updatePayload,
      { new: true }
    );

    if (!place) return res.status(404).json({ success: false, error: 'Place not found' });
    res.json({ success: true, place });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update place' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const result = await SavedPlace.findOneAndDelete({ _id: req.params.id, userId });

    if (!result) return res.status(404).json({ success: false, error: 'Place not found' });
    res.json({ success: true, message: 'Place deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete place' });
  }
});

export default router;