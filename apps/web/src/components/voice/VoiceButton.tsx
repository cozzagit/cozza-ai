import { useEffect, useRef } from 'react';
import type { VoiceState } from '@/hooks/useVoiceInput';

interface VoiceButtonProps {
  state: VoiceState;
  onPressStart: () => void;
  onPressEnd: () => void;
}

export function VoiceButton({ state, onPressStart, onPressEnd }: VoiceButtonProps) {
  const pressedRef = useRef(false);

  useEffect(() => {
    const onSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !pressedRef.current && document.activeElement === document.body) {
        e.preventDefault();
        pressedRef.current = true;
        onPressStart();
      }
    };
    const onSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pressedRef.current) {
        e.preventDefault();
        pressedRef.current = false;
        onPressEnd();
      }
    };
    window.addEventListener('keydown', onSpaceDown);
    window.addEventListener('keyup', onSpaceUp);
    return () => {
      window.removeEventListener('keydown', onSpaceDown);
      window.removeEventListener('keyup', onSpaceUp);
    };
  }, [onPressStart, onPressEnd]);

  if (state === 'unsupported') {
    return (
      <button
        type="button"
        disabled
        title="Web Speech API non supportata in questo browser"
        aria-label="Voice non disponibile"
        className="w-14 h-14 rounded-full glass-surface text-muted-fg opacity-40 cursor-not-allowed flex items-center justify-center"
      >
        <MicIcon muted />
      </button>
    );
  }

  const listening = state === 'listening';
  const processing = state === 'processing';

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        // Capture the pointer so subsequent move/up events fire on this
        // button even if the finger drifts outside the 56px hit-area —
        // crucial on Pixel-class phones where a millimetre of slip
        // would otherwise abort the recording mid-sentence.
        try {
          (e.target as Element).setPointerCapture(e.pointerId);
        } catch {
          // not supported on this platform → fall through
        }
        onPressStart();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        try {
          (e.target as Element).releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        onPressEnd();
      }}
      onPointerCancel={() => onPressEnd()}
      // Removed onPointerLeave: with pointer capture the up event always
      // fires here, so leave-while-listening would close the recording
      // prematurely.
      aria-label={listening ? 'Sto ascoltando, rilascia per inviare' : 'Tieni premuto per parlare'}
      aria-pressed={listening}
      className={[
        'focus-accent w-14 h-14 rounded-full flex items-center justify-center transition-all touch-none select-none',
        listening
          ? 'bg-accent text-black animate-pulse-glow scale-105'
          : processing
            ? 'bg-accent/50 text-black'
            : 'glass-surface text-white hover:bg-white/5',
      ].join(' ')}
    >
      <MicIcon active={listening} />
    </button>
  );
}

function MicIcon({ active = false, muted = false }: { active?: boolean; muted?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" />}
    </svg>
  );
}
