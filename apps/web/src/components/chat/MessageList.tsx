import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import type { MessageRecord } from '@/lib/db';

interface MessageListProps {
  messages: MessageRecord[];
  streamingText: string;
  isStreaming: boolean;
  onReplayAudio?: (msg: MessageRecord) => void;
  onCopy?: (msg: MessageRecord) => void;
}

export function MessageList({
  messages,
  streamingText,
  isStreaming,
  onReplayAudio,
  onCopy,
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

        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            role={m.role}
            content={m.content}
            {...(m.role === 'assistant' && onReplayAudio
              ? { onReplayAudio: () => onReplayAudio(m) }
              : {})}
            {...(m.role === 'assistant' && onCopy ? { onCopy: () => onCopy(m) } : {})}
          />
        ))}

        {isStreaming && streamingText && (
          <ChatBubble role="assistant" content={streamingText} streaming />
        )}

        <div ref={endRef} aria-hidden className="h-2" />
      </div>
    </div>
  );
}
