import { createContext, useContext, useReducer } from 'react';

const RouteContext = createContext();

const initialState = {
  source: null,
  destination: null,
  waypoints: [],
  preference: 'fastest',
  departureTime: null,
  routes: [],
  bestRouteIndex: null,
  selectedRouteIndex: null,
  explanation: null,
  weather: null,
  algorithmComparison: null,
  loading: false,
  error: null,
};

function routeReducer(state, action) {
  switch (action.type) {
    case 'SET_SOURCE': return { ...state, source: action.payload };
    case 'SET_DESTINATION': return { ...state, destination: action.payload };
    case 'SET_WAYPOINTS': return { ...state, waypoints: action.payload };
    case 'ADD_WAYPOINT': return { ...state, waypoints: [...state.waypoints, action.payload] };
    case 'REMOVE_WAYPOINT': return { ...state, waypoints: state.waypoints.filter((_, i) => i !== action.payload) };
    case 'SET_PREFERENCE': return { ...state, preference: action.payload };
    case 'SET_DEPARTURE': return { ...state, departureTime: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload, error: null };
    case 'SET_ERROR': return { ...state, error: action.payload, loading: false };
    case 'SET_RESULTS': return {
      ...state,
      routes: action.payload.routes,
      bestRouteIndex: action.payload.bestRouteIndex,
      selectedRouteIndex: action.payload.bestRouteIndex,
      explanation: action.payload.explanation,
      weather: action.payload.weather,
      algorithmComparison: action.payload.algorithmComparison,
      loading: false,
      error: null,
    };
    case 'SELECT_ROUTE': return { ...state, selectedRouteIndex: action.payload };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}

export function RouteProvider({ children }) {
  const [state, dispatch] = useReducer(routeReducer, initialState);
  return (
    <RouteContext.Provider value={{ state, dispatch }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const context = useContext(RouteContext);
  if (!context) throw new Error('useRoute must be used within RouteProvider');
  return context;
}
