# AI Smart Router Planner

An intelligent route optimization web app that combines graph algorithms, weighted scoring, and ML-based traffic prediction.

## What Makes It Different

Traditional maps focus mostly on shortest-path logic. This project combines:

- Dijkstra (baseline shortest path)
- A* (heuristic pathfinding with Haversine)
- Weighted AI scoring across distance, time, traffic, cost, weather, and road type
- ML traffic prediction via a Flask API (`time`, `day` -> traffic level/score)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React-Leaflet, Framer Motion |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (optional) |
| Routing | OpenRouteService + OSRM fallback |
| Weather | OpenWeatherMap (optional) |
| ML Service | Flask + model.pkl |
| LLM Messaging | Gemini (optional fallback-safe messaging) |

## Project Structure

```text
client/      # React frontend
server/      # Express backend
ml-model/    # Flask ML API (predict traffic)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+

### 1) Install Dependencies

```bash
# From project root (needed for one-command run)
npm install

# Backend
cd server
npm install

# Frontend
cd ../client
npm install

# ML API
cd ../ml-model
pip install -r requirements.txt
```

### 2) Environment Setup

Create `server/.env` (you can copy from `server/.env.example`):

```env
ORS_API_KEY=your_openrouteservice_key
WEATHER_API_KEY=your_openweathermap_key
MONGO_URI=your_mongodb_uri
GEMINI_API_KEY=your_gemini_key
ML_PREDICT_URL=http://localhost:5001/predict
```

## Run the System

### Option A: Manual (recommended for demos)

Use 3 terminals:

```bash
# Terminal 1 - ML API (5001)
cd ml-model
python app.py

# Terminal 2 - Backend API (5000)
cd server
npm run dev

# Terminal 3 - Frontend (5173)
cd client
npm run dev
```

Open: `http://localhost:5173`

### Option B: One command

From project root:

```bash
npm run dev
```

This runs ML + backend + frontend together using `concurrently`.

### Pre-demo check (Step 9)

From project root:

```bash
npm run health:check
```

This checks:

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:5000/api/health`
- ML API: `http://localhost:5001/health`

## Health Checks

- Backend: `http://localhost:5000/api/health`
- ML API: `http://localhost:5001/health`

## API Endpoints (Backend)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/routes/optimize` | Optimize routes |
| POST | `/api/routes/refresh` | Controlled refresh loop |
| POST | `/api/routes/multi-stop` | Multi-stop optimization |
| GET | `/api/routes/geocode?q=` | Geocoding |
| GET | `/api/routes/reverse-geocode?lat=&lon=` | Reverse geocoding |
| GET | `/api/history` | Route history |
| GET | `/api/health` | Backend health |

## API Endpoints (ML)

| Method | Endpoint | Description |
|---|---|---|
| POST | `http://localhost:5001/predict` | Predict traffic from `{ time, day }` |
| GET | `http://localhost:5001/health` | ML service health |

## Notes

- Traffic routing falls back safely if ML service is down.
- Gemini is used only for user-facing switch suggestions, not route calculations.
- Rotate API keys immediately if they were exposed publicly.

## License

MIT
