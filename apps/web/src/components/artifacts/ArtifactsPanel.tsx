import { useEffect, useMemo, useRef, useState } from 'react';
import type { Artifact } from '@/lib/artifacts';
import { MermaidView } from './MermaidView';
import { ImagePromptView } from './ImagePromptView';
import { ArtifactLightbox } from './ArtifactLightbox';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  open: boolean;
  onToggle: () => void;
  /** Number of unseen new artifacts since last open. Drives the toggle badge. */
  unseenCount?: number;
}

export function ArtifactsPanel({
  artifacts,
  open,
  onToggle,
  unseenCount = 0,
}: ArtifactsPanelProps) {
  const hasArtifacts = artifacts.length > 0;
  const showBadge = !open && unseenCount > 0;
  const grouped = useMemo(() => {
    const byMessage = new Map<string, Artifact[]>();
    for (const a of artifacts) {
      const arr = byMessage.get(a.messageId) ?? [];
      arr.push(a);
      byMessage.set(a.messageId, arr);
    }
    return [...byMessage.entries()];
  }, [artifacts]);

  // Lightbox state — index into the flat artifacts array for prev/next.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openLightbox = (a: Artifact): void => {
    const i = artifacts.findIndex((x) => x.id === a.id);
    if (i >= 0) setLightboxIndex(i);
  };
  const closeLightbox = (): void => setLightboxIndex(null);
  const lightboxArtifact = lightboxIndex !== null ? artifacts[lightboxIndex] : null;

  // Scroll the drawer to the latest artifact when the panel opens or when a
  // new one arrives while it's open. Using `block: 'end'` so the user lands
  // on the freshly added card instead of the historical first one.
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [open, artifacts.length]);

  return (
    <>
      {/* Toggle button — shown in the chat top-right corner via portal-like fixed positioning */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Chiudi pannello visivi' : 'Apri pannello visivi'}
        title={open ? 'Chiudi visivi' : `Visivi ${hasArtifacts ? `(${artifacts.length})` : ''}`}
        className={[
          'fixed z-30 right-3 top-[68px] focus-accent rounded-full w-10 h-10 flex items-center justify-center border transition-colors',
          hasArtifacts
            ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
            : 'bg-oled-100 border-white/10 text-muted-fg hover:bg-white/5',
          open ? 'shadow-[0_0_12px_rgba(0,229,255,0.4)]' : '',
        ].join(' ')}
      >
        <span className="relative">
          <span aria-hidden>🖼️</span>
          {showBadge && (
            <span className="absolute -top-1 -right-2 text-[10px] bg-accent text-black rounded-full px-1 min-w-[16px] text-center font-medium animate-pulse">
              {unseenCount}
            </span>
          )}
        </span>
      </button>

      {/* Drawer */}
      <aside
        className={[
          'fixed top-0 right-0 z-20 h-full w-full sm:w-[420px] md:w-[480px]',
          'bg-oled-200 border-l border-white/10',
          'transition-transform duration-300 ease-out',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-hidden={!open}
        aria-label="Risultati visivi"
      >
        <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-medium">Visivi</h2>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Chiudi"
            className="text-muted-fg hover:text-white text-xl leading-none px-2"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!hasArtifacts ? (
            <div className="text-center text-muted-fg/60 text-sm py-12 px-4">
              <div className="text-4xl mb-3" aria-hidden>
                🖼️
              </div>
              <p>Niente da mostrare al momento.</p>
              <p className="text-xs mt-2">
                Quando l&apos;AI genera immagini, grafici Mermaid, SVG o HTML, appariranno qui.
              </p>
              <p className="text-xs mt-3 text-muted-fg/50">
                Prova: <em>&quot;mostrami una scena di un cockpit XR futuristico&quot;</em> oppure{' '}
                <em>&quot;diagramma OAuth&quot;</em>
              </p>
            </div>
          ) : (
            grouped.map(([msgId, arts]) => (
              <section
                key={msgId}
                className="rounded-xl glass-surface p-3 space-y-3"
                aria-label={`Artefatti del messaggio ${msgId.slice(-8)}`}
              >
                {arts.map((a) => (
                  <ArtifactView key={a.id} artifact={a} onZoom={() => openLightbox(a)} />
                ))}
              </section>
            ))
          )}
          <div ref={endRef} aria-hidden className="h-2" />
        </div>
      </aside>

      {lightboxArtifact && (
        <ArtifactLightbox
          artifact={lightboxArtifact}
          onClose={closeLightbox}
          {...(lightboxIndex !== null && lightboxIndex > 0
            ? { onPrev: () => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : i)) }
            : {})}
          {...(lightboxIndex !== null && lightboxIndex < artifacts.length - 1
            ? {
                onNext: () =>
                  setLightboxIndex((i) => (i !== null ? Math.min(artifacts.length - 1, i + 1) : i)),
              }
            : {})}
        />
      )}
    </>
  );
}

function ZoomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ingrandisci a tutto schermo"
      title="Ingrandisci"
      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white border border-white/20 opacity-0 group-hover/artifact:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center"
    >
      <span aria-hidden className="text-xs">
        ⛶
      </span>
    </button>
  );
}

function ArtifactView({ artifact, onZoom }: { artifact: Artifact; onZoom: () => void }) {
  switch (artifact.kind) {
    case 'image':
      return (
        <figure className="relative group/artifact">
          <button
            type="button"
            onClick={onZoom}
            aria-label="Apri immagine a tutto schermo"
            className="block w-full focus-accent rounded-lg overflow-hidden"
          >
            <img
              src={artifact.payload}
              alt={artifact.caption ?? ''}
              className="rounded-lg w-full max-h-[60vh] object-contain border border-white/10 cursor-zoom-in"
              loading="lazy"
            />
          </button>
          <ZoomButton onClick={onZoom} />
          {artifact.caption && (
            <figcaption className="text-xs text-muted-fg/70 mt-1">{artifact.caption}</figcaption>
          )}
        </figure>
      );
    case 'image-prompt':
      return (
        <div className="relative group/artifact">
          <ImagePromptView prompt={artifact.payload} id={artifact.id} />
          <ZoomButton onClick={onZoom} />
        </div>
      );
    case 'mermaid':
      return (
        <div className="relative group/artifact rounded-lg bg-oled-100 p-3 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-fg/60">Mermaid</div>
            <button
              type="button"
              onClick={onZoom}
              aria-label="Ingrandisci diagramma"
              title="Ingrandisci"
              className="text-muted-fg hover:text-white text-xs px-2 py-0.5 rounded-md hover:bg-white/10"
            >
              ⛶
            </button>
          </div>
          <button
            type="button"
            onClick={onZoom}
            aria-label="Apri diagramma a tutto schermo"
            className="w-full text-left cursor-zoom-in"
          >
            <MermaidView code={artifact.payload} id={artifact.id} />
          </button>
        </div>
      );
    case 'svg':
      return (
        <div className="relative group/artifact">
          <button
            type="button"
            onClick={onZoom}
            aria-label="Apri SVG a tutto schermo"
            className="block w-full focus-accent rounded-lg cursor-zoom-in"
          >
            <div
              className="rounded-lg bg-oled-100 p-3 border border-white/5 overflow-x-auto svg-host pointer-events-none"
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(artifact.payload) }}
            />
          </button>
          <ZoomButton onClick={onZoom} />
        </div>
      );
    case 'html':
      return (
        <div className="relative group/artifact rounded-lg overflow-hidden border border-white/10">
          <div className="flex items-center justify-between px-2 py-1 bg-oled-100">
            <div className="text-[10px] uppercase tracking-wider text-muted-fg/60">
              HTML preview
            </div>
            <button
              type="button"
              onClick={onZoom}
              aria-label="Ingrandisci preview HTML"
              title="Ingrandisci"
              className="text-muted-fg hover:text-white text-xs px-2 py-0.5 rounded-md hover:bg-white/10"
            >
              ⛶
            </button>
          </div>
          <iframe
            srcDoc={artifact.payload}
            sandbox="allow-scripts"
            className="w-full h-[400px] bg-white"
            title={artifact.id}
          />
        </div>
      );
    case 'chart':
      return (
        <details className="rounded-lg bg-oled-100 p-3 border border-white/5">
          <summary className="text-xs font-mono cursor-pointer">Chart JSON (preview WIP)</summary>
          <pre className="text-xs mt-2 overflow-x-auto font-mono text-muted-fg">
            {artifact.payload}
          </pre>
        </details>
      );
    case 'link':
      return (
        <a
          href={artifact.payload}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-accent hover:underline"
        >
          {artifact.payload}
        </a>
      );
  }
}

/**
 * Minimal SVG sanitization — strips `<script>` tags and `on*` event
 * handlers. We accept SVG only from our own AI output, but better safe
 * than sorry given the assistant could echo arbitrary user input.
 */
function sanitizeSvg(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
}
