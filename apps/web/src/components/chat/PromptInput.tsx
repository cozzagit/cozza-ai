import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface PromptInputProps {
  disabled?: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
  /** Externally controlled text (e.g. from voice transcript). */
  value?: string | undefined;
  onValueChange?: (v: string) => void;
}

export function PromptInput({
  disabled = false,
  onSend,
  placeholder = 'Scrivi a cozza-ai…',
  value,
  onValueChange,
}: PromptInputProps) {
  const [internal, setInternal] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const text = value ?? internal;
  const setText = (v: string) => {
    if (value !== undefined) onValueChange?.(v);
    else setInternal(v);
  };

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full px-3 pb-3 pt-2">
      <div className="mx-auto w-full max-w-sweet-lg">
        <div className="glass-surface rounded-2xl flex items-end gap-2 px-3 py-2 focus-within:border-accent/40 transition-colors">
          <textarea
            ref={ref}
            rows={1}
            disabled={disabled}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            className="flex-1 resize-none bg-transparent outline-none placeholder:text-muted-fg/60 py-2 px-1 max-h-[200px]"
          />
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={submit}
            aria-label="Invia"
            className="focus-accent shrink-0 rounded-full bg-accent text-black font-medium px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            Invia
          </button>
        </div>
        <p className="text-xs text-muted-fg/50 px-2 pt-1.5">
          Invio per inviare · Shift+Invio per nuova riga
        </p>
      </div>
    </div>
  );
}
