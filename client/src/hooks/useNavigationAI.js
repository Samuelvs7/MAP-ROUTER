import { useState, useEffect, useRef, useCallback } from 'react';
import { aiNavigationEvent, aiChat, getNearbyImages } from '../services/api';

const TRAFFIC_CHECK_INTERVAL_MS = 15000;

/**
 * useNavigationAI — Automatic AI intelligence hook
 * 
 * Monitors navigation state and automatically triggers:
 * - Route analysis on route selection
 * - Image fetching on destination change
 * - Traffic monitoring during navigation
 * - Smart reroute suggestions (replaces window.confirm)
 */
export default function useNavigationAI({
  source = null,
  destination = null,
  currentRoute = null,
  navigating = false,
  trafficLevel = null,
  trafficScore = 0,
  weather = null,
  switchSuggestion = null,
  allRoutes = [],
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      type: 'text',
      text: "Hi! I'm your AI navigation co-pilot. I'll automatically monitor traffic, suggest better routes, and keep you informed throughout your trip.",
      timestamp: Date.now(),
    },
  ]);
  const [images, setImages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  const lastAnalyzedRouteRef = useRef(null);
  const lastDestinationRef = useRef(null);
  const trafficMonitorRef = useRef(null);
  const lastTrafficAlertRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const addMessage = useCallback((msg) => {
    if (!mountedRef.current) return;
    setMessages((prev) => [...prev, {
      ...msg,
      id: `${msg.type || 'text'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }]);
  }, []);

  // ── Auto-analyze on route selection ──
  useEffect(() => {
    if (!currentRoute || !destination) return;

    const routeKey = `${destination.lat}-${destination.lon}-${currentRoute.index}`;
    if (routeKey === lastAnalyzedRouteRef.current) return;
    lastAnalyzedRouteRef.current = routeKey;

    const analyzeRoute = async () => {
      if (!mountedRef.current) return;
      setIsThinking(true);
      try {
        const res = await aiNavigationEvent({
          event: 'route_selected',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          trafficLevel: currentRoute.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute.trafficScore || trafficScore,
          totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
          totalDistanceMeters: currentRoute.distance || 0,
          weather,
        });

        if (!mountedRef.current) return;

        const data = res.data;
        if (data.analysis) {
          addMessage({ role: 'assistant', type: 'text', text: data.analysis });
        }

        if (data.images?.length > 0) {
          setImages(data.images);
          addMessage({
            role: 'assistant',
            type: 'images',
            text: `📸 Here are some street views near ${destination.name || 'your destination'}:`,
            images: data.images,
          });
        }
      } catch {
        addMessage({
          role: 'assistant',
          type: 'text',
          text: `Route set to ${destination.name || 'your destination'}. I'll keep an eye on things for you.`,
        });
      } finally {
        if (mountedRef.current) setIsThinking(false);
      }
    };

    analyzeRoute();
  }, [currentRoute?.index, destination?.lat, destination?.lon]);

  // ── Auto-fetch images when destination changes (separate from route) ──
  useEffect(() => {
    if (!destination?.lat || !destination?.lon) {
      setImages([]);
      return;
    }

    const destKey = `${destination.lat}-${destination.lon}`;
    if (destKey === lastDestinationRef.current) return;
    lastDestinationRef.current = destKey;

    // Images are fetched as part of route analysis above, so only fetch standalone if no route yet
    if (currentRoute) return;

    const fetchImages = async () => {
      try {
        const res = await getNearbyImages(destination.lat, destination.lon, 4);
        if (!mountedRef.current) return;
        const imgs = res.data?.images || [];
        if (imgs.length > 0) {
          setImages(imgs);
        }
      } catch {
        // Silent fail for auto-fetch
      }
    };

    fetchImages();
  }, [destination?.lat, destination?.lon, currentRoute]);

  // ── Navigation started event ──
  useEffect(() => {
    if (!navigating || !source || !destination) return;

    const notifyStart = async () => {
      if (!mountedRef.current) return;
      setIsThinking(true);
      try {
        const res = await aiNavigationEvent({
          event: 'navigation_started',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
          weather,
        });
        if (!mountedRef.current) return;
        if (res.data?.analysis) {
          addMessage({ role: 'assistant', type: 'text', text: res.data.analysis });
        }
      } catch {
        addMessage({
          role: 'assistant',
          type: 'text',
          text: "Navigation started! I'm monitoring traffic and will suggest better routes if I find any.",
        });
      } finally {
        if (mountedRef.current) setIsThinking(false);
      }
    };

    notifyStart();
  }, [navigating]);

  // ── Traffic monitoring during navigation ──
  useEffect(() => {
    if (!navigating || !source || !destination || !currentRoute) {
      if (trafficMonitorRef.current) clearInterval(trafficMonitorRef.current);
      return;
    }

    trafficMonitorRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      const now = Date.now();
      // Prevent spamming — at least 30s between traffic alerts
      if (now - lastTrafficAlertRef.current < 30000) return;

      const level = currentRoute.trafficLevel || trafficLevel;
      const score = currentRoute.trafficScore || trafficScore;

      // Only send traffic alert if traffic is notable
      if (!level || (level === 'light' && score < 30)) return;

      lastTrafficAlertRef.current = now;

      try {
        const res = await aiNavigationEvent({
          event: 'traffic_detected',
          source,
          destination,
          currentRoute,
          trafficLevel: level,
          trafficScore: score,
          totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
          totalDistanceMeters: currentRoute.distance || 0,
        });

        if (!mountedRef.current) return;
        if (res.data?.analysis && (level === 'heavy' || score > 60)) {
          addMessage({
            role: 'assistant',
            type: 'traffic-alert',
            text: res.data.analysis,
            trafficLevel: level,
          });
        }
      } catch {
        // Silent fail for background monitoring
      }
    }, TRAFFIC_CHECK_INTERVAL_MS);

    return () => clearInterval(trafficMonitorRef.current);
  }, [navigating, source, destination, currentRoute, trafficLevel, trafficScore]);

  // ── Handle switch suggestion from backend ──
  useEffect(() => {
    if (!switchSuggestion?.requiresConfirmation) return;

    const handleSuggestion = async () => {
      if (!mountedRef.current) return;
      setIsThinking(true);

      const timeSavedMin = Math.max(1, Math.round((switchSuggestion.timeSaved || 0) / 60));

      try {
        const res = await aiNavigationEvent({
          event: 'reroute_available',
          source,
          destination,
          currentRoute,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'heavy',
          trafficScore: currentRoute?.trafficScore || trafficScore,
          timeSavedSeconds: switchSuggestion.timeSaved || 0,
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
        });

        if (!mountedRef.current) return;

        const aiText = res.data?.analysis || switchSuggestion.message ||
          `There's heavy traffic ahead. I found a faster route that saves about ${timeSavedMin} minutes. Would you like me to switch?`;

        addMessage({
          role: 'assistant',
          type: 'switch-suggestion',
          text: aiText,
          suggestion: switchSuggestion,
        });

        setPendingSuggestion(switchSuggestion);
      } catch {
        addMessage({
          role: 'assistant',
          type: 'switch-suggestion',
          text: switchSuggestion.message || `Heavy traffic detected. A faster route saves ~${timeSavedMin} minutes. Want me to switch?`,
          suggestion: switchSuggestion,
        });
        setPendingSuggestion(switchSuggestion);
      } finally {
        if (mountedRef.current) setIsThinking(false);
      }
    };

    handleSuggestion();
  }, [switchSuggestion?.proposedRouteIndex, switchSuggestion?.timeSaved]);

  // ── User sends a message ──
  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || isThinking) return;

    addMessage({ role: 'user', type: 'text', text: trimmed });
    setIsThinking(true);

    try {
      const res = await aiChat(trimmed, {
        source,
        destination,
        trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
        weather,
        totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
        totalDistanceMeters: currentRoute?.distance || 0,
        latestSearchSummary: '',
      });
      if (!mountedRef.current) return;
      const reply = res.data?.reply || 'I couldn\'t process that right now. Please try again.';
      addMessage({ role: 'assistant', type: 'text', text: reply });
    } catch {
      addMessage({
        role: 'assistant',
        type: 'text',
        text: 'Sorry, I\'m having trouble connecting. Please try again in a moment.',
      });
    } finally {
      if (mountedRef.current) setIsThinking(false);
    }
  }, [source, destination, currentRoute, trafficLevel, weather, isThinking, addMessage]);

  // ── Accept/Dismiss route switch ──
  const acceptSuggestion = useCallback(() => {
    if (!pendingSuggestion) return null;
    addMessage({
      role: 'user',
      type: 'text',
      text: '✅ Yes, switch to the faster route.',
    });
    addMessage({
      role: 'assistant',
      type: 'text',
      text: 'Done! I\'ve switched you to the faster route. Happy navigating! 🚗',
    });
    const suggestion = pendingSuggestion;
    setPendingSuggestion(null);
    return suggestion;
  }, [pendingSuggestion, addMessage]);

  const dismissSuggestion = useCallback(() => {
    addMessage({
      role: 'user',
      type: 'text',
      text: '❌ No thanks, keep current route.',
    });
    addMessage({
      role: 'assistant',
      type: 'text',
      text: 'Got it, keeping your current route. I\'ll continue monitoring and let you know if conditions change.',
    });
    setPendingSuggestion(null);
  }, [addMessage]);

  return {
    messages,
    images,
    isThinking,
    pendingSuggestion,
    sendMessage,
    acceptSuggestion,
    dismissSuggestion,
  };
}
