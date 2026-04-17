import axios from 'axios';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 15000;

const DEFAULT_SWITCH_MESSAGE = 'There is traffic ahead. A faster route is available. Shall I switch?';

function extractText(responseData) {
  const parts = responseData?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const textPart = parts.find((part) => typeof part?.text === 'string');
  return textPart?.text?.trim() || null;
}

function getGeminiApiUrl() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] No GEMINI_API_KEY set — using fallback responses');
    return null;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

export async function testGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      model: GEMINI_MODEL,
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [{ parts: [{ text: 'Hello' }] }],
      },
      {
        timeout: GEMINI_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    return {
      success: true,
      model: GEMINI_MODEL,
      data: response.data,
    };
  } catch (err) {
    return {
      success: false,
      model: GEMINI_MODEL,
      status: err.response?.status || 500,
      error: err.response?.data?.error?.message || err.message,
      details: err.response?.data || null,
    };
  }
}
async function generateGeminiText(prompt, generationConfig = {}) {
  const url = getGeminiApiUrl();
  if (!url) return null;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 500,
          ...generationConfig,
        },
      },
      {
        timeout: GEMINI_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const text = extractText(response.data);
    if (!text) {
      console.warn('[Gemini] No text in response:', response.data?.candidates?.[0]?.finishReason);
      return null;
    }
    return text.trim();
  } catch (err) {
    console.error('[Gemini] API error:', err.response?.status, err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ─── NEW: Intelligent Analysis (ChatGPT-like response) ───
export async function generateIntelligentAnalysis(context = {}) {
  const {
    event = 'general',
    source = {},
    destination = {},
    currentRoute = null,
    alternativeRoute = null,
    trafficLevel = 'unknown',
    trafficScore = 0,
    timeSavedSeconds = 0,
    totalDurationSeconds = 0,
    totalDistanceMeters = 0,
    weather = null,
    userMessage = '',
  } = context;

  const timeSavedMin = Math.round(timeSavedSeconds / 60);
  const durationMin = Math.round(totalDurationSeconds / 60);
  const distanceKm = (totalDistanceMeters / 1000).toFixed(1);
  const delayMin = currentRoute?.trafficDelay ? Math.round(currentRoute.trafficDelay / 60) : 0;

  let situationPrompt = '';

  switch (event) {
    case 'route_selected':
      situationPrompt = [
        `The user just selected a route from ${source.name || 'their location'} to ${destination.name || 'their destination'}.`,
        `Route distance: ${distanceKm} km, estimated time: ${durationMin} minutes.`,
        weather ? `Weather at destination: ${weather.condition}, ${weather.temperature}°C.` : '',
        `Traffic level: ${trafficLevel}.`,
        '',
        'Give a brief, friendly welcome message about their trip. Mention any notable info (weather, traffic). Be conversational like a smart co-pilot. Keep it 2-3 sentences max.',
      ].filter(Boolean).join('\n');
      break;

    case 'traffic_detected':
      situationPrompt = [
        `The user is navigating from ${source.name || 'origin'} to ${destination.name || 'destination'}.`,
        `Current traffic level: ${trafficLevel} (score: ${trafficScore}/100).`,
        `Current route ETA: ${durationMin} minutes, distance: ${distanceKm} km.`,
        delayMin > 0 ? `Estimated traffic delay: ~${delayMin} minutes.` : '',
        '',
        'Inform the user about the current traffic situation naturally. Be concise and helpful. If traffic is high, express concern. If moderate, reassure them. 2-3 sentences max.',
      ].filter(Boolean).join('\n');
      break;

    case 'reroute_available':
      situationPrompt = [
        `The user is traveling from ${source.name || 'origin'} to ${destination.name || 'destination'}.`,
        `Heavy traffic detected on current route adding ~${delayMin} minutes delay.`,
        `Current route: ${durationMin} min, ${distanceKm} km.`,
        alternativeRoute ? `Faster alternative found: saves ~${timeSavedMin} minutes.` : '',
        '',
        'Explain the traffic situation clearly and suggest the faster route. Be specific about time saved. End with asking if they want to switch. Sound like a helpful AI co-pilot, NOT a robot. Example tone: "There\'s heavy traffic ahead adding about 10 minutes to your trip. I found a faster route that saves 8 minutes. Would you like me to switch?"',
      ].filter(Boolean).join('\n');
      break;

    case 'navigation_started':
      situationPrompt = [
        `Navigation started from ${source.name || 'origin'} to ${destination.name || 'destination'}.`,
        `Route: ${distanceKm} km, ETA: ${durationMin} minutes.`,
        `Traffic: ${trafficLevel}.`,
        '',
        'Give a brief, encouraging start message. Mention you\'ll monitor traffic and suggest better routes if needed. 1-2 sentences. Be warm and confident.',
      ].filter(Boolean).join('\n');
      break;

    case 'chat':
      situationPrompt = [
        'The user is chatting with you during navigation.',
        `Current route: ${source.name || 'origin'} → ${destination.name || 'destination'}, ${distanceKm} km, ~${durationMin} min.`,
        `Traffic: ${trafficLevel} (score: ${trafficScore}/100).`,
        weather ? `Weather: ${weather.condition}, ${weather.temperature}°C.` : '',
        delayMin > 0 ? `Current traffic delay: ~${delayMin} minutes.` : '',
        '',
        `User message: "${userMessage}"`,
        '',
        'IMPORTANT RULES FOR YOUR RESPONSE:',
        '- If user asks about places/tourist spots: Suggest 3-5 places within 5-10km of the route with name, type (Scenic/Food/Landmark), and reason to visit.',
        '- If user asks about traffic: Explain current traffic clearly, mention delay if any.',
        '- If user asks about route: Give distance, ETA, road conditions if known.',
        '- If user asks general questions: Answer like ChatGPT would — knowledgeable and helpful.',
        '- Be conversational, natural, and concise (2-5 sentences unless listing places).',
        '- Never say you cannot help. Always try to give useful information.',
      ].filter(Boolean).join('\n');
      break;

    default:
      situationPrompt = [
        `Context: Route from ${source.name || 'origin'} to ${destination.name || 'destination'}.`,
        `Distance: ${distanceKm} km, ETA: ${durationMin} min, Traffic: ${trafficLevel}.`,
        userMessage ? `User says: "${userMessage}"` : '',
        '',
        'Respond as a smart, multi-purpose AI assistant. Handle navigation, travel tips, route optimization, and general questions. Be conversational and helpful.',
      ].filter(Boolean).join('\n');
  }

  const systemPrompt = [
    'You are an intelligent AI Navigation Assistant integrated into a smart map routing system.',
    'Your role is to behave like ChatGPT combined with Google Maps intelligence.',
    '',
    'CORE CAPABILITIES:',
    '1. ROUTE UNDERSTANDING: You understand routes, distances, ETA, and alternative paths.',
    '2. TOURIST/SCENIC ANALYSIS: Suggest places along routes (famous places, scenic spots, food/restaurants, hidden gems) with reasons.',
    '3. KNOWLEDGE: If system lacks data, use your general knowledge. Provide descriptions, importance, what to see/do.',
    '4. TRAFFIC AWARENESS: Analyze traffic data (delay time, congestion level). If route is inefficient, suggest alternatives.',
    '5. DECISION MAKING: NEVER auto-change routes. ALWAYS ask user first. Example: "There is heavy traffic ahead. An alternative route can save 20 minutes. Would you like to switch?"',
    '',
    'RESPONSE STYLE:',
    '- Be natural, clear, and helpful (like ChatGPT)',
    '- Keep responses short (2-4 lines unless listing places)',
    '- No markdown formatting, no fake links/images',
    '- Never say "I am an AI" — just help naturally',
    '- Handle: navigation queries, travel suggestions, route optimization, AND general questions',
  ].join('\n');

  const fullPrompt = `${systemPrompt}\n\n${situationPrompt}`;

  try {
    const text = await generateGeminiText(fullPrompt, {
      temperature: 0.5,
      maxOutputTokens: 300,
    });
    return text || buildFallbackAnalysis(event, context);
  } catch {
    return buildFallbackAnalysis(event, context);
  }
}

function buildFallbackAnalysis(event, context = {}) {
  const { source = {}, destination = {}, trafficLevel = 'unknown', timeSavedSeconds = 0 } = context;
  const timeSavedMin = Math.round(timeSavedSeconds / 60);
  const srcName = source.name || 'your location';
  const dstName = destination.name || 'your destination';

  switch (event) {
    case 'route_selected':
      return `Route set from ${srcName} to ${dstName}. I'll keep an eye on traffic and conditions for you.`;
    case 'traffic_detected':
      return `Traffic is currently ${trafficLevel} on your route. I'm monitoring for changes.`;
    case 'reroute_available':
      return timeSavedMin > 0
        ? `There's heavy traffic ahead. I found a faster route that saves about ${timeSavedMin} minutes. Would you like me to switch?`
        : DEFAULT_SWITCH_MESSAGE;
    case 'navigation_started':
      return `Navigation started! I'll monitor traffic and suggest better routes if I find any.`;
    default:
      return 'I\'m here to help with your navigation. Ask me anything about your route, traffic, or nearby places.';
  }
}

// ─── Existing functions (kept for backward compat) ───

export async function generateSwitchMessage({ timeSavedMinutes, context = {} } = {}) {
  // Enhanced: use intelligent analysis if context is available
  if (context.source && context.destination) {
    const analysis = await generateIntelligentAnalysis({
      event: 'reroute_available',
      ...context,
      timeSavedSeconds: (timeSavedMinutes || 1) * 60,
    });
    return analysis;
  }

  // Legacy fallback
  const prompt = [
    'You are an AI navigation co-pilot. Traffic is heavy ahead.',
    `A faster route saves about ${Math.max(1, Math.round(Number(timeSavedMinutes) || 0))} minutes.`,
    'Write a brief, natural message explaining this and asking if the user wants to switch. 1-2 sentences. No markdown.',
  ].join(' ');

  try {
    const text = await generateGeminiText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 100,
    });
    const cleaned = text ? text.replace(/^["'`\s]+|["'`\s]+$/g, '') : '';
    return cleaned || DEFAULT_SWITCH_MESSAGE;
  } catch {
    return DEFAULT_SWITCH_MESSAGE;
  }
}

function fallbackSearchSummary(query, results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return `No reliable search results were found for "${query}". Try a more specific query.`;
  }

  const headline = results
    .slice(0, 3)
    .map((result, idx) => `${idx + 1}. ${result.title}`)
    .join(' ');

  return `Top results for "${query}": ${headline}`;
}

export async function summarizeSearchResults({ query, results = [] } = {}) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return 'Search query is empty.';

  if (!Array.isArray(results) || results.length === 0) {
    return fallbackSearchSummary(normalizedQuery, []);
  }

  const compactResults = results.slice(0, 6).map((item, index) => ({
    rank: index + 1,
    title: item.title,
    snippet: item.snippet,
    source: item.source,
    link: item.link,
  }));

  const prompt = [
    'You are an assistant in a smart routing app.',
    'Summarize the web search results in 3 short bullet points.',
    'Keep it factual, concise, and useful for a traveler.',
    `Query: ${normalizedQuery}`,
    `Results JSON: ${JSON.stringify(compactResults)}`,
  ].join('\n');

  try {
    const text = await generateGeminiText(prompt, {
      temperature: 0.25,
      maxOutputTokens: 220,
    });
    return text || fallbackSearchSummary(normalizedQuery, compactResults);
  } catch {
    return fallbackSearchSummary(normalizedQuery, compactResults);
  }
}

