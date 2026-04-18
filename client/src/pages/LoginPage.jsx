import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Brain,
  Navigation2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { registerUser, loginUser } from '../services/api';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: 'samuelvelicharla@gmail.com',
    password: 'Samuel@2006'
  });

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('map_router_token');
    if (token) navigate('/planner');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser({ email: formData.email, password: formData.password });
        if (res.data.token) {
          localStorage.setItem('map_router_token', res.data.token);
          localStorage.setItem('map_router_user', JSON.stringify(res.data.user));
          toast.success(`Welcome back, ${res.data.user.name}!`);
          navigate('/planner');
        }
      } else {
        const res = await registerUser(formData);
        if (res.data.token) {
          localStorage.setItem('map_router_token', res.data.token);
          localStorage.setItem('map_router_user', JSON.stringify(res.data.user));
          toast.success(`Account created! Welcome, ${res.data.user.name}`);
          navigate('/planner');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Authentication failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormData({ name: '', email: '', password: '' });
  };

  return (
    <div className="login-container">
      {/* Background elements */}
      <div className="login-bg-grid" />
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <motion.div 
        className="login-card-wrapper"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-icon-wrap">
                <Brain className="logo-icon" />
                <div className="logo-ring" />
              </div>
              <h1>AI SMART <span>ROUTER</span></h1>
            </div>
            <p className="login-subtitle">
              {isLogin ? 'Welcome back to your AI co-pilot' : 'Join the next generation of navigation'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="name"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="input-group"
                >
                  <label>Full Name</label>
                  <div className="input-row">
                    <User size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="Alex Johnson"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-row">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-row">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                <div className="btn-loader" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button type="button" onClick={toggleAuthMode} className="toggle-auth-btn">
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        </div>

        {/* Feature side-note */}
        <div className="login-features">
          <div className="feature-item">
            <CheckCircle2 size={16} className="feature-icon" />
            <span>AI-Driven Traffic Prediction</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={16} className="feature-icon" />
            <span>Real-time GPS Navigation</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={16} className="feature-icon" />
            <span>Saved Places & Route History</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
