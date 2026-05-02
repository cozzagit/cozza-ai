import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/layout/Sidebar';
import { ModelSelector } from './components/chat/ModelSelector';
import { MessageList } from './components/chat/MessageList';
import { PromptInput } from './components/chat/PromptInput';
import { VoiceButton } from './components/voice/VoiceButton';
import { ArtifactsPanel } from './components/artifacts/ArtifactsPanel';
import { UpdateBanner } from './components/layout/UpdateBanner';
import { AudioUnlockBanner } from './components/layout/AudioUnlockBanner';
import { StreamingAudioPlayer } from './lib/audio';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { useTts } from './hooks/useTts';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useSettingsStore } from './stores/settings';
import { useWorkspaceStore } from './stores/workspace';
import { extractArtifacts, type Artifact } from './lib/artifacts';
import type { MessageRecord } from './lib/db';

export default function App() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');

  // Settings
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);
  const ttsAutoplay = useSettingsStore((s) => s.ttsAutoplay);
  const setTtsAutoplay = useSettingsStore((s) => s.setTtsAutoplay);
  const voiceId = useSettingsStore((s) => s.voiceId);
  const artifactsPanelOpen = useSettingsStore((s) => s.artifactsPanelOpen);
  const setArtifactsPanelOpen = useSettingsStore((s) => s.setArtifactsPanelOpen);

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
  const {
    speak,
    stop: stopTts,
    isPlaying: ttsPlaying,
  } = useTts({
    voiceId,
    enabled: ttsAutoplay && Boolean(voiceId),
  });
  const [replayingMessageId, setReplayingMessageId] = useState<string | null>(null);

  // When TTS finishes (or is stopped), clear the replay-tracking marker.
  useEffect(() => {
    if (!ttsPlaying) setReplayingMessageId(null);
  }, [ttsPlaying]);

  // Chat
  const { send, cancel, retry, status, error, streamingText } = useChat({
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
  const sttLang = useSettingsStore((s) => s.sttLang);
  const {
    state: voiceState,
    interim,
    start,
    stop,
  } = useVoiceInput({
    lang: sttLang,
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

  // Visual artifacts extracted from assistant messages
  const artifacts = useMemo<Artifact[]>(() => {
    const out: Artifact[] = [];
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      out.push(...extractArtifacts(m.id, m.content));
    }
    return out;
  }, [messages]);

  // Auto-open the artifacts panel every time a new visual arrives, EXCEPT
  // if the user explicitly closed it during the current stream (we respect
  // that until the next user message).
  const lastArtifactCountRef = useRef(0);
  const userClosedDuringStreamRef = useRef(false);
  useEffect(() => {
    if (!isStreaming) userClosedDuringStreamRef.current = false;
  }, [isStreaming]);
  useEffect(() => {
    const grew = artifacts.length > lastArtifactCountRef.current;
    lastArtifactCountRef.current = artifacts.length;
    if (grew && !artifactsPanelOpen && !userClosedDuringStreamRef.current) {
      setArtifactsPanelOpen(true);
    }
  }, [artifacts.length, artifactsPanelOpen, setArtifactsPanelOpen, isStreaming]);

  const toggleArtifactsPanel = (): void => {
    if (artifactsPanelOpen && isStreaming) {
      userClosedDuringStreamRef.current = true;
    }
    setArtifactsPanelOpen(!artifactsPanelOpen);
  };

  const handleReplayAudio = (msg: MessageRecord): void => {
    if (!voiceId) return;
    // Toggle: if THIS message is the one currently playing, stop.
    // Otherwise, stop whatever is playing and start this one.
    if (replayingMessageId === msg.id && ttsPlaying) {
      stopTts();
      setReplayingMessageId(null);
      return;
    }
    stopTts();
    setReplayingMessageId(msg.id);
    void speak(msg.content);
  };

  const handleCopy = (msg: MessageRecord): void => {
    void navigator.clipboard?.writeText(msg.content);
  };

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
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,229,255,0.8)]"
              aria-hidden
            />
            <span className="font-mono text-sm tracking-wide truncate">cozza-ai</span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={defaultModel} onChange={setDefaultModel} disabled={isStreaming} />
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              aria-label="Apri admin"
              title="Admin"
              className="focus-accent rounded-md p-2 text-muted-fg hover:text-white hover:bg-white/5"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </a>
          </div>
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
              onPressStart={() => {
                // First voice gesture in the session: unlock audio for autoplay
                if (!StreamingAudioPlayer.isUnlocked) {
                  void StreamingAudioPlayer.unlock();
                }
                start();
              }}
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
              onClick={() => {
                if (!ttsAutoplay && !StreamingAudioPlayer.isUnlocked) {
                  // User is enabling TTS — perfect gesture to unlock autoplay
                  void StreamingAudioPlayer.unlock();
                }
                setTtsAutoplay(!ttsAutoplay);
              }}
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
      {error && (
        <div className="px-4 py-3 mx-3 my-2 max-w-sweet-lg sm:mx-auto w-auto rounded-md text-sm text-red-300 bg-red-950/40 border border-red-900/40 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>
            <strong className="font-semibold">Errore:</strong> {error}
          </span>
          <button
            type="button"
            onClick={() => {
              void retry();
            }}
            className="focus-accent shrink-0 rounded-md px-3 py-1 text-xs bg-red-900/50 hover:bg-red-900/80 text-red-100 border border-red-800/40"
          >
            ↻ Riprova
          </button>
        </div>
      )}
      <MessageList
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
        onReplayAudio={handleReplayAudio}
        onCopy={handleCopy}
        replayingMessageId={replayingMessageId}
      />
      <ArtifactsPanel
        artifacts={artifacts}
        open={artifactsPanelOpen}
        onToggle={toggleArtifactsPanel}
      />
      <UpdateBanner />
      <AudioUnlockBanner />
    </AppShell>
  );
}