const DEFAULT_CHAT_FALLBACK =
  'I can help with routing, traffic, places, and trip planning. Please try again in a moment.';

export async function generateChatReply({ message, context = {} } = {}) {
  // Enhanced: use intelligent analysis for richer responses
  if (context.source || context.destination) {
    try {
      const analysis = await generateIntelligentAnalysis({
        event: 'chat',
        source: context.source || {},
        destination: context.destination || {},
        trafficLevel: context.trafficLevel || 'unknown',
        weather: context.weather || null,
        totalDurationSeconds: context.totalDurationSeconds || 0,
        totalDistanceMeters: context.totalDistanceMeters || 0,
        userMessage: message,
      });
      if (analysis) return analysis;
    } catch {
      // Fall through to legacy
    }
  }

  const userMessage = String(message || '').trim();
  if (!userMessage) return 'Please type a question.';

  const prompt = [
    'You are the AI assistant of an intelligent route planner web app.',
    'Be concise, practical, and traveler-focused.',
    'If a route switch is safer/faster, mention it briefly.',
    `Context JSON: ${JSON.stringify(context || {})}`,
    `User message: ${userMessage}`,
  ].join('\n');

  try {
    const text = await generateGeminiText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 240,
    });
    return text || DEFAULT_CHAT_FALLBACK;
  } catch {
    return DEFAULT_CHAT_FALLBACK;
  }
}

export { DEFAULT_SWITCH_MESSAGE };

export default {
  testGeminiConnection,
  generateSwitchMessage,
  generateIntelligentAnalysis,
  summarizeSearchResults,
  generateChatReply,
};
