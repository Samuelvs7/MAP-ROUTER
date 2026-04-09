// ============================================================
// Geocoding Service — Nominatim (FREE, no API key needed)
// ============================================================
// Uses OpenStreetMap Nominatim for real geocoding.
// No API key required. Free for reasonable use.
// ============================================================

import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Geocode a place name to coordinates using real Nominatim API
 * @param {string} query - Place name to search
 * @returns {Array} - Array of { name, lat, lon }
 */
export async function geocode(query) {
  try {
    const res = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        countrycodes: 'in', // Focus on India
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'AISmartRouterPlanner/1.0',
      },
      timeout: 5000,
    });

    if (res.data && res.data.length > 0) {
      return res.data.map(item => ({
        name: item.display_name.split(',').slice(0, 3).join(', '),
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
    }
    return [];
  } catch (err) {
    console.error('Nominatim geocode error:', err.message);
    return [];
  }
}

/**
 * Reverse geocode coordinates to place name
 */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: { lat, lon, format: 'json', addressdetails: 1 },
      headers: { 'User-Agent': 'AISmartRouterPlanner/1.0' },
      timeout: 5000,
    });

    if (res.data && res.data.display_name) {
      return {
        name: res.data.display_name.split(',').slice(0, 3).join(', '),
        lat, lon,
      };
    }
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  }
}
