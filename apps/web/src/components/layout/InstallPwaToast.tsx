import { useEffect, useState } from 'react';

/**
 * Captures Chrome's `beforeinstallprompt` event so we can offer the
 * user a one-tap install instead of forcing them through the browser
 * menu. The toast appears at the bottom of the screen — non-modal,
 * dismissible, persisted in localStorage so it doesn't reappear for
 * 7 days after a "no thanks".
 *
 * Won't show:
 *  - if the PWA is already installed (display-mode: standalone)
 *  - if the user dismissed within 7 days
 *  - if the browser doesn't fire beforeinstallprompt (Firefox, iOS Safari)
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const STORAGE_KEY = 'cozza-install-dismissed-at';
const COOLDOWN_MS = 7 * 24 * 3600 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari home-screen exposes navigator.standalone
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function InstallPwaToast() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (isRecentlyDismissed()) {
      setDismissed(true);
      return;
    }
    const onBeforeInstall = (e: Event): void => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onInstall = async (): Promise<void> => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        setDismissed(true);
      }
    } catch {
      // browser refused — keep showing
    } finally {
      setEvt(null);
    }
  };

  const onDismiss = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (installed || dismissed || !evt) return null;

  return (
    <div
      role="dialog"
      aria-label="Installa cozza-ai"
      className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-sm z-40 animate-fade-in"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="glass-surface rounded-2xl p-3 flex items-center gap-3 shadow-xl border border-accent/30">
        <div className="text-2xl shrink-0" aria-hidden>
          🛸
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">Installa cozza-ai</div>
          <div className="text-xs text-muted-fg/80 mt-0.5">
            App standalone, niente barra browser, voice + Cockpit più rapidi.
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Chiudi"
            className="text-muted-fg/70 hover:text-white text-xl leading-none px-2 py-1"
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => void onInstall()}
            className="focus-accent rounded-full bg-accent text-black font-medium px-4 py-2 text-sm"
          >
            Installa
          </button>
        </div>
      </div>
    </div>
  );
}
