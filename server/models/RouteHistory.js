import mongoose from 'mongoose';

const routeHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: {
    name: String,
    lat: Number,
    lon: Number,
  },
  destination: {
    name: String,
    lat: Number,
    lon: Number,
  },
  distance: Number,       // meters
  duration: Number,        // seconds
  trafficLevel: String,
  trafficScore: Number,
  routeIndex: Number,
  routeSummary: String,
  cost: Number,
  createdAt: { type: Date, default: Date.now },
});

routeHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('RouteHistory', routeHistorySchema);
