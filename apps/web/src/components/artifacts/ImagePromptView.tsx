import { useEffect, useRef, useState } from 'react';
import { generateImage, ApiError } from '@/lib/api';
import { db, imageCacheKey } from '@/lib/db';
import { log } from '@/lib/debug-log';

interface ImagePromptViewProps {
  prompt: string;
  /** Stable id from the artifact, used to dedupe in the same session. */
  id: string;
}

type State =
  | { phase: 'pending' }
  | { phase: 'loading'; etaSec: number }
  | { phase: 'ready'; objectUrl: string; cached: boolean; size: number }
  | { phase: 'error'; message: string };

const SIZE = '1024x1024';
const QUALITY = 'medium';

/**
 * Renders an `image-prompt` artifact: when first mounted, checks the local
 * Dexie cache; if missing, calls the backend to generate via gpt-image-1
 * (3-15s typical). Result is stored in IndexedDB for reuse and the same
 * prompt across sessions never re-generates.
 *
 * Auto-resolution = 1024x1024, medium quality (~$0.04/image). User can
 * regenerate manually with the "Rigenera" button.
 */
export function ImagePromptView({ prompt, id }: ImagePromptViewProps) {
  const [state, setState] = useState<State>({ phase: 'pending' });
  const startedRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async (force = false): Promise<void> => {
    if (startedRef.current && !force) return;
    startedRef.current = true;
    cleanupObjectUrl();

    const key = await imageCacheKey(prompt, SIZE, QUALITY);

    if (!force) {
      const cached = await db.imageBlobs.get(key);
      if (cached) {
        const url = URL.createObjectURL(cached.blob);
        objectUrlRef.current = url;
        setState({ phase: 'ready', objectUrl: url, cached: true, size: cached.blob.size });
        log.info('image.gen', 'cache hit', { id });
        return;
      }
    }

    setState({ phase: 'loading', etaSec: 8 });
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setState((s) => (s.phase === 'loading' ? { phase: 'loading', etaSec: s.etaSec + 1 } : s));
    }, 1000);

    log.info('image.gen', 'start', { promptLen: prompt.length, force });
    try {
      const blob = await generateImage({ prompt, size: SIZE, quality: QUALITY });
      await db.imageBlobs.put({
        key,
        blob,
        prompt,
        size: SIZE,
        quality: QUALITY,
        createdAt: Date.now(),
      });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setState({ phase: 'ready', objectUrl: url, cached: false, size: blob.size });
      log.info('image.gen', 'done', { bytes: blob.size });
    } catch (e) {
      const detail =
        e instanceof ApiError && e.status === 502
          ? 'OpenAI Images: errore provider (controlla credito o policy del prompt).'
          : e instanceof Error
            ? e.message
            : 'errore sconosciuto';
      setState({ phase: 'error', message: detail });
      log.error('image.gen', 'failed', { detail });
    } finally {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    void start();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      cleanupObjectUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  const cleanupObjectUrl = (): void => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  if (state.phase === 'pending') {
    return null;
  }

  if (state.phase === 'loading') {
    return (
      <div className="rounded-xl bg-oled-100 border border-white/5 overflow-hidden">
        <div className="aspect-square w-full bg-gradient-to-br from-accent/5 via-oled-200 to-oled-100 relative animate-pulse">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            <div>
              <p className="text-sm font-medium text-white">Sto generando l&apos;immagine…</p>
              <p className="text-xs text-muted-fg/70 mt-1">
                gpt-image-1 · ~{state.etaSec}s elapsed
              </p>
            </div>
            <p className="text-[10px] text-muted-fg/50 line-clamp-3 max-w-xs">
              &laquo;{prompt.slice(0, 140)}
              {prompt.length > 140 ? '…' : ''}&raquo;
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl bg-red-950/30 border border-red-900/40 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            🖼️
          </span>
          <p className="text-sm font-medium text-red-200">Generazione immagine fallita</p>
        </div>
        <p className="text-xs text-red-300/80">{state.message}</p>
        <p className="text-[10px] text-muted-fg/60 line-clamp-2">
          Prompt: «{prompt.slice(0, 120)}»
        </p>
        <button
          type="button"
          onClick={() => void start(true)}
          className="text-xs rounded-md px-3 py-1.5 bg-white/5 hover:bg-white/10 text-red-100 border border-red-800/40"
        >
          ↻ Riprova
        </button>
      </div>
    );
  }

  return (
    <figure className="rounded-xl bg-oled-100 border border-white/5 overflow-hidden">
      <img
        src={state.objectUrl}
        alt={prompt.slice(0, 120)}
        className="w-full max-h-[70vh] object-contain bg-black"
        loading="lazy"
      />
      <figcaption className="px-3 py-2 text-[11px] text-muted-fg/70 flex items-center justify-between gap-2 border-t border-white/5">
        <span className="truncate flex-1">
          «{prompt.slice(0, 100)}
          {prompt.length > 100 ? '…' : ''}»
        </span>
        <span className="shrink-0 flex items-center gap-2">
          {state.cached && (
            <span title="Da cache locale" className="text-[9px] text-emerald-400">
              ●
            </span>
          )}
          <a
            href={state.objectUrl}
            download={`cozza-ai-${id}.png`}
            className="text-accent hover:underline"
            title="Scarica"
          >
            ↓
          </a>
          <button
            type="button"
            onClick={() => void start(true)}
            title="Rigenera (consuma 1 immagine API)"
            className="text-muted-fg hover:text-white"
          >
            ↻
          </button>
        </span>
      </figcaption>
    </figure>
  );
}
