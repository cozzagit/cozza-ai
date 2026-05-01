import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/layout/Sidebar';
import { ModelSelector } from './components/chat/ModelSelector';
import { MessageList } from './components/chat/MessageList';
import { PromptInput } from './components/chat/PromptInput';
import { VoiceButton } from './components/voice/VoiceButton';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { useTts } from './hooks/useTts';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useSettingsStore } from './stores/settings';
import { useWorkspaceStore } from './stores/workspace';

const VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? '';

export default function App() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');

  // Settings
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);
  const ttsAutoplay = useSettingsStore((s) => s.ttsAutoplay);
  const setTtsAutoplay = useSettingsStore((s) => s.setTtsAutoplay);

  // V1 hook predisposto: subscribe (no-op) garantisce che lo store sia montato.
  // UI MVP non legge `active`. Esposto su window.__cozza per debug.
  const workspaceActive = useWorkspaceStore((s) => s.active);
  useEffect(() => {
    (window as unknown as { __cozza?: unknown }).__cozza = { workspace: workspaceActive };
  }, [workspaceActive]);

  // Live data
  const conversations = useConversations();
  const messages = useMessages(conversationId);

  // TTS
  const { speak, stop: stopTts } = useTts({
    voiceId: VOICE_ID,
    enabled: ttsAutoplay && Boolean(VOICE_ID),
  });

  // Chat
  const { send, cancel, status, error, streamingText } = useChat({
    conversationId,
    model: defaultModel,
    onAssistantSentence: (sentence) => {
      void speak(sentence);
    },
    onConversationCreated: (id) => {
      setConversationId(id);
    },
  });

  // Voice → push-to-talk
  const { state: voiceState, interim, start, stop } = useVoiceInput({
    onFinalResult: (transcript) => {
      void send(transcript);
    },
    onInterimResult: setPendingPrompt,
  });

  // barge-in: any user voice starts → kill current TTS & cancel current stream
  useEffect(() => {
    if (voiceState === 'listening') {
      stopTts();
      cancel();
    }
  }, [voiceState, stopTts, cancel]);

  // Pickup new conversationId after first send
  useEffect(() => {
    if (!conversationId && conversations.length > 0 && conversations[0]) {
      setConversationId(conversations[0].id);
    }
  }, [conversations, conversationId]);

  const handleSelectConversation = (id: string | null) => {
    setConversationId(id);
    setSidebarOpen(false);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setSidebarOpen(false);
  };

  const isStreaming = status === 'streaming';

  return (
    <AppShell
      sidebar={
        <Sidebar
          open={sidebarOpen}
          conversations={conversations}
          activeId={conversationId}
          onSelect={handleSelectConversation}
          onClose={() => setSidebarOpen(false)}
          onNew={handleNewConversation}
        />
      }
      header={
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-sweet-lg mx-auto w-full">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Apri/chiudi cronologia"
            className="focus-accent md:hidden rounded-md p-2 hover:bg-white/5"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,229,255,0.8)]" aria-hidden />
            <span className="font-mono text-sm tracking-wide truncate">cozza-ai</span>
          </div>
          <ModelSelector value={defaultModel} onChange={setDefaultModel} disabled={isStreaming} />
        </div>
      }
      footer={
        <div className="flex flex-col">
          {error && (
            <div className="px-4 py-2 text-sm text-red-300 bg-red-950/40 border-t border-red-900/40">
              {error}
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-3 max-w-sweet-lg mx-auto w-full">
            <VoiceButton
              state={voiceState}
              onPressStart={start}
              onPressEnd={stop}
            />
            <div className="flex-1 min-w-0">
              <PromptInput
                disabled={isStreaming}
                onSend={(t) => {
                  setPendingPrompt('');
                  void send(t);
                }}
                value={pendingPrompt || undefined}
                onValueChange={setPendingPrompt}
                placeholder={
                  voiceState === 'listening'
                    ? interim || 'Sto ascoltando…'
                    : 'Scrivi o tieni premuto il microfono'
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setTtsAutoplay(!ttsAutoplay)}
              aria-pressed={ttsAutoplay}
              title={ttsAutoplay ? 'TTS attivo' : 'TTS muto'}
              className={[
                'focus-accent shrink-0 rounded-full w-12 h-12 flex items-center justify-center border',
                ttsAutoplay
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'border-white/10 text-muted-fg hover:text-white',
              ].join(' ')}
            >
              {ttsAutoplay ? '🔊' : '🔇'}
            </button>
          </div>
        </div>
      }
    >
      <MessageList
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />
    </AppShell>
  );
}
