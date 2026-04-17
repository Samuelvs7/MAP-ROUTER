import axios from 'axios';

const MAPILLARY_GRAPH_BASE = 'https://graph.mapillary.com';
const MAPILLARY_TIMEOUT_MS = 6000;
const DEFAULT_LIMIT = 6;
const DEFAULT_RADIUS_METERS = 250;

function buildBbox(lat, lon, radiusMeters = DEFAULT_RADIUS_METERS) {
  const latRadius = radiusMeters / 111320;
  const lonRadius = radiusMeters / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    west: lon - lonRadius,
    south: lat - latRadius,
    east: lon + lonRadius,
    north: lat + latRadius,
  };
}

function normalizeImage(item) {
  const coordinates = item?.computed_geometry?.coordinates || item?.geometry?.coordinates || [];
  const lon = Number(coordinates?.[0]);
  const lat = Number(coordinates?.[1]);
  return {
    id: item?.id || '',
    capturedAt: item?.captured_at || null,
    thumbUrl: item?.thumb_1024_url || item?.thumb_2048_url || item?.thumb_256_url || '',
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

function normalizeImageList(data) {
  const rawList = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.features)
      ? data.features.map((feature) => ({
          id: feature?.properties?.id || feature?.id || '',
          captured_at: feature?.properties?.captured_at || null,
          computed_geometry: feature?.geometry || null,
          thumb_1024_url: feature?.properties?.thumb_1024_url || '',
          thumb_2048_url: feature?.properties?.thumb_2048_url || '',
          thumb_256_url: feature?.properties?.thumb_256_url || '',
        }))
      : [];

  return rawList
    .map(normalizeImage)
    .filter((image) => image.id && image.thumbUrl)
    .map((image) => ({
      ...image,
      url: image.thumbUrl,
    }));
}

async function fetchMapillaryByBbox({ token, lat, lon, limit }) {
  const bbox = buildBbox(lat, lon);
  const response = await axios.get(`${MAPILLARY_GRAPH_BASE}/images`, {
    params: {
      access_token: token,
      fields: 'id,captured_at,computed_geometry,thumb_256_url,thumb_1024_url,thumb_2048_url',
      bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
      limit,
    },
    timeout: MAPILLARY_TIMEOUT_MS,
  });
  return normalizeImageList(response.data);
}

async function fetchMapillaryByClosestPoint({ token, lat, lon, limit }) {
  const response = await axios.get(`${MAPILLARY_GRAPH_BASE}/images`, {
    params: {
      access_token: token,
      fields: 'id,captured_at,computed_geometry,thumb_256_url,thumb_1024_url,thumb_2048_url',
      closeto: `${lon},${lat}`,
      radius: DEFAULT_RADIUS_METERS,
      limit,
    },
    timeout: MAPILLARY_TIMEOUT_MS,
  });
  return normalizeImageList(response.data);
}

function fallbackImageResponse(reason) {
  return {
    images: [],
    source: 'fallback',
    fallback: true,
    error: reason,
  };
}

export async function getNearbyMapillaryImages({ lat, lon, limit = DEFAULT_LIMIT } = {}) {
  const token = process.env.MAPILLARY_TOKEN;
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const parsedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 10));

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return fallbackImageResponse('Invalid lat/lon');
  }

  if (!token) {
    return fallbackImageResponse('MAPILLARY_TOKEN is not configured');
  }

  try {
    let images = await fetchMapillaryByBbox({
      token,
      lat: parsedLat,
      lon: parsedLon,
      limit: parsedLimit,
    });

    if (images.length === 0) {
      images = await fetchMapillaryByClosestPoint({
        token,
        lat: parsedLat,
        lon: parsedLon,
        limit: parsedLimit,
      });
    }

    return {
      images: images.slice(0, parsedLimit),
      source: 'mapillary',
      fallback: false,
    };
  } catch (err) {
    const reason = err?.response?.data?.error?.message || err?.message || 'Mapillary request failed';
    return fallbackImageResponse(reason);
  }
}

export default { getNearbyMapillaryImages };
