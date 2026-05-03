import { useEffect } from 'react';
import { useRemoteStore, type RemoteMode } from './store';
import { useCockpitBus, type CockpitEvent } from './bus';
import { Trackpad } from './Trackpad';
import { Voice } from './Voice';

const MODES: { id: RemoteMode; icon: string; label: string }[] = [
  { id: 'home', icon: '◉', label: 'Home' },
  { id: 'trackpad', icon: '🖱', label: 'Trackpad' },
  { id: 'switcher', icon: '⟳', label: 'Switch' },
  { id: 'actions', icon: '⚡', label: 'Actions' },
  { id: 'voice', icon: '🎤', label: 'Voice' },
];

export function App() {
  const mode = useRemoteStore((s) => s.mode);
  const setMode = useRemoteStore((s) => s.setMode);
  const token = useRemoteStore((s) => s.token);
  const setToken = useRemoteStore((s) => s.setToken);
  const { connected, events, send, vibrate } = useCockpitBus(80);

  useEffect(() => {
    document.documentElement.classList.add('theme-cyberpunk');
  }, []);

  if (!token) return <TokenPrompt onSubmit={setToken} />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header connected={connected} />
      <main className="flex-1 px-3 pb-24 pt-3 overflow-y-auto">
        {mode === 'home' && <Home events={events} onSelect={(p) => console.log('select', p)} />}
        {mode === 'trackpad' && (
          <TrackpadView
            onMove={(dx, dy) => send({ kind: 'input', type: 'mouseMove', payload: { dx, dy } })}
            onClick={(button, double) => {
              vibrate(8);
              send({ kind: 'input', type: 'mouseClick', payload: { button, double } });
            }}
            onScroll={(dy) => send({ kind: 'input', type: 'mouseScroll', payload: { dy } })}
            onKill={() => send({ kind: 'killswitch', killCode: prompt('Kill code:') ?? '' })}
          />
        )}
        {mode === 'switcher' && (
          <Switcher
            onPick={(hudMode) => {
              vibrate(8);
              send({
                kind: 'broadcast',
                target: 'hud',
                command: 'hud.setMode',
                args: { mode: hudMode },
              });
            }}
            onToggleTheme={() => {
              vibrate(8);
              send({ kind: 'broadcast', target: 'hud', command: 'hud.toggleTheme' });
            }}
          />
        )}
        {mode === 'actions' && (
          <Actions
            onAction={(name) => {
              vibrate(12);
              send({
                kind: 'broadcast',
                target: 'desktop',
                command: name,
              });
            }}
          />
        )}
        {mode === 'voice' && (
          <Voice
            onCommand={(cmd) => {
              vibrate(12);
              send({
                kind: 'broadcast',
                target: cmd.target,
                command: cmd.command,
                ...(cmd.args ? { args: cmd.args } : {}),
              });
            }}
          />
        )}
      </main>
      <BottomNav current={mode} onChange={setMode} />
    </div>
  );
}

function Header({ connected }: { connected: boolean }) {
  return (
    <header className="px-3 pt-3 pb-2 flex items-center justify-between">
      <div className="display text-base glow-cyan">📱 COZZA · REMOTE</div>
      <span className={connected ? 'pill pill-ok' : 'pill pill-down'}>
        {connected ? '● online' : '○ offline'}
      </span>
    </header>
  );
}

