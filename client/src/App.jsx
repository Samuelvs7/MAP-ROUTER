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
            path="/planner"
            element={
              <AppLayout>
                <PlannerPage />
              </AppLayout>
            }
          />
          <Route
            path="/history"
            element={
              <AppLayout>
                <HistoryPage />
              </AppLayout>
            }
          />
          <Route
            path="/saved"
            element={
              <AppLayout>
                <SavedPlacesPage />
              </AppLayout>
            }
          />
          <Route
            path="/ai-suggestions"
            element={
              <AppLayout>
                <AISuggestionsPage />
              </AppLayout>
            }
          />
        </Routes>
      </Router>
    </RouteProvider>
  );
}

export default App;
