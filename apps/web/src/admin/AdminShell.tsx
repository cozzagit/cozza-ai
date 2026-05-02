import { useEffect, useState, type ReactNode } from 'react';

export type AdminTab = 'voices' | 'settings' | 'apps' | 'workspaces' | 'maintenance';

const TABS: { id: AdminTab; label: string; icon: string; hash: string }[] = [
  { id: 'voices', label: 'Voci', icon: '🎙️', hash: 'voices' },
  { id: 'settings', label: 'Modello & Persona', icon: '🧠', hash: 'settings' },
  { id: 'apps', label: 'App', icon: '🚀', hash: 'apps' },
  { id: 'workspaces', label: 'Workspaces', icon: '🪟', hash: 'workspaces' },
  { id: 'maintenance', label: 'Manutenzione', icon: '🛠️', hash: 'maintenance' },
];

interface AdminShellProps {
  initialTab?: AdminTab;
  onLogout: () => void;
  onClose: () => void;
  children: (tab: AdminTab) => ReactNode;
}

function readHashTab(): AdminTab {
  const h = window.location.hash.replace('#', '').trim();
  const found = TABS.find((t) => t.hash === h);
  return (found?.id ?? 'voices') as AdminTab;
}

export function AdminShell({ onLogout, onClose, children, initialTab }: AdminShellProps) {
  const [tab, setTab] = useState<AdminTab>(initialTab ?? readHashTab());
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onHash = (): void => setTab(readHashTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const switchTab = (next: AdminTab): void => {
    setTab(next);
    const def = TABS.find((t) => t.id === next);
    if (def) window.location.hash = def.hash;
    setNavOpen(false);
  };

  return (
    <div className="h-full w-full flex bg-oled text-white">
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden animate-fade-in"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={[
          'fixed md:static inset-y-0 left-0 z-40 w-64 bg-oled-200 border-r border-white/5 flex flex-col transition-transform',
          navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,229,255,0.8)]"
              aria-hidden
            />
            <span className="font-mono text-sm tracking-wide">cozza-ai · admin</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={[
                'focus-accent w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                tab === t.id
                  ? 'bg-accent/15 text-white'
                  : 'text-muted-fg hover:text-white hover:bg-white/5',
              ].join(' ')}
            >
              <span className="text-lg" aria-hidden>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/5 space-y-1">
          <button
            type="button"
            onClick={onClose}
            className="focus-accent w-full text-left px-3 py-2 rounded-lg text-sm text-muted-fg hover:text-white hover:bg-white/5"
          >
            ← Torna alla chat
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="focus-accent w-full text-left px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-950/40"
          >
            Esci
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="border-b border-white/5 bg-oled-300/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3 max-w-sweet-lg mx-auto w-full">
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Apri/chiudi menu"
              className="focus-accent md:hidden rounded-md p-2 hover:bg-white/5"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold capitalize">
              {TABS.find((t) => t.id === tab)?.label ?? 'Admin'}
            </h2>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-sweet-lg mx-auto w-full p-4 md:p-6">{children(tab)}</div>
        </div>
      </main>
    </div>
  );
}
