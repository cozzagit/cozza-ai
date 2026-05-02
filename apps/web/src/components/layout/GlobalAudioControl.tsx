interface GlobalAudioControlProps {
  isPlaying: boolean;
  onStop: () => void;
}

/**
 * Always-visible Stop audio pill that floats at the bottom-center of the
 * viewport whenever TTS playback (autoplay during a stream OR user-triggered
 * replay) is in progress. Tap = immediate stop. Mobile + desktop friendly,
 * sits above the input bar.
 */
export function GlobalAudioControl({ isPlaying, onStop }: GlobalAudioControlProps) {
  if (!isPlaying) return null;
  return (
    <button
      type="button"
      onClick={onStop}
      aria-label="Ferma audio in riproduzione"
      title="Ferma audio"
      className={[
        'fixed left-1/2 -translate-x-1/2 z-30',
        // sit above the input bar; raised on safe-area iOS
        'bottom-[calc(env(safe-area-inset-bottom,0px)+96px)]',
        'rounded-full px-4 py-2.5 text-sm font-medium',
        'bg-accent text-black shadow-[0_0_24px_rgba(0,229,255,0.45)]',
        'flex items-center gap-2 animate-fade-in',
        'hover:scale-105 active:scale-95 transition-transform',
      ].join(' ')}
    >
      <span aria-hidden className="relative flex items-center justify-center w-5 h-5">
        <span className="absolute inset-0 rounded-full bg-black/30 animate-ping" />
        <span className="relative">⏹</span>
      </span>
      <span>Ferma audio</span>
    </button>
  );
}
