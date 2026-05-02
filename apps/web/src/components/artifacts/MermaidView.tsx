import { useEffect, useRef, useState } from 'react';

interface MermaidViewProps {
  code: string;
  id: string;
}

// Patterns built from explicit unicode codepoints so the source file stays
// 100% ASCII and ESLint doesn't trip on irregular whitespace.
const NBSP = ' ';
const ZW_AND_BOM = '[​‌‍﻿]'; // ZWSP, ZWNJ, ZWJ, BOM
const ARROW_RIGHT = '[→⟶➜➔⮕]'; // → ⟶ ➜ ➔ ⮕
const ARROW_DOUBLE_RIGHT = '[⇒]'; // ⇒
const ARROW_LEFT = '[←⬅]'; // ← ⬅
const ARROW_BIDI = '[↔⇔]'; // ↔ ⇔
const EM_DASHES = '[–—―]'; // – — ―
const SMART_SINGLE = '[‘’‚‛]';
const SMART_DOUBLE = '[“”„‟]';

/**
 * Normalizes the most common Mermaid syntax mistakes that LLMs make.
 * All replacements driven by explicit unicode codepoints so the source
 * stays ASCII-clean.
 */
export function sanitizeMermaid(input: string): string {
  let out = input;

  // Strip stray fence markers
  out = out.replace(/^```(?:mermaid)?\n?/i, '').replace(/```$/m, '');

  // Smart quotes -> straight
  out = out.replace(new RegExp(SMART_SINGLE, 'g'), "'");
  out = out.replace(new RegExp(SMART_DOUBLE, 'g'), '"');

  // Unicode arrows -> ASCII Mermaid arrows
  out = out.replace(new RegExp(ARROW_RIGHT, 'g'), '-->');
  out = out.replace(new RegExp(ARROW_DOUBLE_RIGHT, 'g'), '==>');
  out = out.replace(new RegExp(ARROW_LEFT, 'g'), '<--');
  out = out.replace(new RegExp(ARROW_BIDI, 'g'), '<-->');

  // Em / en / horizontal-bar dashes -> ASCII hyphen
  out = out.replace(new RegExp(EM_DASHES, 'g'), '-');

  // Whitespace cleanup
  out = out.replace(new RegExp(NBSP, 'g'), ' ');
  // eslint-disable-next-line no-misleading-character-class -- intentionally a class of zero-width chars
  out = out.replace(new RegExp(ZW_AND_BOM, 'g'), '');

  // 3+ dashes (often "---→" from the model) collapsed to a normal arrow
  out = out.replace(/-{3,}\s*/g, '--> ');

  // Legacy "graph TD" -> "flowchart TD"
  out = out.replace(/^\s*graph\s+(TD|TB|LR|RL|BT)\b/m, 'flowchart $1');

  // Trim trailing whitespace per line
  out = out.replace(/[ \t]+$/gm, '');

  return out.trim();
}

/**
 * Lazily loads mermaid only when at least one mermaid artifact is in
 * view, so the chunk (~250 KB) doesn't bloat the main bundle. Sanitizes
 * common LLM mistakes before rendering and falls back to a friendly
 * error card with the offending source if parsing still fails.
 */
export function MermaidView({ code, id }: MermaidViewProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            background: '#000000',
            primaryColor: '#0A0A0A',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#00E5FF',
            lineColor: '#00E5FF',
            secondaryColor: '#141414',
            tertiaryColor: '#1A1A1A',
            fontFamily: 'Geist, Inter, system-ui, sans-serif',
          },
          securityLevel: 'strict',
        });
        const safeId = `mmd-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const cleaned = sanitizeMermaid(code);
        const { svg } = await mermaid.render(safeId, cleaned);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'mermaid render failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    const cleaned = sanitizeMermaid(code);
    return (
      <div className="rounded-md bg-red-950/30 border border-red-900/40 p-3 space-y-2">
        <div className="flex items-center gap-2 text-red-200">
          <span aria-hidden>⚠️</span>
          <p className="text-xs font-medium">Diagramma non valido</p>
        </div>
        <p className="text-[11px] text-red-300/80">
          Il modello ha generato Mermaid con sintassi non standard.
        </p>
        <details className="text-[10px] text-red-200/70">
          <summary className="cursor-pointer">Dettagli</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-muted-fg/80 bg-oled-100/40 p-2 rounded">
            {error}
            {'\n\n— sorgente normalizzata —\n'}
            {cleaned}
          </pre>
        </details>
      </div>
    );
  }

  return <div ref={ref} className="mermaid-host overflow-x-auto" aria-label="Diagramma" />;
}
