import mongoose from 'mongoose';

const savedPlaceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  lng: { type: Number },
  address: { type: String, default: '' },
  category: { type: String, enum: ['home', 'work', 'favorite', 'food', 'scenic', 'other'], default: 'favorite' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

savedPlaceSchema.pre('validate', function syncLngLon(next) {
  if (!Number.isFinite(this.lon) && Number.isFinite(this.lng)) {
    this.lon = this.lng;
  }
  if (!Number.isFinite(this.lng) && Number.isFinite(this.lon)) {
    this.lng = this.lon;
  }
  next();
});

savedPlaceSchema.index({ userId: 1 });

export default mongoose.model('SavedPlace', savedPlaceSchema);
