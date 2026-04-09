import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, Zap, Cloud, Route, Brain, Shield, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  { icon: Brain, title: 'AI-Powered Routing', desc: 'Dijkstra & A* algorithms with weighted scoring for truly intelligent route selection', color: 'from-primary-500 to-purple-500' },
  { icon: Zap, title: 'Real-Time Traffic', desc: 'Time-of-day traffic simulation adjusts route scores dynamically', color: 'from-accent-amber to-orange-500' },
  { icon: Cloud, title: 'Weather-Aware', desc: 'Routes adjusted based on current weather conditions at your destination', color: 'from-accent-cyan to-blue-500' },
  { icon: Route, title: 'Multi-Stop Optimization', desc: 'TSP solver with 2-opt improvement finds the best order for multiple stops', color: 'from-accent-green to-emerald-500' },
  { icon: Shield, title: 'Smart Preferences', desc: 'Fastest, cheapest, scenic, or toll-free — AI adapts weights to your needs', color: 'from-accent-rose to-pink-500' },
  { icon: Sparkles, title: 'Explainable AI', desc: 'Understand WHY each route was selected with transparent scoring breakdown', color: 'from-violet-500 to-purple-600' },
];

const stats = [
  { value: '3+', label: 'Route Alternatives' },
  { value: '6', label: 'AI Scoring Factors' },
  { value: '< 2s', label: 'Optimization Time' },
  { value: '100%', label: 'Transparent AI' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-32 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-cyan/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-sm text-accent-cyan text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Powered by AI & Graph Algorithms
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="text-surface-100">Smarter Routes.</span>
              <br />
              <span className="bg-gradient-to-r from-primary-400 via-accent-cyan to-primary-500 bg-clip-text text-transparent">
                Powered by AI.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Beyond Google Maps — our AI combines Dijkstra &amp; A* algorithms with real-time traffic, 
              weather data, and your preferences to find the <span className="text-primary-400 font-semibold">truly optimal route</span>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/planner" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
                <Map className="w-5 h-5" />
                Start Planning
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className="btn-secondary inline-flex items-center gap-2 text-lg px-8 py-4">
                Learn How It Works
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="px-4 -mt-16 relative z-20">
        <div className="max-w-4xl mx-auto glass p-6 glow">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-cyan bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-surface-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-100 mb-4">
              Why We're <span className="text-primary-400">Smarter</span> Than Traditional Maps
            </h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">
              Traditional map services use simple shortest-path. We use AI-based multi-factor decision making.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass p-6 hover:border-primary-500/30 transition-all duration-500 group cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} p-3 mb-4
                              group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                  <feature.icon className="w-full h-full text-white" />
                </div>
                <h3 className="text-lg font-semibold text-surface-100 mb-2">{feature.title}</h3>
                <p className="text-surface-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Algorithm Section */}
      <section className="px-4 py-16 border-t border-surface-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="glass p-8">
            <h3 className="text-2xl font-bold text-surface-100 mb-4 flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary-400" />
              How Our AI Scoring Works
            </h3>
            <div className="bg-surface-900/60 rounded-xl p-6 font-mono text-sm mb-6 overflow-x-auto">
              <div className="text-surface-500">{'// AI Weighted Scoring Formula'}</div>
              <div className="text-accent-cyan mt-2">Score = </div>
              <div className="ml-4 text-accent-green">w₁ × normalize(distance)</div>
              <div className="ml-2 text-surface-400">+ <span className="text-accent-amber">w₂ × normalize(time)</span></div>
              <div className="ml-2 text-surface-400">+ <span className="text-accent-rose">w₃ × normalize(traffic)</span></div>
              <div className="ml-2 text-surface-400">+ <span className="text-primary-400">w₄ × normalize(cost)</span></div>
              <div className="ml-2 text-surface-400">+ <span className="text-purple-400">w₅ × weather_penalty</span></div>
              <div className="ml-2 text-surface-400">+ <span className="text-accent-cyan">w₆ × road_type_score</span></div>
              <div className="mt-4 text-surface-500">{'// Weights dynamically adjust based on user preference'}</div>
              <div className="text-accent-amber">{'// + time-of-day traffic multiplier'}</div>
            </div>
            <p className="text-surface-400">
              Each route is scored using 6 normalized factors with dynamic weights that change based on your preference. 
              The AI explains exactly <span className="text-primary-400 font-semibold">why</span> it chose each route.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-surface-100 mb-4">Ready to Find Your Optimal Route?</h2>
          <p className="text-surface-400 mb-8">Experience AI-powered routing that's smarter than Google Maps.</p>
          <Link to="/planner" className="btn-primary inline-flex items-center gap-2 text-lg px-10 py-4">
            <Zap className="w-5 h-5" />
            Open Route Planner
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-cyan flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-surface-300">AI Smart Router Planner</span>
          </div>
          <p className="text-xs text-surface-500">
            Built with React, Express, Dijkstra, A*, and AI Scoring • Map data © OpenStreetMap contributors
          </p>
        </div>
      </footer>
    </div>
  );
}
