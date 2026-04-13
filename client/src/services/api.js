import axios from 'axios';

const API_BASE = '/api';
const api = axios.create({ baseURL: API_BASE, timeout: 30000, headers: { 'Content-Type': 'application/json' } });

export const optimizeRoute = (data) => api.post('/routes/optimize', data);
export const refreshRoute = (data) => api.post('/routes/refresh', data);
export const optimizeMultiStop = (data) => api.post('/routes/multi-stop', data);
export const getTrafficZones = (sourceLat, sourceLon, destLat, destLon, refresh = false) =>
  api.get(`/routes/traffic-zones?sourceLat=${sourceLat}&sourceLon=${sourceLon}&destLat=${destLat}&destLon=${destLon}&refresh=${refresh}`);
export const geocodePlace = (query) => api.get(`/routes/geocode?q=${encodeURIComponent(query)}`);
export const reverseGeocode = (lat, lon) => api.get(`/routes/reverse-geocode?lat=${lat}&lon=${lon}`);
export const getHistory = () => api.get('/history');
export const saveHistory = (data) => api.post('/history', data);
export const deleteHistory = (id) => api.delete(`/history/${id}`);
export const getStats = () => api.get('/history/stats');
export const healthCheck = () => api.get('/health');
export default api;
