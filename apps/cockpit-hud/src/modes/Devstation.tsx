import { useEffect, useMemo, useState } from 'react';
import { useCockpitStore } from '../store';

/**
 * Devstation — la stazione di lavoro mobile.
 *
 * Una griglia configurabile di iframe che proiettano sul Viture/desktop:
 *  - VS Code web (code-server) attaccato al PC di casa via reverse SSH
 *  - terminale interattivo (ttyd) per Claude Code, build, deploy, git
 *  - preview live dei progetti Vite del PC (HMR funzionante)
 *  - HUD telemetria del cockpit stesso
 *  - URL custom (qualsiasi cosa tu voglia)
 *
 * Layout switchabili e dimensioni dei pannelli persistite in localStorage.
 */

interface SourceDef {
  id: string;
  label: string;
  icon: string;
  url: () => string;
  /** When true, the iframe sandbox includes allow-same-origin so cookies/auth work. */
  sameOrigin?: boolean;
}

type LayoutId = '2x2' | 'code-major' | 'preview-major' | 'triple-h' | 'split-v' | 'single';

const LAYOUTS: { id: LayoutId; label: string; cells: number }[] = [
  { id: '2x2', label: '2×2', cells: 4 },
  { id: 'code-major', label: 'Code maxi', cells: 4 },
  { id: 'preview-major', label: 'Preview maxi', cells: 4 },
  { id: 'triple-h', label: 'Triple H', cells: 3 },
  { id: 'split-v', label: 'Split V', cells: 2 },
  { id: 'single', label: 'Single', cells: 1 },
];

export function Devstation() {
  const token = useCockpitStore((s) => s.token);
  const busUrl = useCockpitStore((s) => s.busUrl);

  // Built-in sources, computed once.
  const sources = useMemo<SourceDef[]>(() => {
    const base = isProd() ? '' : 'http://localhost:3030';
    void base;
    const origin = isProd() ? '' : 'http://localhost';
    return [
      {
        id: 'code',
        label: 'VS Code',
        icon: '💻',
        url: () => (isProd() ? '/cockpit/code/' : `${origin}:8444/`),
        sameOrigin: true,
      },
      {
        id: 'term',
        label: 'Terminal',
        icon: '⌨',
        url: () => (isProd() ? '/cockpit/term/' : `${origin}:7681/`),
        sameOrigin: true,
      },
      {
        id: 'preview-web',
        label: 'cozza-ai',
        icon: '🌐',
        url: () => (isProd() ? '/cockpit/dev/5173/' : `${origin}:5173/`),
      },
      {
        id: 'preview-hud',
        label: 'HUD dev',
        icon: '🛸',
        url: () => (isProd() ? '/cockpit/dev/5174/' : `${origin}:5174/`),
      },
      {
        id: 'preview-remote',
        label: 'Remote dev',
        icon: '📱',
        url: () => (isProd() ? '/cockpit/dev/5175/' : `${origin}:5175/`),
      },
      {
        id: 'hud',
        label: 'HUD live',
        icon: '◉',
        url: () => `/cockpit/?token=${encodeURIComponent(token)}#vitals`,
        sameOrigin: true,
      },
      {
        id: 'chat',
        label: 'Chat AI',
        icon: '💬',
        url: () => '/',
        sameOrigin: true,
      },
    ];
  }, [token]);

  // The mapping cellIndex → sourceId (or 'custom:URL'), persisted.
  const [layout, setLayout] = usePersisted<LayoutId>('cozza-devstation-layout', '2x2');
  const [slots, setSlots] = usePersisted<Record<number, string>>('cozza-devstation-slots', {
    0: 'code',
    1: 'preview-web',
    2: 'term',
    3: 'hud',
  });
  const [pickerCell, setPickerCell] = useState<number | null>(null);

  const cells = LAYOUTS.find((l) => l.id === layout)?.cells ?? 4;
  // Defensive: discard slot indexes that no longer exist in this layout
  useEffect(() => {
    const trimmed: Record<number, string> = {};
    for (let i = 0; i < cells; i++) {
      const slot = slots[i];
      if (typeof slot === 'string') trimmed[i] = slot;
    }
    if (Object.keys(trimmed).length !== Object.keys(slots).length) setSlots(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);

  const resolveUrl = (slot: string | undefined): string | null => {
    if (!slot) return null;
    if (slot.startsWith('custom:')) return slot.slice(7);
    const s = sources.find((x) => x.id === slot);
    return s ? s.url() : null;
  };
  const resolveLabel = (slot: string | undefined): string => {
    if (!slot) return '— vuoto —';
    if (slot.startsWith('custom:')) return slot.slice(7).slice(0, 40);
    const s = sources.find((x) => x.id === slot);
    return s ? `${s.icon} ${s.label}` : slot;
  };

  void busUrl;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="display text-lg glow-cyan">Devstation</h2>
        <div className="flex-1" />
        <div className="flex gap-1 flex-wrap">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLayout(l.id)}
              className={[
                'pill',
                layout === l.id ? 'pill-ok' : 'pill-unknown',
                'cursor-pointer',
              ].join(' ')}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <div
        className="rounded-xl overflow-hidden border border-current/15"
        style={gridStyleFor(layout)}
      >
        {Array.from({ length: cells }).map((_, i) => {
          const slot = slots[i];
          const url = resolveUrl(slot);
          return (
            <div
              key={i}
              className="relative bg-black/40 border border-current/10 overflow-hidden"
              style={spanStyleFor(layout, i)}
            >
              <div className="absolute top-1 right-1 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => setPickerCell(i)}
                  title="Cambia sorgente"
                  className="pill pill-unknown bg-black/70 backdrop-blur"
                >
                  {resolveLabel(slot)}
                </button>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Apri in nuova tab"
                    className="pill pill-unknown bg-black/70 backdrop-blur"
                  >
                    ↗
                  </a>
                )}
              </div>
              {url ? (
                <iframe
                  key={url + '-' + i}
                  src={url}
                  title={resolveLabel(slot)}
                  className="w-full h-full block"
                  allow="clipboard-read; clipboard-write; microphone; autoplay; fullscreen"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerCell(i)}
                  className="w-full h-full flex items-center justify-center text-sm opacity-60 font-mono"
                >
                  + scegli sorgente
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pickerCell !== null && (
        <SourcePicker
          sources={sources}
          onPick={(id) => {
            setSlots({ ...slots, [pickerCell]: id });
            setPickerCell(null);
          }}
          onPickCustom={(url) => {
            setSlots({ ...slots, [pickerCell]: 'custom:' + url });
            setPickerCell(null);
          }}
          onClose={() => setPickerCell(null)}
        />
      )}
    </div>
  );
}

function isProd(): boolean {
  return typeof window !== 'undefined' && window.location.hostname !== 'localhost';
}

function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T): void => {
    setV(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // noop
    }
  };
  return [v, set];
}

