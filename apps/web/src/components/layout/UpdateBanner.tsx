import { useEffect, useState } from 'react';

/**
 * Listens for vite-plugin-pwa update events. When a new SW activates,
 * tells the user and offers a one-click reload. Also auto-reloads after
 * 5 seconds because mobile users may not see the banner.
 */
export function UpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Dynamic import so this code is excluded from non-PWA dev runs.
    void (async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        registerSW({
          onNeedRefresh: () => {
            if (mounted) setNeedRefresh(true);
          },
          onOfflineReady: () => {
            // no-op
          },
          immediate: true,
        });
      } catch {
        // PWA not registered (dev mode without devOptions enabled)
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!needRefresh) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, 8000);
    return () => clearTimeout(t);
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-accent text-black rounded-full px-4 py-2 text-sm font-medium shadow-lg flex items-center gap-3 animate-fade-in"
    >
      <span>Nuova versione di cozza-ai disponibile</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="underline underline-offset-2"
      >
        Ricarica
      </button>
    </div>
  );
}
