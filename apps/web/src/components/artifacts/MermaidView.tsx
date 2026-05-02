import { useEffect, useRef, useState } from 'react';

interface MermaidViewProps {
  code: string;
  id: string;
}

/**
 * Lazily load mermaid only when at least one mermaid artifact is in
 * view, so the chunk (~250 KB) doesn't bloat the main bundle.
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
        const { svg } = await mermaid.render(safeId, code);
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
    return (
      <pre className="text-xs text-red-300 bg-red-950/30 p-3 rounded-md overflow-x-auto">
        Mermaid: {error}
        {'\n\n'}
        {code}
      </pre>
    );
  }

  return <div ref={ref} className="mermaid-host overflow-x-auto" aria-label="Diagramma" />;
}
