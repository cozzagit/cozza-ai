import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
}

export function ChatBubble({ role, content, streaming = false }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={[
        'flex w-full animate-slide-up',
        isUser ? 'justify-end' : 'justify-start',
      ].join(' ')}
    >
      <div
        className={[
          'max-w-[88%] rounded-2xl px-4 py-3 text-base leading-relaxed',
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
      </div>
    </div>
  );
}
