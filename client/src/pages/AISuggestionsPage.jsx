import { useRoute } from '../context/RouteContext';
import AIAssistantPanel from '../components/AIAssistantPanel';

export default function AISuggestionsPage() {
  const { state } = useRoute();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-alt)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Magic Assistant</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            Search (SerpAPI), street images (Mapillary), and AI chat (Gemini) in one panel.
          </div>
        </div>
        <AIAssistantPanel source={state.source} destination={state.destination} />
      </div>
    </div>
  );
}