function BottomNav({
  current,
  onChange,
}: {
  current: RemoteMode;
  onChange: (m: RemoteMode) => void;
}) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-black/95 backdrop-blur border-t border-current/10">
      <div className="grid grid-cols-5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(4);
              onChange(m.id);
            }}
            className={[
              'flex flex-col items-center py-2 text-[11px] font-mono uppercase tracking-wider',
              current === m.id ? 'text-accent glow-cyan' : 'opacity-60',
            ].join(' ')}
          >
            <span className="text-lg leading-none mb-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Home({
  events,
  onSelect,
}: {
  events: CockpitEvent[];
  onSelect: (project: string) => void;
}) {
  const projects = Array.from(
    new Map(
      events.filter((e) => e.type === 'health').map((e) => [String(e.project ?? ''), e]),
    ).values(),
  ).filter((e) => e.project);
  return (
    <div className="space-y-2">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider px-1">Progetti</h2>
      {projects.length === 0 && <p className="opacity-50 text-sm px-2">In attesa di health…</p>}
      {projects.map((p) => (
        <button
          key={String(p.project)}
          type="button"
          onClick={() => onSelect(String(p.project))}
          className="surface rounded-xl w-full p-3 flex items-center justify-between text-left"
        >
          <div>
            <div className="font-mono font-semibold">{String(p.project)}</div>
            {typeof p.url === 'string' && (
              <div className="text-[11px] opacity-60 font-mono truncate">{p.url}</div>
            )}
          </div>
          <span className={`pill pill-${String(p.status ?? 'unknown')}`}>
            {String(p.status ?? '?')}
          </span>
        </button>
      ))}
    </div>
  );
}

interface TrackpadViewProps {
  onMove: (dx: number, dy: number) => void;
  onClick: (button: 'left' | 'right' | 'middle', double?: boolean) => void;
  onScroll: (dy: number) => void;
  onKill: () => void;
}
function TrackpadView({ onMove, onClick, onScroll, onKill }: TrackpadViewProps) {
  return (
    <div className="space-y-2">
      <Trackpad onMove={onMove} onClick={onClick} onScroll={onScroll} />
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onClick('left')}
          className="surface rounded-xl py-3 font-mono text-sm"
        >
          ⊙ Click
        </button>
        <button
          type="button"
          onClick={() => onClick('left', true)}
          className="surface rounded-xl py-3 font-mono text-sm"
        >
          ⊙⊙ Double
        </button>
        <button
          type="button"
          onClick={() => onClick('right')}
          className="surface rounded-xl py-3 font-mono text-sm"
        >
          ⊙ Right
        </button>
      </div>
      <button
        type="button"
        onClick={onKill}
        className="w-full rounded-xl py-3 font-mono text-sm bg-red-950/40 border border-red-900/40 text-red-300"
      >
        ⛔ KILLSWITCH
      </button>
    </div>
  );
}

function Switcher({
  onPick,
  onToggleTheme,
}: {
  onPick: (m: string) => void;
  onToggleTheme: () => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider">HUD Mode</h2>
      <div className="grid grid-cols-2 gap-2">
        {['vitals', 'stream', 'logs', 'diff', 'metrics', 'spend', 'pomodoro', 'ambient'].map(
          (m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              className="surface rounded-xl py-4 font-mono text-sm uppercase"
            >
              {m}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={onToggleTheme}
        className="w-full surface rounded-xl py-3 font-mono text-sm uppercase mt-2"
      >
        🎨 Toggle theme (Cyber/Bauhaus)
      </button>
    </div>
  );
}

function Actions({ onAction }: { onAction: (name: string) => void }) {
  const list = [
    'deploy:web',
    'deploy:api',
    'restart:pm2',
    'lint:all',
    'lighthouse',
    'open:vps-monitor',
  ];
  return (
    <div className="space-y-2">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider px-1">Action Pad</h2>
      <div className="grid grid-cols-2 gap-2">
        {list.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onAction(a)}
            className="surface rounded-xl py-4 font-mono text-sm"
          >
            ⚡ {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenPrompt({ onSubmit }: { onSubmit: (t: string) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        className="surface rounded-xl p-6 w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = (f.get('token') ?? '') as string;
          if (t.trim()) onSubmit(t.trim());
        }}
      >
        <h1 className="display text-xl glow-cyan">📱 Cozza Remote</h1>
        <p className="text-xs opacity-70">JWT token cockpit-bus</p>
        <input
          name="token"
          type="password"
          autoComplete="off"
          inputMode="text"
          className="w-full bg-black/40 border border-current/20 rounded-md px-3 py-3 font-mono text-sm outline-none"
          placeholder="JWT…"
        />
        <button
          type="submit"
          className="w-full rounded-md py-3 font-mono uppercase tracking-wider border border-current/40"
        >
          Connetti
        </button>
      </form>
    </div>
  );
}
