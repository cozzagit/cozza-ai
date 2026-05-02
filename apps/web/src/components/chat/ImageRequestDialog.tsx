import { useEffect, useRef, useState } from 'react';

interface ImageRequestDialogProps {
  initialPrompt: string;
  onClose: () => void;
  /** Called with the final prompt the user wants to generate */
  onGenerate: (prompt: string) => void;
}

/**
 * Modal asking the user to confirm/refine a prompt for AI image generation.
 * Pre-filled from the latest assistant text but always editable in English
 * (gpt-image-1 performs best in English).
 */
export function ImageRequestDialog({
  initialPrompt,
  onClose,
  onGenerate,
}: ImageRequestDialogProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = (): void => {
    const trimmed = prompt.trim();
    if (trimmed.length < 5) return;
    onGenerate(trimmed);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Genera immagine"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-oled-200 border border-white/10 p-5 space-y-4">
        <header>
          <h3 className="font-semibold flex items-center gap-2">
            <span aria-hidden>🎨</span> Genera immagine
          </h3>
          <p className="text-xs text-muted-fg/70 mt-1">
            gpt-image-1 · 1024×1024 medium · ~$0.04 · ~10s. Prompt in inglese rende meglio.
          </p>
        </header>
        <textarea
          ref={ref}
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Cinematic photo of a futuristic XR cockpit, neon cyan accents, deep black background, volumetric lighting, ultra-detailed, 8k"
          className="w-full glass-surface rounded-lg p-3 text-sm font-mono outline-none focus:border-accent/40 resize-y"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm rounded-md px-3 py-1.5 text-muted-fg hover:text-white"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={prompt.trim().length < 5}
            className="text-sm rounded-md px-4 py-1.5 bg-accent text-black font-medium disabled:opacity-50"
          >
            Genera
          </button>
        </div>
        <p className="text-[10px] text-muted-fg/50">
          ⌘/Ctrl+Enter per generare · Esc per annullare
        </p>
      </div>
    </div>
  );
}
