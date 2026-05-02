import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import type { MessageRecord } from '@/lib/db';
import { stripFences } from '@/lib/artifacts';

const HIDDEN_FENCE_KINDS = ['image-prompt', 'mermaid', 'svg', 'html', 'chart'] as const;

interface MessageListProps {
  messages: MessageRecord[];
  streamingText: string;
  isStreaming: boolean;
  onReplayAudio?: (msg: MessageRecord) => void;
  onCopy?: (msg: MessageRecord) => void;
  onGenerateImage?: (msg: MessageRecord) => void;
  /** Id of the message whose audio replay is currently playing, if any. */
  replayingMessageId?: string | null;
}

export function MessageList({
  messages,
  streamingText,
  isStreaming,
  onReplayAudio,
  onCopy,
  onGenerateImage,
  replayingMessageId = null,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingText, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-6 space-y-4">
      <div className="mx-auto w-full max-w-sweet-lg space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-muted-fg/70 py-12">
            <p className="text-lg">Inizia a parlare con cozza-ai.</p>
            <p className="text-sm mt-2">
              Premi a lungo il bottone microfono o scrivi un messaggio.
            </p>
          </div>
        )}

        {messages.map((m) => {
          // Hide fenced blocks already rendered in the artifacts panel
          // (image-prompt/mermaid/svg/html) so the chat bubble shows only
          // the conversational text. Markdown tables, inline `code`, and
          // generic ```code``` blocks remain visible.
          const displayContent =
            m.role === 'assistant' ? stripFences(m.content, [...HIDDEN_FENCE_KINDS]) : m.content;
          return (
            <ChatBubble
              key={m.id}
              role={m.role}
              content={displayContent}
              isPlaying={m.id === replayingMessageId}
              {...(m.role === 'assistant' && onReplayAudio
                ? { onReplayAudio: () => onReplayAudio(m) }
                : {})}
              {...(m.role === 'assistant' && onCopy ? { onCopy: () => onCopy(m) } : {})}
              {...(m.role === 'assistant' && onGenerateImage
                ? { onGenerateImage: () => onGenerateImage(m) }
                : {})}
            />
          );
        })}

        {isStreaming && streamingText && (
          <ChatBubble
            role="assistant"
            content={stripFences(streamingText, [...HIDDEN_FENCE_KINDS])}
            streaming
          />
        )}

        <div ref={endRef} aria-hidden className="h-2" />
      </div>
    </div>
  );
}
