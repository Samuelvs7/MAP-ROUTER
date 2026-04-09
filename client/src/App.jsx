import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { RouteProvider } from './context/RouteContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import PlannerPage from './pages/PlannerPage';
import HistoryPage from './pages/HistoryPage';

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
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </Layout>
      </Router>
    </RouteProvider>
  );
}

export default App;
