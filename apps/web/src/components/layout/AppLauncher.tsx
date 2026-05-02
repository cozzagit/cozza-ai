import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppTile } from '@/lib/db';

interface AppLauncherProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<AppTile['category'], string> = {
  streaming: '📺 Cinema & Streaming',
  music: '🎧 Musica',
  ai: '🤖 AI',
  work: '💻 Lavoro',
  study: '📚 Studio',
  social: '🌐 Social',
  other: '📦 Altro',
};

const CATEGORY_ORDER: AppTile['category'][] = [
  'streaming',
  'music',
  'ai',
  'work',
  'study',
  'social',
  'other',
];

/**
 * Dropdown / drawer that lists the launcher tiles configured in /admin#apps.
 * Tap a tile to open the app: Android intent first if present (deep-links the
 * native app from a PWA), web URL fallback.
 *
 * Future V1: the wake word "Ehy Cozza, guardiamo Netflix" will route through
 * the same intent dispatcher to call openApp(tileId).
 */
export function AppLauncher({ open, onClose }: AppLauncherProps) {
  const tilesRaw = useLiveQuery(() => db.apps.orderBy('sortOrder').toArray());
  const grouped = useMemo(() => {
    const tiles = tilesRaw ?? [];
    const out: { cat: AppTile['category']; items: AppTile[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = tiles.filter((t) => t.category === cat);
      if (items.length > 0) out.push({ cat, items });
    }
    return out;
  }, [tilesRaw]);

  if (!open) return null;

  const openTile = (tile: AppTile): void => {
    onClose();
    // Try the Android intent first when running in a PWA on Android.
    // Fallback to plain URL — opens in a new tab (or the OS-registered handler
    // if installed natively).
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    if (isAndroid && tile.androidIntent) {
      window.location.href = tile.androidIntent;
      return;
    }
    window.open(tile.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Launcher app"
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] md:w-[480px] bg-oled-200 border-l border-white/10 flex flex-col animate-slide-up"
      >
        <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-medium">🚀 App</h2>
            <p className="text-[11px] text-muted-fg/70 mt-0.5">
              Tocca per aprire · gestione in /admin#apps
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="text-muted-fg hover:text-white text-xl leading-none px-2"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-fg/60 text-center py-12">
              Nessuna app configurata. Vai in <span className="font-mono">/admin#apps</span> per
              aggiungerle (o resetta i built-in).
            </p>
          )}
          {grouped.map((g) => {
            const pinned = g.items.filter((t) => t.pinned);
            const rest = g.items.filter((t) => !t.pinned);
            const items = pinned.concat(rest);
            return (
              <section key={g.cat}>
                <h3 className="text-xs font-semibold text-muted-fg/70 mb-2 px-1">
                  {CATEGORY_LABELS[g.cat]}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTile(t)}
                      title={`${t.name} · ${(() => {
                        try {
                          return new URL(t.url).hostname;
                        } catch {
                          return t.url;
                        }
                      })()}`}
                      className="focus-accent rounded-xl glass-surface aspect-square flex flex-col items-center justify-center gap-1 p-2 hover:bg-white/5 active:scale-95 transition-transform relative"
                    >
                      <span className="text-3xl leading-none" aria-hidden>
                        {t.icon.startsWith('emoji:') ? t.icon.slice(6) : '📦'}
                      </span>
                      <span className="text-[11px] font-medium truncate w-full text-center">
                        {t.name}
                      </span>
                      {t.pinned && (
                        <span
                          className="absolute top-1 right-1 text-[8px] text-accent"
                          aria-hidden
                          title="Pinned"
                        >
                          📌
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <footer className="px-4 py-3 border-t border-white/5 text-[10px] text-muted-fg/50">
          🔮 Coming V1: <em>“Ehy Cozza, guardiamo Netflix”</em> aprirà direttamente la tile
          corrispondente via wake word.
        </footer>
      </aside>
    </>
  );
}
