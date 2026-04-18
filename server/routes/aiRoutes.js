import { Router } from 'express';
import { searchWithSerpApi } from '../services/serpService.js';
import { getNearbyMapillaryImages } from '../services/mapillaryService.js';
import { reverseGeocode } from '../services/geocodeService.js';
import {
  summarizeSearchResults,
  generateChatReply,
  generateIntelligentAnalysis,
  testGeminiConnection,
} from '../services/geminiService.js';

const router = Router();

// â”€â”€â”€ Gemini API test â”€â”€â”€
router.post('/ai/test', async (req, res) => {
  const result = await testGeminiConnection();
  if (!result.success) {
    return res.status(result.status || 500).json(result);
  }
  return res.json(result);
});

// ─── Existing: Web Search ───
router.post('/search', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const location = req.body?.location ? String(req.body.location).trim() : null;

    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters',
      });
    }

    const search = await searchWithSerpApi(query, { location, num: 6 });
    const summary = await summarizeSearchResults({
      query,
      results: search.results,
    });

    return res.json({
      success: true,
      query,
      summary,
      answerBox: search.answerBox || null,
      results: search.results || [],
      source: search.source || 'fallback',
      fallback: Boolean(search.fallback),
      error: search.error || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Search request failed',
    });
  }
});

// ─── Existing: Nearby Images ───
router.get('/images', async (req, res) => {
  try {
    const lat = Number(req.query?.lat);
    const lon = Number(req.query?.lon);
    const limit = Number(req.query?.limit) || 6;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,
        error: 'lat and lon query params are required',
      });
    }

    const [placeResult, imagesResult] = await Promise.allSettled([
      reverseGeocode(lat, lon),
      getNearbyMapillaryImages({ lat, lon, limit }),
    ]);

    const place = placeResult.status === 'fulfilled'
      ? placeResult.value
      : { name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };

    const imagesPayload = imagesResult.status === 'fulfilled'
      ? imagesResult.value
      : {
          images: [],
          source: 'fallback',
          fallback: true,
          error: imagesResult.reason?.message || 'Mapillary request failed',
        };

    return res.json({
      success: true,
      place,
      images: imagesPayload.images || [],
      source: imagesPayload.source || 'fallback',
      fallback: Boolean(imagesPayload.fallback),
      error: imagesPayload.error || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Images request failed',
    });
  }
});

// ─── Existing: Chat ───
router.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const context = req.body?.context && typeof req.body.context === 'object'
      ? req.body.context
      : {};

    if (message.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'message is required',
      });
    }

    // Auto-detect intent for visuals and fetch them
    const wantsVisuals = /visual|picture|image|photo|street view|show me/i.test(message);
    let images = [];
    
    // We run the AI reply generation and image fetch concurrently if needed
    const tasks = [generateChatReply({ message, context })];

    const visualTarget = context.destination?.lat && context.destination?.lon
      ? context.destination
      : context.source;

    if (wantsVisuals && visualTarget?.lat && visualTarget?.lon) {
      tasks.push(getNearbyMapillaryImages({ 
        lat: Number(visualTarget.lat), 
        lon: Number(visualTarget.lon), 
        limit: 4 
      }));
    }

    const [reply, imagesResult] = await Promise.all(tasks);

    if (imagesResult && imagesResult.images) {
      images = imagesResult.images;
    }

    return res.json({
      success: true,
      reply,
      images,
      hasImages: images.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Chat request failed',
    });
  }
});

// ─── NEW: Intelligent AI Analysis ───
// Single endpoint that takes full navigation context and returns rich AI response
router.post('/ai/analyze', async (req, res) => {
  try {
    const context = req.body || {};
    const analysis = await generateIntelligentAnalysis(context);

    return res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'AI analysis failed',
    });
  }
});

// ─── NEW: Navigation Event Handler ───
// Handles system events and returns AI analysis + auto-fetched images in one response
router.post('/ai/navigation-event', async (req, res) => {
  try {
    const { event, lat, lon, ...context } = req.body || {};
    const eventType = String(event || 'general').trim();

    // Run AI analysis and image fetch in parallel
    const tasks = [generateIntelligentAnalysis({ event: eventType, ...context })];

    // Auto-fetch nearby images for location-relevant events
    const shouldFetchImages = ['route_selected', 'navigation_started'].includes(eventType);
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLon);

    if (shouldFetchImages && hasCoords) {
      tasks.push(getNearbyMapillaryImages({ lat: parsedLat, lon: parsedLon, limit: 4 }));
    } else {
      tasks.push(Promise.resolve(null));
    }

    const [analysis, imagesResult] = await Promise.all(tasks);

    const images = imagesResult?.images || [];

    return res.json({
      success: true,
      event: eventType,
      analysis,
      images,
      hasImages: images.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Navigation event processing failed',
    });
  }
});

export default router;
