import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Loader2, MapPin, Navigation, Plus, Trash2, Crosshair } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import { addSavedPlace, deleteSavedPlace, getSavedPlaces } from '../services/api';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function SavedPlacesPage() {
  const navigate = useNavigate();
  const { dispatch } = useRoute();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    lat: '',
    lon: '',
    address: '',
  });

  useEffect(() => {
    loadPlaces();
  }, []);

  async function loadPlaces() {
    setLoading(true);
    try {
      const res = await getSavedPlaces();
      setPlaces(res.data?.places || []);
    } catch {
      toast.error('Failed to load saved places');
    } finally {
      setLoading(false);
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported in this browser');
      return;
    }

    toast.loading('Fetching current location...', { id: 'saved-gps' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setForm((prev) => ({
          ...prev,
          lat: lat.toFixed(6),
          lon: lon.toFixed(6),
        }));
        toast.success('Current coordinates added', { id: 'saved-gps' });
      },
      () => toast.error('Could not access your location', { id: 'saved-gps' }),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function handleAddPlace(e) {
    e.preventDefault();
    const lat = toNumber(form.lat);
    const lon = toNumber(form.lon);

    if (!form.name.trim() || lat === null || lon === null) {
      toast.error('Name, latitude, and longitude are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        lat,
        lon,
        lng: lon,
        address: form.address.trim(),
      };

      const res = await addSavedPlace(payload);
      const created = res.data?.place;
      if (created) {
        setPlaces((prev) => [created, ...prev]);
      }

      setForm({ name: '', lat: '', lon: '', address: '' });
      toast.success('Place saved');
    } catch {
      toast.error('Failed to save place');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSavedPlace(id);
      setPlaces((prev) => prev.filter((item) => item._id !== id));
      toast.success('Place removed');
    } catch {
      toast.error('Delete failed');
    }
  }

  function handleNavigate(place) {
    const lon = Number(place.lon ?? place.lng);
    const destination = {
      name: place.name || place.address || `${place.lat}, ${lon}`,
      lat: Number(place.lat),
      lon,
    };

    dispatch({ type: 'SET_DESTINATION', payload: destination });
    navigate('/planner');
    toast.success('Destination loaded in planner');
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-surface-100 flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-primary-400" />
            Saved Places
          </h1>
          <p className="text-surface-400 mt-1">Add, delete, and instantly navigate to your favorite locations.</p>
        </div>

        <form onSubmit={handleAddPlace} className="glass p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input-field"
              placeholder="Place name (Home, Office, Cafe...)"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Address (optional)"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Latitude"
              value={form.lat}
              onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Longitude"
              value={form.lon}
              onChange={(e) => setForm((prev) => ({ ...prev, lon: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Place
            </button>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="inline-flex items-center gap-2"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--panel-alt)',
                color: 'var(--text)',
                fontWeight: 600,
              }}
            >
              <Crosshair className="w-4 h-4" />
              Use Current Location
            </button>
          </div>
        </form>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton h-20" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="glass p-10 text-center">
            <MapPin className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-300">No saved places yet</h3>
            <p className="text-surface-500 mt-1">Add your important locations to navigate faster.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {places.map((place) => {
              const lon = Number(place.lon ?? place.lng);
              return (
                <div key={place._id} className="glass p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-surface-100 font-semibold">{place.name}</div>
                      <div className="text-surface-400 text-sm">{place.address || 'No address provided'}</div>
                      <div className="text-surface-500 text-xs mt-1">
                        {Number(place.lat).toFixed(6)}, {Number(lon).toFixed(6)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleNavigate(place)}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <Navigation className="w-4 h-4" />
                        Navigate
                      </button>
                      <button
                        onClick={() => handleDelete(place._id)}
                        className="inline-flex items-center gap-2"
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(244, 63, 94, 0.35)',
                          background: 'rgba(244, 63, 94, 0.1)',
                          color: '#fb7185',
                          fontWeight: 600,
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
