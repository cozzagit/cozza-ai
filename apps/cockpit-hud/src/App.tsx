import { useEffect, useRef, useState } from 'react';
import { useCockpitStore, type HudMode, type ThemeId } from './store';
import { useCockpitBus, type CockpitEvent } from './bus';
import { Vitals } from './modes/Vitals';
import { Stream } from './modes/Stream';
import { Logs } from './modes/Logs';
import { Metrics } from './modes/Metrics';
import { Ambient } from './modes/Ambient';
import { Diff } from './modes/Diff';
import { Pomodoro } from './modes/Pomodoro';
import { Spend } from './modes/Spend';
import { Devstation } from './modes/Devstation';
import { PointerOverlay } from './PointerOverlay';
import { DebugOverlay } from './DebugOverlay';

/**
 * App presets reachable from voice / Pixel ("ehi cozza, metti netflix").
 * `drm: true` means the site refuses to be iframed — we open it in a
 * new full-screen tab. Embed-friendly sites load inside Devstation.
 */
const APP_PRESETS: Record<string, { url: string; drm: boolean; label: string }> = {
  netflix: { url: 'https://www.netflix.com', drm: true, label: 'Netflix' },
  dazn: { url: 'https://www.dazn.com/it-IT/home', drm: true, label: 'DAZN' },
  prime: { url: 'https://www.primevideo.com', drm: true, label: 'Prime Video' },
  disney: { url: 'https://www.disneyplus.com', drm: true, label: 'Disney+' },
  spotify: { url: 'https://open.spotify.com', drm: false, label: 'Spotify' },
  youtube: { url: 'https://www.youtube.com', drm: false, label: 'YouTube' },
  twitch: { url: 'https://www.twitch.tv', drm: false, label: 'Twitch' },
};

const MODES: { id: HudMode; label: string; icon: string }[] = [
  { id: 'devstation', label: 'Devstation', icon: '💻' },
  { id: 'vitals', label: 'Vitals', icon: '◉' },
  { id: 'stream', label: 'Stream', icon: '⟴' },
  { id: 'logs', label: 'Logs', icon: '☰' },
  { id: 'diff', label: 'Diff', icon: '⟷' },
  { id: 'metrics', label: 'Metrics', icon: '∿' },
  { id: 'spend', label: 'Spend', icon: '$' },
  { id: 'pomodoro', label: 'Pomo', icon: '◯' },
  { id: 'ambient', label: 'Ambient', icon: '◐' },
];

export function App() {
  const theme = useCockpitStore((s) => s.theme);
  const mode = useCockpitStore((s) => s.mode);
  const setMode = useCockpitStore((s) => s.setMode);
  const token = useCockpitStore((s) => s.token);
  const setToken = useCockpitStore((s) => s.setToken);
  const toggleTheme = useCockpitStore((s) => s.toggleTheme);

  // VS Code webview / external link can hydrate token via #token=…
  useEffect(() => {
    if (token) return;
    const m = /#token=([^&]+)/.exec(window.location.hash);
    if (m?.[1]) {
      setToken(decodeURIComponent(m[1]));
      // strip from URL so it's not visible
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [token, setToken]);

  // ?logout=1 → wipe token and any cached cockpit state. Lets the user
  // disconnect without opening DevTools to clear localStorage by hand.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get('logout') === '1') {
      setToken('');
      try {
        localStorage.removeItem('cozza-cockpit-hud');
      } catch {
        // ignore
      }
      u.searchParams.delete('logout');
      history.replaceState(null, '', u.pathname + (u.search ? u.search : ''));
    }
  }, [setToken]);

  const { connected, events, error, send } = useCockpitBus(500);

  // React to remote `command` events — this is how Pixel/voice tells the HUD
  // to switch mode, change theme, etc. We dedupe by id and process the most
  // recent command in the buffer. Listening on `events` (capped) is fine
  // because the user can't realistically generate more than a few per second.
  const lastCmdRef = useRef<string | null>(null);
  useEffect(() => {
    const cmd = events.find((e) => e.type === 'command');
    if (!cmd) return;
    const id = String(cmd.id ?? '');
    if (!id || id === lastCmdRef.current) return;
    const target = String(cmd.target ?? 'all');
    if (target !== 'all' && target !== 'hud') return;
    lastCmdRef.current = id;
    const command = String(cmd.command ?? '');
    const args = (cmd.args ?? {}) as Record<string, unknown>;
    console.warn('[hud] command received:', { id, target, command, args });
    if (command === 'hud.setMode' && typeof args.mode === 'string') {
      setMode(args.mode as HudMode);
    } else if (command === 'hud.toggleTheme') {
      toggleTheme();
    } else if (command === 'hud.setTheme' && typeof args.theme === 'string') {
      useCockpitStore.getState().setTheme(args.theme as ThemeId);
    } else if (command === 'app.open') {
      const preset = String(args.preset ?? '');
      const url = String(args.url ?? '');
      const target = APP_PRESETS[preset]?.url ?? url;
      if (!target) return;
      const drm = APP_PRESETS[preset]?.drm ?? false;
      if (drm) {
        // X-Frame-Options DENY on Netflix/DAZN/Prime/Disney → open in
        // new tab; the user navigates with native browser controls.
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        // Embed-friendly: switch to Devstation single-cell with the
        // app URL as the only slot, full immersion.
        try {
          localStorage.setItem('cozza-devstation-layout', JSON.stringify('single'));
          localStorage.setItem('cozza-devstation-slots', JSON.stringify({ 0: 'custom:' + target }));
        } catch {
          // ignore storage failures
        }
        setMode('devstation');
      }
      // Tell the Pixel to switch to D-pad — TV-style apps respond well
      // to arrow navigation. If the user wants the trackpad cursor,
      // they can switch back manually.
      broadcast(send, 'remote', 'remote.setMode', { mode: 'dpad' });
    } else if (command === 'app.close') {
      setMode('vitals');
      broadcast(send, 'remote', 'remote.setMode', { mode: 'home' });
    }
  }, [events, setMode, toggleTheme, send]);

  // Theme class on <html>
  useEffect(() => {
    document.documentElement.classList.remove('theme-cyberpunk', 'theme-bauhaus');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  // Keyboard shortcuts: t = theme, 1..6 = mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') toggleTheme();
      const idx = Number.parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= MODES.length) {
        const next = MODES[idx - 1];
        if (next) setMode(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTheme, setMode]);

  if (!token) return <TokenPrompt onSubmit={setToken} />;

  return (
    <div className="min-h-screen relative grid-bg scanlines overflow-hidden">
      <Header connected={connected} error={error} theme={theme} />
      <ModeSwitcher current={mode} onChange={setMode} />
      <main className="px-6 pb-6 pt-4 max-w-[1600px] mx-auto">
        {mode === 'vitals' && <Vitals events={events} />}
        {mode === 'stream' && <Stream events={events} />}
        {mode === 'logs' && <Logs events={events} />}
        {mode === 'diff' && <Diff events={events} />}
        {mode === 'metrics' && <Metrics events={events} />}
        {mode === 'spend' && <Spend events={events} />}
        {mode === 'pomodoro' && <Pomodoro />}
        {mode === 'devstation' && <Devstation />}
        {mode === 'ambient' && <Ambient />}
      </main>
      <PointerOverlay />
      <DebugOverlay />
    </div>
  );
}

