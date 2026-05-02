import { useMemo } from 'react';
import type { Artifact } from '@/lib/artifacts';
import { MermaidView } from './MermaidView';
import { ImagePromptView } from './ImagePromptView';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  open: boolean;
  onToggle: () => void;
}

export function ArtifactsPanel({ artifacts, open, onToggle }: ArtifactsPanelProps) {
  const hasArtifacts = artifacts.length > 0;
  const grouped = useMemo(() => {
    const byMessage = new Map<string, Artifact[]>();
    for (const a of artifacts) {
      const arr = byMessage.get(a.messageId) ?? [];
      arr.push(a);
      byMessage.set(a.messageId, arr);
    }
    return [...byMessage.entries()];
  }, [artifacts]);

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
          {hasArtifacts && (
            <span className="absolute -top-1 -right-2 text-[10px] bg-accent text-black rounded-full px-1 min-w-[16px] text-center font-medium">
              {artifacts.length}
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
                  <ArtifactView key={a.id} artifact={a} />
                ))}
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function ArtifactView({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case 'image':
      return (
        <figure>
          <img
            src={artifact.payload}
            alt={artifact.caption ?? ''}
            className="rounded-lg w-full max-h-[60vh] object-contain border border-white/10"
            loading="lazy"
          />
          {artifact.caption && (
            <figcaption className="text-xs text-muted-fg/70 mt-1">{artifact.caption}</figcaption>
          )}
        </figure>
      );
    case 'image-prompt':
      return <ImagePromptView prompt={artifact.payload} id={artifact.id} />;
    case 'mermaid':
      return (
        <div className="rounded-lg bg-oled-100 p-3 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-muted-fg/60 mb-2">Mermaid</div>
          <MermaidView code={artifact.payload} id={artifact.id} />
        </div>
      );
    case 'svg':
      return (
        <div
          className="rounded-lg bg-oled-100 p-3 border border-white/5 overflow-x-auto svg-host"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(artifact.payload) }}
        />
      );
    case 'html':
      return (
        <div className="rounded-lg overflow-hidden border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-muted-fg/60 px-2 py-1 bg-oled-100">
            HTML preview
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
