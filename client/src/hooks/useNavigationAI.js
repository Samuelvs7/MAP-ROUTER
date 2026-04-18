import { useCallback, useEffect, useRef, useState } from 'react';
import { aiChat, aiNavigationEvent, getNearbyImages } from '../services/api';

const TRAFFIC_CHECK_INTERVAL_MS = 15000;
const TRAFFIC_ALERT_COOLDOWN_MS = 30000;

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
      text: "I'm your navigation co-pilot. Ask about route tradeoffs, traffic, safer alternatives, or nearby stops anytime.",
      timestamp: Date.now(),
    },
  ]);
  const [images, setImages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  const mountedRef = useRef(true);
  const lastAnalyzedRouteRef = useRef(null);
  const lastDestinationRef = useRef(null);
  const trafficMonitorRef = useRef(null);
  const lastTrafficAlertRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const addMessage = useCallback((message) => {
    if (!mountedRef.current) return;

    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: `${message.type || 'text'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!currentRoute || !destination) return;

    const routeKey = `${destination.lat}-${destination.lon}-${currentRoute.index}-${currentRoute.adjustedDuration || currentRoute.duration}`;
    if (routeKey === lastAnalyzedRouteRef.current) return;
    lastAnalyzedRouteRef.current = routeKey;

    const analyzeRoute = async () => {
      setIsThinking(true);
      try {
        const res = await aiNavigationEvent({
          event: 'route_selected',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute.trafficScore || trafficScore,
          totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
          totalDistanceMeters: currentRoute.distance || 0,
          weather,
        });

        if (!mountedRef.current) return;
        if (res.data?.analysis) {
          addMessage({ role: 'assistant', type: 'text', text: res.data.analysis });
        }

        if (res.data?.images?.length > 0) {
          setImages(res.data.images);
          addMessage({
            role: 'assistant',
            type: 'images',
            text: `Street-level views near ${destination.name || 'your destination'}.`,
            images: res.data.images,
          });
        }
      } catch {
        addMessage({
          role: 'assistant',
          type: 'text',
          text: `Route ready for ${destination.name || 'your trip'}. I'll keep watching traffic and route quality.`,
        });
      } finally {
        if (mountedRef.current) setIsThinking(false);
      }
    };

    analyzeRoute();
  }, [
    currentRoute,
    destination,
    source,
    weather,
    trafficLevel,
    trafficScore,
    addMessage,
    allRoutes,
  ]);

  useEffect(() => {
    if (!destination?.lat || !destination?.lon) {
      setImages([]);
      return;
    }

    const destinationKey = `${destination.lat}-${destination.lon}`;
    if (destinationKey === lastDestinationRef.current) return;
    lastDestinationRef.current = destinationKey;

    if (currentRoute) return;

    const fetchImages = async () => {
      try {
        const res = await getNearbyImages(destination.lat, destination.lon, 4);
        if (!mountedRef.current) return;
        setImages(res.data?.images || []);
      } catch {
        // Soft failure.
      }
    };

    fetchImages();
  }, [destination, currentRoute]);

  useEffect(() => {
    if (!navigating || !source || !destination) return;

    const notifyStart = async () => {
      setIsThinking(true);
      try {
        const res = await aiNavigationEvent({
          event: 'navigation_started',
          lat: destination.lat,
          lon: destination.lon,
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
          trafficScore: currentRoute?.trafficScore || trafficScore,
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
          text: "Navigation started. I'll keep tracking traffic and let you know when another route becomes clearly better.",
        });
      } finally {
        if (mountedRef.current) setIsThinking(false);
      }
    };

    notifyStart();
  }, [
    navigating,
    source,
    destination,
    currentRoute,
    weather,
    trafficLevel,
    trafficScore,
    addMessage,
    allRoutes,
  ]);

  useEffect(() => {
    if (!navigating || !source || !destination || !currentRoute) {
      if (trafficMonitorRef.current) clearInterval(trafficMonitorRef.current);
      return;
    }

    trafficMonitorRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      const level = currentRoute.trafficLevel || trafficLevel;
      const score = currentRoute.trafficScore || trafficScore;
      const now = Date.now();

      if (!level || (level === 'light' && score < 30)) return;
      if (now - lastTrafficAlertRef.current < TRAFFIC_ALERT_COOLDOWN_MS) return;

      lastTrafficAlertRef.current = now;

      try {
        const res = await aiNavigationEvent({
          event: 'traffic_detected',
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: level,
          trafficScore: score,
          trafficDelaySeconds: currentRoute.trafficDelay || 0,
          totalDurationSeconds: currentRoute.adjustedDuration || currentRoute.duration || 0,
          totalDistanceMeters: currentRoute.distance || 0,
        });

        if (!mountedRef.current) return;
        if (res.data?.analysis && (level === 'heavy' || score > 55)) {
          addMessage({
            role: 'assistant',
            type: 'traffic-alert',
            text: res.data.analysis,
            trafficLevel: level,
          });
        }
      } catch {
        // Background monitoring should stay quiet on failure.
      }
    }, TRAFFIC_CHECK_INTERVAL_MS);

    return () => clearInterval(trafficMonitorRef.current);
  }, [
    navigating,
    source,
    destination,
    currentRoute,
    trafficLevel,
    trafficScore,
    addMessage,
    allRoutes,
  ]);

  useEffect(() => {
    if (!switchSuggestion?.requiresConfirmation) return;

    const askForSwitch = async () => {
      setIsThinking(true);
      try {
        const res = await aiNavigationEvent({
          event: 'reroute_available',
          source,
          destination,
          currentRoute,
          allRoutes,
          trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'heavy',
          trafficScore: currentRoute?.trafficScore || trafficScore,
          timeSavedSeconds: switchSuggestion.timeSaved || 0,
          totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
          totalDistanceMeters: currentRoute?.distance || 0,
        });

        if (!mountedRef.current) return;

        addMessage({
          role: 'assistant',
          type: 'switch-suggestion',
          text: res.data?.analysis || switchSuggestion.message,
          suggestion: switchSuggestion,
        });
      } catch {
        addMessage({
          role: 'assistant',
          type: 'switch-suggestion',
          text: switchSuggestion.message || 'I found a faster route. Do you want me to switch?',
          suggestion: switchSuggestion,
        });
      } finally {
        if (mountedRef.current) {
          setPendingSuggestion(switchSuggestion);
          setIsThinking(false);
        }
      }
    };

    askForSwitch();
  }, [
    switchSuggestion,
    source,
    destination,
    currentRoute,
    trafficLevel,
    trafficScore,
    addMessage,
    allRoutes,
  ]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || isThinking) return;

    addMessage({ role: 'user', type: 'text', text: trimmed });
    setIsThinking(true);

    try {
      const res = await aiChat(trimmed, {
        source,
        destination,
        currentRoute,
        allRoutes,
        trafficLevel: currentRoute?.trafficLevel || trafficLevel || 'unknown',
        trafficScore: currentRoute?.trafficScore || trafficScore || 0,
        trafficDelaySeconds: currentRoute?.trafficDelay || 0,
        weather,
        totalDurationSeconds: currentRoute?.adjustedDuration || currentRoute?.duration || 0,
        totalDistanceMeters: currentRoute?.distance || 0,
      });

      if (!mountedRef.current) return;

      const data = res.data || {};
      const reply = data.reply || "I couldn't process that right now. Please try again.";

      if (data.hasImages && data.images?.length > 0) {
        setImages(data.images);
        addMessage({ role: 'assistant', type: 'images', text: reply, images: data.images });
      } else {
        addMessage({ role: 'assistant', type: 'text', text: reply });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      addMessage({
        role: 'assistant',
        type: 'text',
        text: 'I hit a connection issue while checking your route context. Please try again in a moment.',
      });
    } finally {
      if (mountedRef.current) setIsThinking(false);
    }
  }, [
    isThinking,
    addMessage,
    source,
    destination,
    currentRoute,
    allRoutes,
    trafficLevel,
    trafficScore,
    weather,
  ]);

  const acceptSuggestion = useCallback(() => {
    if (!pendingSuggestion) return null;

    addMessage({
      role: 'user',
      type: 'text',
      text: 'Yes, switch me to the faster route.',
    });
    addMessage({
      role: 'assistant',
      type: 'text',
      text: "Done. I've switched to the faster route and will keep monitoring the trip from here.",
    });

    const suggestion = pendingSuggestion;
    setPendingSuggestion(null);
    return suggestion;
  }, [pendingSuggestion, addMessage]);

  const dismissSuggestion = useCallback(() => {
    addMessage({
      role: 'user',
      type: 'text',
      text: 'Keep the current route for now.',
    });
    addMessage({
      role: 'assistant',
      type: 'text',
      text: "Understood. I'll keep watching the route and let you know if conditions change again.",
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
