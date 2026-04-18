import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock3,
  CloudSun,
  Loader2,
  MapPin,
  MessageSquare,
  Route,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';

const QUICK_PROMPTS = [
  'How is traffic on this route?',
  'Is there a faster alternative right now?',
  'Suggest a good stop along the way.',
  'What should I know before arriving?',
];

export default function AIAssistantPanel({
  messages = [],
  images = [],
  isThinking = false,
  pendingSuggestion = null,
  onSendMessage,
  onAcceptSwitch,
  onDismissSwitch,
  variant = 'grid',
  source = null,
  destination = null,
  currentRoute = null,
  weather = null,
  navigating = false,
}) {
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking, pendingSuggestion]);

  const handleSend = () => {
    const value = draft.trim();
    if (!value || isThinking) return;
    onSendMessage?.(value);
    setDraft('');
  };

  const handleQuickPrompt = (prompt) => {
    if (isThinking) return;
    onSendMessage?.(prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  );
  const latestUserMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'user'),
    [messages],
  );
  const latestImageMessage = useMemo(
    () => [...messages].reverse().find((message) => message.type === 'images' && message.images?.length > 0),
    [messages],
  );

  const activeImages = latestImageMessage?.images?.length > 0 ? latestImageMessage.images : images;
  const trafficLevel = currentRoute?.trafficLevel || 'unknown';
  const trafficColors = {
    heavy: '#fca5a5',
    moderate: '#fde68a',
    light: '#86efac',
    unknown: '#cbd5e1',
  };
  const trafficTone = trafficColors[trafficLevel] || trafficColors.unknown;

  const insightCards = [
    {
      icon: Route,
      label: 'Current route',
      value: currentRoute ? fmtDuration(currentRoute.adjustedDuration || currentRoute.duration) : 'Waiting',
      meta: currentRoute ? fmtDistance(currentRoute.distance) : 'Select a route to analyze',
    },
    {
      icon: AlertTriangle,
      label: 'Traffic',
      value: titleCase(trafficLevel),
      meta:
        currentRoute?.trafficDelay > 0
          ? `+${Math.round(currentRoute.trafficDelay / 60)} min delay`
          : navigating
            ? 'Live monitoring on'
            : 'No active alerts',
      accent: trafficTone,
    },
    {
      icon: MapPin,
      label: 'Destination',
      value: destination?.name?.split(',').slice(0, 2).join(', ') || 'Not set',
      meta: source?.name ? `From ${source.name.split(',').slice(0, 2).join(', ')}` : 'Route context will appear here',
    },
    {
      icon: CloudSun,
      label: 'Weather',
      value: weather?.condition || 'Clear',
      meta:
        weather?.temperature != null
          ? `${Math.round(weather.temperature)} C${weather.description ? ` · ${weather.description}` : ''}`
          : 'No weather data yet',
    },
  ];

  if (variant === 'compact') {
    return (
      <CompactAssistantPanel
        messages={messages}
        isThinking={isThinking}
        pendingSuggestion={pendingSuggestion}
        draft={draft}
        inputRef={inputRef}
        chatEndRef={chatEndRef}
        onDraftChange={setDraft}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        onQuickPrompt={handleQuickPrompt}
        onAcceptSwitch={onAcceptSwitch}
        onDismissSwitch={onDismissSwitch}
      />
    );
  }

  return (
    <div
      className="ai-assistant-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,0.94))',
      }}
    >
      <div className="ai-assistant-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 24px rgba(37,99,235,0.24)',
              flexShrink: 0,
            }}
          >
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>Navigation Assistant</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              {isThinking ? 'Reviewing your route, destination, and traffic signals...' : 'Grounded in your current route, traffic, and destination context'}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: isThinking ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
            color: isThinking ? '#fcd34d' : '#86efac',
            fontSize: 11,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {isThinking ? 'Thinking' : 'Live'}
        </div>
      </div>

      <div className="ai-assistant-panel__body">
        <section className="ai-assistant-panel__section">
          <SectionHeading
            eyebrow="Prompt launcher"
            title="Suggested Questions"
            description="Start with route-aware prompts tailored to the trip in front of you."
          />

          <div className="ai-assistant-panel__prompt-list">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleQuickPrompt(prompt)}
                disabled={isThinking}
                className="ai-assistant-panel__prompt-button"
                style={{
                  cursor: isThinking ? 'default' : 'pointer',
                  opacity: isThinking ? 0.6 : 1,
                }}
              >
                <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{prompt}</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>
                  Send this directly to the assistant
                </span>
              </button>
            ))}
          </div>

          <div className="ai-assistant-panel__context-note">
            Live context: {currentRoute ? `${fmtDistance(currentRoute.distance)} trip` : 'no route selected yet'}
            {destination?.name ? ` to ${destination.name.split(',').slice(0, 2).join(', ')}` : ''}.
          </div>
        </section>

        <section className="ai-assistant-panel__section">
          <SectionHeading
            eyebrow="Conversation"
            title="Chat Input / Interaction"
            description="Ask for traffic insight, reroutes, stop ideas, and arrival tips without leaving the planner."
          />

          <div className="ai-assistant-panel__chat-scroll">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isThinking && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 16,
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.14)',
                  color: '#bfdbfe',
                  fontSize: 12,
                }}
              >
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                Analyzing route context...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="ai-assistant-panel__composer">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about traffic, better routes, nearby food, or arrival tips..."
              disabled={isThinking}
              className="input-field"
              style={{
                minHeight: 90,
                maxHeight: 180,
                resize: 'vertical',
                borderRadius: 18,
                padding: '14px 16px',
                background: 'rgba(15,23,42,0.92)',
                lineHeight: 1.55,
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isThinking}
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                border: 'none',
                cursor: isThinking ? 'default' : 'pointer',
                background: isThinking ? 'rgba(148,163,184,0.2)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isThinking ? 'none' : '0 12px 22px rgba(37,99,235,0.24)',
              }}
            >
              <Send style={{ width: 17, height: 17 }} />
            </button>
          </div>
        </section>

        <section className="ai-assistant-panel__section ai-assistant-panel__section--insights">
          <SectionHeading
            eyebrow="Status board"
            title="Live Insights / Response"
            description="See the latest assistant answer alongside route, weather, and traffic signals."
          />

          <div className="ai-assistant-panel__insight-cards">
            {insightCards.map((card) => (
              <InsightCard key={card.label} {...card} />
            ))}
          </div>

          <div className="ai-assistant-panel__response-wrap">
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 18,
                border: '1px solid rgba(148,163,184,0.14)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#93c5fd',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                <MessageSquare style={{ width: 14, height: 14 }} />
                Latest response
              </div>
              {latestAssistantMessage ? (
                <MessageBubble message={latestAssistantMessage} compact />
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
                  The assistant will summarize route context here once the first response arrives.
                </div>
              )}
            </div>

            {latestUserMessage && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 18,
                  border: '1px solid rgba(59,130,246,0.14)',
                  background: 'rgba(37,99,235,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#bfdbfe',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  <Clock3 style={{ width: 14, height: 14 }} />
                  Last prompt
                </div>
                <div style={{ color: '#e0f2fe', fontSize: 13, lineHeight: 1.6 }}>{latestUserMessage.text}</div>
              </div>
            )}

            {pendingSuggestion && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 18,
                  border: '1px solid rgba(34,197,94,0.22)',
                  background: 'rgba(34,197,94,0.08)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#bbf7d0', marginBottom: 12 }}>
                  Faster route available
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <button
                    type="button"
                    onClick={onAcceptSwitch}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 14,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <CheckCircle style={{ width: 14, height: 14 }} />
                    Switch route
                  </button>
                  <button
                    type="button"
                    onClick={onDismissSwitch}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 14,
                      border: '1px solid rgba(148,163,184,0.18)',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <XCircle style={{ width: 14, height: 14 }} />
                    Keep current
                  </button>
                </div>
              </div>
            )}

            {activeImages?.length > 0 && (
              <div className="ai-assistant-panel__image-strip">
                {activeImages.slice(0, 4).map((image) => (
                  <a key={image.id || image.url} href={image.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <img
                      src={image.url}
                      alt="Street view"
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: 92,
                        objectFit: 'cover',
                        borderRadius: 14,
                        border: '1px solid rgba(148,163,184,0.16)',
                      }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompactAssistantPanel({
  messages,
  isThinking,
  pendingSuggestion,
  draft,
  inputRef,
  chatEndRef,
  onDraftChange,
  onSend,
  onKeyDown,
  onQuickPrompt,
  onAcceptSwitch,
  onDismissSwitch,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.92))',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(148,163,184,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(37,99,235,0.25)',
            }}
          >
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>Navigation Assistant</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {isThinking ? 'Reviewing your trip context...' : 'Grounded in your current route and traffic data'}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: isThinking ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
            color: isThinking ? '#fcd34d' : '#86efac',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {isThinking ? 'Thinking' : 'Live'}
        </div>
      </div>

      <div style={{ padding: '12px 14px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onQuickPrompt(prompt)}
            disabled={isThinking}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.15)',
              background: 'rgba(255,255,255,0.03)',
              color: '#cbd5e1',
              fontSize: 11,
              cursor: isThinking ? 'default' : 'pointer',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {pendingSuggestion && (
          <div
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            }}
          >
            <button
              type="button"
              onClick={onAcceptSwitch}
              style={{
                padding: '11px 14px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <CheckCircle style={{ width: 14, height: 14 }} />
              Switch Route
            </button>
            <button
              type="button"
              onClick={onDismissSwitch}
              style={{
                padding: '11px 14px',
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.18)',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)',
                color: '#cbd5e1',
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <XCircle style={{ width: 14, height: 14 }} />
              Keep Current Route
            </button>
          </div>
        )}

        {isThinking && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.14)',
              color: '#bfdbfe',
              fontSize: 12,
            }}
          >
            <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            Analyzing route context...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div
        style={{
          padding: '12px 14px 14px',
          borderTop: '1px solid rgba(148,163,184,0.12)',
          background: 'rgba(2,6,23,0.5)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about traffic, better routes, nearby food, or arrival tips..."
            disabled={isThinking}
            className="input-field"
            style={{
              minHeight: 74,
              maxHeight: 160,
              resize: 'vertical',
              borderRadius: 18,
              padding: '12px 14px',
              background: 'rgba(15,23,42,0.92)',
            }}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={isThinking}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              border: 'none',
              cursor: isThinking ? 'default' : 'pointer',
              background: isThinking ? 'rgba(148,163,184,0.2)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isThinking ? 'none' : '0 10px 20px rgba(37,99,235,0.25)',
            }}
          >
            <Send style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="ai-assistant-panel__section-header">
      <div className="ai-assistant-panel__eyebrow">{eyebrow}</div>
      <div className="ai-assistant-panel__title">{title}</div>
      <div className="ai-assistant-panel__description">{description}</div>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, meta, accent = '#93c5fd' }) {
  return (
    <div className="ai-assistant-panel__insight-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: accent }}>
        <Icon style={{ width: 14, height: 14 }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </span>
      </div>
      <div style={{ marginTop: 10, color: '#f8fafc', fontSize: 15, fontWeight: 800, lineHeight: 1.4 }}>
        {value}
      </div>
      <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{meta}</div>
    </div>
  );
}

function MessageBubble({ message, compact = false }) {
  const { role, type, text, images, trafficLevel } = message;
  const isUser = role === 'user';
  const isTrafficAlert = type === 'traffic-alert';
  const isSwitchSuggestion = type === 'switch-suggestion';
  const isImageMessage = type === 'images';

  const accent = isTrafficAlert
    ? trafficLevel === 'heavy'
      ? '#f87171'
      : '#fbbf24'
    : isSwitchSuggestion
      ? '#60a5fa'
      : isImageMessage
        ? '#4ade80'
        : '#93c5fd';

  const label = isTrafficAlert
    ? 'Traffic Alert'
    : isSwitchSuggestion
      ? 'Route Recommendation'
      : isImageMessage
        ? 'Nearby Views'
        : isUser
          ? 'You'
          : 'Co-Pilot';

  const icon = isTrafficAlert
    ? <AlertTriangle style={{ width: 13, height: 13, color: accent }} />
    : isImageMessage
      ? <MapPin style={{ width: 13, height: 13, color: accent }} />
      : <Bot style={{ width: 13, height: 13, color: accent }} />;

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: compact ? '100%' : isUser ? '82%' : '94%',
        width: compact ? '100%' : 'auto',
      }}
    >
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, color: accent, fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {icon}
          {label}
        </div>
      )}

      <div
        style={{
          padding: compact ? '10px 12px' : '11px 14px',
          borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(37,99,235,0.22), rgba(14,165,233,0.12))'
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isUser ? 'rgba(59,130,246,0.24)' : 'rgba(148,163,184,0.12)'}`,
          color: isUser ? '#eff6ff' : '#dbeafe',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.65,
          fontSize: compact ? 12 : 13,
        }}
      >
        {text}
      </div>

      {isImageMessage && images?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
          {images.map((image) => (
            <a key={image.id || image.url} href={image.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              <img
                src={image.url}
                alt="Street view"
                loading="lazy"
                style={{
                  width: '100%',
                  height: 92,
                  objectFit: 'cover',
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDistance(meters = 0) {
  if (!Number.isFinite(meters)) return '--';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(meters))} m`;
}

function fmtDuration(seconds = 0) {
  if (!Number.isFinite(seconds)) return '--';
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

function titleCase(value) {
  if (!value) return 'Unknown';
  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
