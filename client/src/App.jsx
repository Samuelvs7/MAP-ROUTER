import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { RouteProvider } from './context/RouteContext';
import HomeLayout from './components/layout/HomeLayout';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import PlannerPage from './pages/PlannerPage';
import HistoryPage from './pages/HistoryPage';
import AISuggestionsPage from './pages/AISuggestionsPage';
import SavedPlacesPage from './pages/SavedPlacesPage';
import LoginPage from './pages/LoginPage';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('map_router_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <RouteProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#e2e8f0',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '12px',
              backdropFilter: 'blur(8px)',
            },
          }}
        />
        <Routes>
          <Route
            path="/"
            element={
              <HomeLayout>
                <HomePage />
              </HomeLayout>
            }
          />
          <Route
            path="/login"
            element={<LoginPage />}
          />
          <Route
            path="/planner"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlannerPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <HistoryPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SavedPlacesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-suggestions"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AISuggestionsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </RouteProvider>
  );
}

export default App;
