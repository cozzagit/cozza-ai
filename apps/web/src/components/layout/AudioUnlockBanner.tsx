import { useEffect, useState } from 'react';
import { StreamingAudioPlayer } from '@/lib/audio';

/**
 * Banner that appears when audio playback is blocked by the browser's
 * autoplay policy (typical on Chrome Android the first time). One tap
 * triggers a synchronous user-gesture play of a silent buffer, which
 * unlocks audio for the rest of the session.
 */
export function AudioUnlockBanner() {
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBlocked = (): void => setBlocked(true);
    const onUnlocked = (): void => setBlocked(false);
    const onError = (e: Event): void => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setError(detail?.message ?? 'errore audio');
    };
    window.addEventListener('cozza:audio-blocked', onBlocked);
    window.addEventListener('cozza:audio-unlocked', onUnlocked);
    window.addEventListener('cozza:audio-error', onError);
    return () => {
      window.removeEventListener('cozza:audio-blocked', onBlocked);
      window.removeEventListener('cozza:audio-unlocked', onUnlocked);
      window.removeEventListener('cozza:audio-error', onError);
    };
  }, []);

  const unlock = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const ok = await StreamingAudioPlayer.unlock();
    if (ok) setBlocked(false);
    else setError('Sblocco non riuscito. Verifica che il volume sia alto e riprova.');
    setBusy(false);
  };

  if (error && !blocked) {
    return (
      <div
        role="status"
        className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 bg-red-950/80 border border-red-900/50 text-red-200 rounded-full px-4 py-2 text-sm shadow-lg flex items-center gap-3 max-w-[90vw]"
      >
        <span aria-hidden>🔇</span>
        <span className="truncate">{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          aria-label="Chiudi"
          className="text-red-200/70 hover:text-red-200"
        >
          ×
        </button>
      </div>
    );
  }

  if (!blocked) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 bg-accent text-black rounded-full px-4 py-2 text-sm font-medium shadow-lg flex items-center gap-3 animate-fade-in max-w-[90vw]"
    >
      <span aria-hidden>🔊</span>
      <span>Audio bloccato dal browser</span>
      <button
        type="button"
        onClick={() => void unlock()}
        disabled={busy}
        className="underline underline-offset-2 disabled:opacity-50"
      >
        {busy ? '…' : 'Tocca per abilitare'}
      </button>
    </div>
  );
}
