// ============================================================
// Geocoding Service — Multi-Provider (Nominatim + Photon)
// ============================================================
// Uses OpenStreetMap Nominatim as primary + Komoot Photon as 
// fallback for fuzzy/partial matching. Both are FREE, no API key.
// Photon is especially good at handling partial/informal names
// like "mangalagiri barkas" that Nominatim may miss.
// ============================================================

import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const PHOTON_URL = 'https://photon.komoot.io/api';

/**
 * Geocode a place name using Nominatim (structured) + Photon (fuzzy) 
 * Merges results and deduplicates for maximum coverage.
 * @param {string} query - Place name to search
 * @returns {Array} - Array of { name, lat, lon }
 */
export async function geocode(query) {
  // Run both providers in parallel for speed
  const [nominatimResults, photonResults] = await Promise.allSettled([
    geocodeNominatim(query),
    geocodePhoton(query),
  ]);

  const nom = nominatimResults.status === 'fulfilled' ? nominatimResults.value : [];
  const phot = photonResults.status === 'fulfilled' ? photonResults.value : [];

  // Merge: Nominatim first (more accurate), Photon second (fuzzier matches)
  const merged = [...nom];
  const seen = new Set(nom.map(r => `${r.lat.toFixed(3)}_${r.lon.toFixed(3)}`));
  
  for (const r of phot) {
    const key = `${r.lat.toFixed(3)}_${r.lon.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(r);
    }
  }

  return merged.slice(0, 8); // Return up to 8 results
}

/**
 * Nominatim geocoder — best for structured addresses
 */
async function geocodeNominatim(query) {
  try {
    const res = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 6,
        addressdetails: 1,
        // No countrycodes restriction — search globally like Google Maps
        'accept-language': 'en',
      },
      headers: {
        'User-Agent': 'AISmartRouterPlanner/1.0',
      },
      timeout: 6000,
    });

    if (res.data && res.data.length > 0) {
      return res.data.map(item => ({
        name: formatDisplayName(item.display_name, item.address),
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        importance: item.importance || 0,
      }));
    }
    return [];
  } catch (err) {
    console.error('Nominatim geocode error:', err.message);
    return [];
  }
}

/**
 * Photon geocoder (by Komoot) — excellent at fuzzy/partial matching
 * This is what makes "mangalagiri barkas" or "bglr railway stn" work!
 */
async function geocodePhoton(query) {
  try {
    const res = await axios.get(PHOTON_URL, {
      params: {
        q: query,
        limit: 6,
        lang: 'en',
      },
      headers: {
        'User-Agent': 'AISmartRouterPlanner/1.0',
      },
      timeout: 6000,
    });

    if (res.data?.features?.length > 0) {
      return res.data.features.map(f => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        
        // Build a rich display name from Photon's structured data
        const parts = [
          props.name,
          props.street,
          props.district || props.locality,
          props.city || props.county,
          props.state,
          props.country,
        ].filter(Boolean);

        // Remove duplicates in parts (e.g., "Hyderabad, Hyderabad, Telangana")
        const unique = [];
        for (const p of parts) {
          if (!unique.some(u => u.toLowerCase() === p.toLowerCase())) {
            unique.push(p);
          }
        }

        return {
          name: unique.slice(0, 4).join(', '),
          fullName: unique.join(', '),
          lat: coords[1],
          lon: coords[0],
          type: props.osm_value || props.type || '',
          importance: 0,
        };
      });
    }
    return [];
  } catch (err) {
    console.error('Photon geocode error:', err.message);
    return [];
  }
}

/**
 * Format display name smartly — show relevant parts, not raw Nominatim output
 */
function formatDisplayName(displayName, address = {}) {
  // Try to build a sensible name from address components
  const parts = [
    address.amenity || address.building || address.shop || address.tourism,
    address.road || address.pedestrian,
    address.suburb || address.neighbourhood || address.hamlet,
    address.city || address.town || address.village,
    address.state,
  ].filter(Boolean);

  if (parts.length >= 2) {
    // Remove duplicates
    const unique = [];
    for (const p of parts) {
      if (!unique.some(u => u.toLowerCase() === p.toLowerCase())) {
        unique.push(p);
      }
    }
    return unique.slice(0, 4).join(', ');
  }

  // Fallback: use display_name but limit to useful parts
  return displayName.split(',').slice(0, 4).join(', ').trim();
}

/**
 * Reverse geocode coordinates to place name
 */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: { lat, lon, format: 'json', addressdetails: 1, 'accept-language': 'en' },
      headers: { 'User-Agent': 'AISmartRouterPlanner/1.0' },
      timeout: 5000,
    });

    if (res.data && res.data.display_name) {
      return {
        name: formatDisplayName(res.data.display_name, res.data.address),
        lat, lon,
      };
    }
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon };
  }
}
