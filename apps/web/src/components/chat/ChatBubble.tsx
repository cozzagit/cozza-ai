import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  onReplayAudio?: () => void;
  onCopy?: () => void;
}

export function ChatBubble({
  role,
  content,
  streaming = false,
  onReplayAudio,
  onCopy,
}: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={[
        'group flex w-full animate-slide-up',
        isUser ? 'justify-end' : 'justify-start',
      ].join(' ')}
    >
      <div
        className={[
          'max-w-[88%] rounded-2xl px-4 py-3 text-base leading-relaxed relative',
          isUser
            ? 'bg-accent/10 text-white border border-accent/30'
            : 'bg-oled-100 text-white border border-white/5',
        ].join(' ')}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-pretty">{content}</p>
        ) : (
          <div className="prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 whitespace-pre-wrap text-pretty">{children}</p>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {children}
                  </a>
                ),
                ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
                img: ({ src, alt }) => (
                  <img
                    src={src as string | undefined}
                    alt={alt ?? ''}
                    className="rounded-lg max-w-full max-h-[60vh] my-2 border border-white/10"
                    loading="lazy"
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {streaming && (
              <span
                className="inline-block w-2 h-4 bg-accent align-middle ml-0.5 animate-pulse"
                aria-hidden
              />
            )}
          </div>
        )}

        {/* Action toolbar for assistant messages (visible on hover/focus) */}
        {!isUser && !streaming && (onReplayAudio || onCopy) && (
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            {onReplayAudio && (
              <button
                type="button"
                onClick={onReplayAudio}
                aria-label="Riproduci audio"
                title="Riascolta con TTS"
                className="focus-accent text-xs rounded-md px-2 py-1 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1"
              >
                <span aria-hidden>🔊</span>
                <span>Audio</span>
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copia testo"
                title="Copia testo"
                className="focus-accent text-xs rounded-md px-2 py-1 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1"
              >
                <span aria-hidden>📋</span>
                <span>Copia</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
