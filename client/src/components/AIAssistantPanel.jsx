import { useEffect, useRef } from 'react';
import { Bot, Loader2, Send, AlertTriangle, CheckCircle, XCircle, Sparkles, MapPin } from 'lucide-react';

/**
 * AI Assistant Panel — Conversational AI Interface
 * 
 * No manual buttons. Everything is automatic and conversational.
 * - Route analysis appears automatically
 * - Images display inline when fetched
 * - Traffic alerts and reroute suggestions appear as AI messages
 * - User can chat naturally with full navigation context
 */
export default function AIAssistantPanel({
  messages = [],
  images = [],
  isThinking = false,
  pendingSuggestion = null,
  onSendMessage,
  onAcceptSwitch,
  onDismissSwitch,
}) {
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  const handleSend = () => {
    const val = inputRef.current?.value?.trim();
    if (!val || isThinking) return;
    onSendMessage?.(val);
    inputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--panel)', borderRadius: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(135deg, rgba(66,133,244,0.08), rgba(52,168,83,0.06))',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4285f4, #34a853)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(66,133,244,0.3)',
        }}>
          <Sparkles style={{ width: 16, height: 16, color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>AI Co-Pilot</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isThinking ? '#f59e0b' : '#34a853',
              display: 'inline-block',
              animation: isThinking ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }} />
            {isThinking ? 'Analyzing...' : 'Monitoring your route'}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Pending switch suggestion buttons */}
        {pendingSuggestion && (
          <div style={{
            display: 'flex', gap: 8, padding: '4px 0',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <button
              onClick={onAcceptSwitch}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #34a853, #1e8e3e)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(52,168,83,0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(52,168,83,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(52,168,83,0.3)'; }}
            >
              <CheckCircle style={{ width: 14, height: 14 }} />
              Switch Route
            </button>
            <button
              onClick={onDismissSwitch}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              <XCircle style={{ width: 14, height: 14 }} />
              Keep Current
            </button>
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 12,
            background: 'rgba(66,133,244,0.06)', border: '1px solid rgba(66,133,244,0.1)',
          }}>
            <Loader2 style={{ width: 14, height: 14, color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--border)',
        background: 'var(--panel-alt)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder="Ask about routes, traffic, or places..."
            className="input-field"
            disabled={isThinking}
            style={{
              flex: 1, padding: '10px 14px', fontSize: 12,
              borderRadius: 20, border: '1px solid var(--border)',
              background: 'var(--panel)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isThinking}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: 'none', cursor: isThinking ? 'default' : 'pointer',
              background: isThinking ? 'var(--panel-alt)' : 'linear-gradient(135deg, #4285f4, #1a73e8)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isThinking ? 'none' : '0 2px 8px rgba(66,133,244,0.3)',
              transition: 'all 0.2s',
            }}
          >
            <Send style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble Component ───
function MessageBubble({ message }) {
  const { role, type, text, images: msgImages, trafficLevel } = message;
  const isUser = role === 'user';

  // Traffic alert styling
  const isTrafficAlert = type === 'traffic-alert';
  const isSwitchSuggestion = type === 'switch-suggestion';
  const isImageMessage = type === 'images';

  const getBorderColor = () => {
    if (isTrafficAlert) {
      if (trafficLevel === 'heavy') return 'rgba(234,67,53,0.3)';
      return 'rgba(245,158,11,0.3)';
    }
    if (isSwitchSuggestion) return 'rgba(66,133,244,0.3)';
    return isUser ? 'rgba(66,133,244,0.15)' : 'var(--border)';
  };

  const getBackground = () => {
    if (isTrafficAlert) {
      if (trafficLevel === 'heavy') return 'rgba(234,67,53,0.06)';
      return 'rgba(245,158,11,0.06)';
    }
    if (isSwitchSuggestion) return 'rgba(66,133,244,0.06)';
    return isUser ? 'rgba(66,133,244,0.12)' : 'rgba(255,255,255,0.03)';
  };

  const getIcon = () => {
    if (isTrafficAlert) return <AlertTriangle style={{ width: 13, height: 13, color: trafficLevel === 'heavy' ? '#ea4335' : '#f59e0b', flexShrink: 0 }} />;
    if (isSwitchSuggestion) return <Bot style={{ width: 13, height: 13, color: '#4285f4', flexShrink: 0 }} />;
    if (isImageMessage) return <MapPin style={{ width: 13, height: 13, color: '#34a853', flexShrink: 0 }} />;
    if (!isUser) return <Sparkles style={{ width: 12, height: 12, color: 'var(--blue)', flexShrink: 0, opacity: 0.5 }} />;
    return null;
  };

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: isUser ? '85%' : '95%',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {/* Label */}
      {!isUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 3, paddingLeft: 2,
        }}>
          {getIcon()}
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3,
            color: isTrafficAlert ? (trafficLevel === 'heavy' ? '#ea4335' : '#f59e0b') :
                   isSwitchSuggestion ? '#4285f4' : 'var(--text-muted)',
          }}>
            {isTrafficAlert ? 'Traffic Alert' :
             isSwitchSuggestion ? 'Route Suggestion' :
             isImageMessage ? 'Nearby Views' : 'AI Co-Pilot'}
          </span>
        </div>
      )}

      {/* Bubble */}
      <div style={{
        padding: '9px 13px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: getBackground(),
        border: `1px solid ${getBorderColor()}`,
        fontSize: 12.5, color: 'var(--text-dim)',
        whiteSpace: 'pre-wrap', lineHeight: 1.5,
      }}>
        {text}
      </div>

      {/* Inline Images */}
      {isImageMessage && msgImages?.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
          marginTop: 8, borderRadius: 10, overflow: 'hidden',
        }}>
          {msgImages.map((img) => (
            <a key={img.id} href={img.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              <img
                src={img.url}
                alt="Street view"
                loading="lazy"
                style={{
                  width: '100%', height: 80, objectFit: 'cover',
                  borderRadius: 8, border: '1px solid var(--border)',
                  transition: 'transform 0.2s, opacity 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