function Header({
  connected,
  error,
  theme,
}: {
  connected: boolean;
  error: string | null;
  theme: ThemeId;
}) {
  const time = useNow();
  return (
    <header className="px-6 pt-4 pb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <a
          href="/"
          aria-label="Torna alla chat cozza-ai"
          title="← Chat"
          className="pill pill-unknown hover:opacity-80 no-underline"
        >
          ← Chat
        </a>
        <div className="display text-xl glow-cyan">🛸 COZZA · COCKPIT</div>
        <span className="text-xs opacity-60 font-mono">v0.1</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className={connected ? 'pill pill-ok' : 'pill pill-down'}>
          {connected ? '● online' : (error ?? '○ offline')}
        </span>
        <span className="opacity-70">{time}</span>
        <button
          type="button"
          onClick={() => useCockpitStore.getState().toggleTheme()}
          className="pill pill-unknown hover:opacity-80"
          title="Cambia tema (t)"
        >
          {theme === 'cyberpunk' ? '⚪ Bauhaus' : '🌆 Cyber'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm('Disconnetti dal cockpit-bus e cancella il token?')) return;
            useCockpitStore.getState().setToken('');
            try {
              localStorage.removeItem('cozza-cockpit-hud');
            } catch {
              // ignore
            }
            window.location.reload();
          }}
          className="pill pill-unknown hover:opacity-80"
          title="Disconnetti (cancella token)"
          aria-label="Logout"
        >
          🚪
        </button>
      </div>
    </header>
  );
}

function ModeSwitcher({ current, onChange }: { current: HudMode; onChange: (m: HudMode) => void }) {
  return (
    <nav className="px-6 pb-3 overflow-x-auto">
      <div className="flex gap-2">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={[
              'px-4 py-2 rounded-md text-sm font-mono uppercase tracking-wider transition-colors',
              current === m.id ? 'neon-border glow-cyan' : 'opacity-60 hover:opacity-100',
            ].join(' ')}
            title={`Tasto ${i + 1}`}
          >
            <span className="mr-2">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function TokenPrompt({ onSubmit }: { onSubmit: (t: string) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 grid-bg scanlines">
      <form
        className="surface rounded-xl p-6 max-w-md w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = (f.get('token') ?? '') as string;
          if (t.trim()) onSubmit(t.trim());
        }}
      >
        <h1 className="display text-2xl glow-cyan">🛸 Cozza Cockpit HUD</h1>
        <p className="text-sm opacity-70">
          Incolla il <strong>token JWT</strong> emesso da <code>cockpit-bus</code> (POST{' '}
          <code>/auth/token</code>) per connetterti.
        </p>
        <input
          name="token"
          type="password"
          autoComplete="off"
          placeholder="JWT token…"
          className="w-full bg-black/40 border border-current/20 rounded-md px-3 py-2 font-mono text-sm outline-none focus:border-current"
        />
        <button
          type="submit"
          className="w-full neon-border rounded-md px-4 py-2 text-sm font-mono uppercase tracking-wider hover:opacity-80"
        >
          Connetti
        </button>
        <p className="text-[10px] opacity-50 font-mono">
          Esempio dev:
          <br />
          <code className="break-all">
            {`curl -X POST http://localhost:3030/auth/token -H 'content-type: application/json' -d '{"pin":"YOUR_PIN"}'`}
          </code>
        </p>
      </form>
    </div>
  );
}

function useNow(): string {
  const fmt = (): string =>
    new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export type { CockpitEvent };

/**
 * Re-broadcasts a command via the cockpit-bus WebSocket. Used by the
 * HUD to follow up on its own command handlers (e.g. after opening an
 * app, also tell the Remote to switch input mode).
 */
function broadcast(
  send: (frame: Record<string, unknown>) => void,
  target: 'hud' | 'desktop' | 'remote' | 'all',
  command: string,
  args?: Record<string, unknown>,
): void {
  send({
    kind: 'broadcast',
    target,
    command,
    ...(args ? { args } : {}),
  });
}
