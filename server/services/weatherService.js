// ============================================================
// Weather Service — OpenWeatherMap + Mock Fallback
// ============================================================

import axios from 'axios';

const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather';

const MOCK_CONDITIONS = ['Clear', 'Clouds', 'Rain', 'Drizzle', 'Mist', 'Haze'];

function generateMockWeather(lat, lon) {
  const hour = new Date().getHours();
  const baseTemp = 25 + Math.sin((hour - 6) * Math.PI / 12) * 10;
  const condition = MOCK_CONDITIONS[Math.floor(Math.random() * 3)]; // bias toward good weather

  return {
    condition,
    description: condition.toLowerCase(),
    temperature: Math.round(baseTemp),
    humidity: 40 + Math.round(Math.random() * 40),
    windSpeed: Math.round(5 + Math.random() * 15),
    visibility: condition === 'Rain' ? 5000 : condition === 'Mist' ? 2000 : 10000,
    icon: condition === 'Clear' ? '01d' : condition === 'Clouds' ? '03d' : '10d'
  };
}

export async function getWeather(lat, lon) {
  const apiKey = process.env.WEATHER_API_KEY;

  if (apiKey) {
    try {
      const res = await axios.get(WEATHER_BASE, {
        params: { lat, lon, appid: apiKey, units: 'metric' }
      });
      const d = res.data;
      return {
        condition: d.weather[0].main,
        description: d.weather[0].description,
        temperature: Math.round(d.main.temp),
        humidity: d.main.humidity,
        windSpeed: Math.round(d.wind.speed),
        visibility: d.visibility || 10000,
        icon: d.weather[0].icon
      };
    } catch (err) {
      console.error('Weather API error:', err.message);
    }
  }

  return generateMockWeather(lat, lon);
}

// Weather impact multiplier for route scoring
export function getWeatherPenalty(weather) {
  const penalties = {
    'Clear': 0,
    'Clouds': 0.02,
    'Haze': 0.05,
    'Mist': 0.08,
    'Drizzle': 0.10,
    'Rain': 0.15,
    'Thunderstorm': 0.25,
    'Snow': 0.30,
    'Fog': 0.20
  };
  return penalties[weather.condition] || 0.05;
}
