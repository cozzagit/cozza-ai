import { useEffect, useState, type CSSProperties } from 'react';
import type { Artifact } from '@/lib/artifacts';
import { db } from '@/lib/db';
import { MermaidView } from './MermaidView';

interface ArtifactLightboxProps {
  artifact: Artifact;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

/**
 * Fullscreen overlay that enlarges any artifact (image, mermaid, svg, html).
 * Closes on Esc, backdrop click, or the × button. Pinch-to-zoom on images
 * via simple zoom state controlled by buttons + scroll wheel; mermaid /
 * svg are re-rendered at full viewport size for legibility.
 *
 * Optional onPrev / onNext switch among artifacts in the same panel.
 */
export function ArtifactLightbox({ artifact, onClose, onPrev, onNext }: ArtifactLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // For image-prompt artifacts, find the cached blob and turn it into an
  // object URL — same pipeline as the small thumbnail in the panel.
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (artifact.kind === 'image') {
        if (!cancelled) setImgUrl(artifact.payload);
        return;
      }
      if (artifact.kind === 'image-prompt') {
        try {
          const all = await db.imageBlobs.toArray();
          const match = all.find((b) => b.prompt.trim() === artifact.payload.trim());
          if (match && !cancelled) {
            const url = URL.createObjectURL(match.blob);
            revoke = url;
            setImgUrl(url);
          }
        } catch {
          // ignore — lightbox will show a placeholder
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [artifact]);

  // Esc / arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z * 1.25, 6));
      else if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(z / 1.25, 0.5));
      else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  // Reset zoom when switching artifact
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [artifact.id]);

  const onWheel = (e: React.WheelEvent): void => {
    if (artifact.kind !== 'image' && artifact.kind !== 'image-prompt') return;
    e.preventDefault();
    const delta = -e.deltaY;
    setZoom((z) => {
      const next = z * (delta > 0 ? 1.1 : 1 / 1.1);
      return Math.max(0.5, Math.min(6, next));
    });
  };

  const transform: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transition: zoom === 1 ? 'transform 200ms ease-out' : 'none',
    cursor: zoom > 1 ? 'grab' : 'default',
  };

  // Drag-to-pan when zoomed in
  const onPointerDown = (e: React.PointerEvent): void => {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;
    const onMove = (ev: PointerEvent): void => {
      setPan({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const isZoomable = artifact.kind === 'image' || artifact.kind === 'image-prompt';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista ingrandita"
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-fade-in"
    >
      <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="text-xs text-muted-fg/70 font-mono pointer-events-auto">
          {artifact.kind === 'image-prompt'
            ? '🎨 Immagine generata'
            : artifact.kind === 'image'
              ? '🖼️ Immagine'
              : artifact.kind === 'mermaid'
                ? '📊 Mermaid'
                : artifact.kind === 'svg'
                  ? '🪄 SVG'
                  : artifact.kind === 'html'
                    ? '🌐 HTML'
                    : artifact.kind}
          {isZoomable && zoom !== 1 && (
            <span className="ml-2 text-accent">{(zoom * 100).toFixed(0)}%</span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {isZoomable && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z / 1.25, 0.5))}
                aria-label="Zoom out"
                title="Zoom out (-)"
                className="focus-accent w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg leading-none"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Reset zoom"
                title="Reset zoom (0)"
                className="focus-accent px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z * 1.25, 6))}
                aria-label="Zoom in"
                title="Zoom in (+)"
                className="focus-accent w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg leading-none"
              >
                +
              </button>
              {imgUrl && (
                <a
                  href={imgUrl}
                  download={`cozza-ai-${artifact.id}.png`}
                  title="Scarica"
                  className="focus-accent w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                >
                  ↓
                </a>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            title="Chiudi (Esc)"
            className="focus-accent w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
      </header>

      {/* Backdrop click closes; the inner content stops propagation. */}
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      {/* Prev / Next chevrons */}
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Precedente"
          title="Precedente (←)"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
        >
          ‹
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Successivo"
          title="Successivo (→)"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
        >
          ›
        </button>
      )}

      <div
        className="relative flex-1 flex items-center justify-center p-4 overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
      >
        {artifact.kind === 'image' || artifact.kind === 'image-prompt' ? (
          imgUrl ? (
            <img
              src={imgUrl}
              alt={artifact.caption ?? artifact.payload.slice(0, 80)}
              draggable={false}
              style={transform}
              className="max-w-[95vw] max-h-[90vh] object-contain select-none"
            />
          ) : (
            <div className="text-muted-fg/70 text-sm text-center px-8">
              <div className="text-4xl mb-3" aria-hidden>
                ⏳
              </div>
              <p>Immagine non ancora pronta in cache.</p>
              <p className="text-xs mt-2 max-w-md">
                Aspetta che la generazione finisca nel pannello laterale, oppure ricarica la pagina
                dopo che è apparsa.
              </p>
            </div>
          )
        ) : artifact.kind === 'mermaid' ? (
          <div className="bg-oled-100 rounded-xl p-6 w-[95vw] h-[90vh] flex items-center justify-center overflow-auto">
            <MermaidView code={artifact.payload} id={`lb-${artifact.id}`} fill />
          </div>
        ) : artifact.kind === 'svg' ? (
          <div
            className="bg-oled-100 rounded-xl p-6 w-[95vw] h-[90vh] flex items-center justify-center overflow-auto svg-host svg-host-fill"
            dangerouslySetInnerHTML={{ __html: artifact.payload }}
          />
        ) : artifact.kind === 'html' ? (
          <iframe
            srcDoc={artifact.payload}
            sandbox="allow-scripts"
            className="w-[95vw] h-[90vh] bg-white rounded-xl"
            title={artifact.id}
          />
        ) : (
          <pre className="text-sm font-mono text-muted-fg max-w-[95vw] max-h-[90vh] overflow-auto bg-oled-100 rounded-xl p-6 whitespace-pre-wrap">
            {artifact.payload}
          </pre>
        )}
      </div>

      {artifact.caption && (
        <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent text-xs text-muted-fg/80 text-center pointer-events-none">
          {artifact.caption}
        </div>
      )}
    </div>
  );
}