function gridStyleFor(layout: LayoutId): React.CSSProperties {
  switch (layout) {
    case '2x2':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        height: '78vh',
        gap: 4,
      };
    case 'code-major':
      return {
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '2fr 1fr',
        height: '78vh',
        gap: 4,
      };
    case 'preview-major':
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gridTemplateRows: '2fr 1fr',
        height: '78vh',
        gap: 4,
      };
    case 'triple-h':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '78vh', gap: 4 };
    case 'split-v':
      return { display: 'grid', gridTemplateColumns: '1fr 1fr', height: '78vh', gap: 4 };
    case 'single':
      return { height: '78vh' };
    default:
      return { height: '78vh' };
  }
}

function spanStyleFor(layout: LayoutId, i: number): React.CSSProperties {
  if (layout === 'code-major' && i === 0) {
    return { gridRow: 'span 1', gridColumn: 'span 1' };
  }
  if (layout === 'preview-major' && i === 1) {
    return { gridRow: 'span 1', gridColumn: 'span 1' };
  }
  return {};
}

interface SourcePickerProps {
  sources: SourceDef[];
  onPick: (id: string) => void;
  onPickCustom: (url: string) => void;
  onClose: () => void;
}

function SourcePicker({ sources, onPick, onPickCustom, onClose }: SourcePickerProps) {
  const [custom, setCustom] = useState('');
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0"
        tabIndex={-1}
      />
      <div className="surface rounded-xl p-5 max-w-md w-full relative z-10 space-y-4">
        <header className="flex items-center justify-between">
          <h3 className="display text-base">Scegli sorgente</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none px-2 opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </header>
        <div className="grid grid-cols-2 gap-2">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="surface rounded-md py-3 font-mono text-sm flex flex-col items-center gap-1 hover:opacity-80"
            >
              <span className="text-2xl">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="pt-3 border-t border-current/10 space-y-2">
          <label className="text-xs opacity-70 font-mono block">
            URL custom
            <input
              type="url"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="https://…"
              className="w-full bg-black/40 border border-current/20 rounded-md px-3 py-2 font-mono text-sm outline-none mt-1"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => onPickCustom(custom.trim())}
          className="w-full neon-border rounded-md py-2 font-mono uppercase tracking-wider text-sm disabled:opacity-40"
        >
          Usa URL
        </button>
      </div>
    </div>
  );
}
