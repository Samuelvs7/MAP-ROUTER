# 🧭 AI Smart Router Planner

> An intelligent, AI-powered route optimization web application that goes beyond traditional map services.

## 🎯 What Makes It Different from Google Maps?

Traditional maps use simple shortest-path algorithms. Our system combines:

- **Dijkstra's Algorithm** — baseline shortest path
- **A\* Algorithm** — heuristic-enhanced pathfinding (Haversine)
- **AI Weighted Scoring Model** — multi-factor route ranking

### AI Scoring Formula
```
Score = w₁·distance + w₂·time + w₃·traffic + w₄·cost + w₅·weather + w₆·road_type
```
Weights dynamically adjust based on user preference (fastest/cheapest/scenic/no-tolls) and time-of-day traffic patterns.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS 3, React-Leaflet, Framer Motion |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (optional — works without it) |
| AI Engine | Custom JS (Dijkstra, A*, Weighted Scoring) |
| Maps API | OpenRouteService (or mock data) |
| Weather | OpenWeatherMap (or mock data) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies  
cd ../client
npm install
```

### 2. Configure Environment (Optional)

Copy `server/.env.example` to `server/.env` and add your API keys:
```
ORS_API_KEY=your_openrouteservice_key
WEATHER_API_KEY=your_openweathermap_key
MONGO_URI=your_mongodb_uri
```
> **Note:** The app works WITHOUT any API keys using realistic mock data!

### 3. Run

```bash
# Terminal 1 — Start backend
cd server
npm run dev

# Terminal 2 — Start frontend
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

## 📁 Project Structure

```
├── client/                  # React Frontend
│   ├── src/
│   │   ├── components/      # UI & Map components
│   │   ├── pages/           # HomePage, PlannerPage, HistoryPage
│   │   ├── context/         # Global state management
│   │   └── services/        # API client
│
├── server/                  # Express Backend
│   ├── ai/                  # 🧠 AI Engine
│   │   ├── dijkstra.js      # Dijkstra's algorithm
│   │   ├── astar.js         # A* algorithm
│   │   ├── scoringModel.js  # Weighted scoring AI
│   │   ├── routeOptimizer.js     # Main orchestrator
│   │   └── multiStopOptimizer.js # TSP solver
│   ├── services/            # API wrappers (ORS, Weather, Geocode)
│   ├── routes/              # Express API routes
│   └── models/              # MongoDB schemas
```

## 🧠 AI Features

1. **Multi-Factor Route Scoring** — 6 normalized features with dynamic weights
2. **Explainable AI** — natural language explanation of route selection
3. **Traffic Simulation** — time-of-day based traffic multipliers
4. **Weather-Aware Routing** — weather penalty applied to routes
5. **Multi-Stop Optimization** — TSP with Nearest Neighbor + 2-opt
6. **Algorithm Comparison** — Dijkstra vs A* performance metrics

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/routes/optimize` | AI-optimized routes |
| POST | `/api/routes/multi-stop` | Multi-stop optimization |
| GET | `/api/routes/geocode?q=` | Geocode place name |
| GET | `/api/history` | Route search history |
| GET | `/api/health` | Health check |

## 📜 License
MIT
