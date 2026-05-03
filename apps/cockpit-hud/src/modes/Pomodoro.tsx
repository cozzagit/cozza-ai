import { useEffect, useState } from 'react';

type Phase = 'work' | 'break' | 'idle';

const WORK_MIN = 25;
const BREAK_MIN = 5;

/**
 * Slow-breathing Pomodoro timer. Designed to be glanceable on Viture
 * — big numbers, low frame rate, no animations beyond a single ring.
 *
 * State persisted in sessionStorage so reload during a session
 * resumes where it was.
 */
export function Pomodoro() {
  const [phase, setPhase] = useState<Phase>(
    () => (sessionStorage.getItem('pomo-phase') as Phase) ?? 'idle',
  );
  const [endsAt, setEndsAt] = useState<number>(() =>
    Number(sessionStorage.getItem('pomo-endsAt') ?? 0),
  );
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Auto-advance work → break → work
  useEffect(() => {
    if (phase === 'idle') return;
    if (now < endsAt) return;
    const next: Phase = phase === 'work' ? 'break' : 'work';
    const dur = next === 'work' ? WORK_MIN : BREAK_MIN;
    setPhase(next);
    const ends = Date.now() + dur * 60_000;
    setEndsAt(ends);
    sessionStorage.setItem('pomo-phase', next);
    sessionStorage.setItem('pomo-endsAt', String(ends));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
      navigator.vibrate([200, 100, 200]);
  }, [now, phase, endsAt]);

  const start = (): void => {
    const ends = Date.now() + WORK_MIN * 60_000;
    setPhase('work');
    setEndsAt(ends);
    sessionStorage.setItem('pomo-phase', 'work');
    sessionStorage.setItem('pomo-endsAt', String(ends));
  };
  const stop = (): void => {
    setPhase('idle');
    setEndsAt(0);
    sessionStorage.removeItem('pomo-phase');
    sessionStorage.removeItem('pomo-endsAt');
  };

  const remainingMs = Math.max(0, endsAt - now);
  const min = Math.floor(remainingMs / 60_000);
  const sec = Math.floor((remainingMs % 60_000) / 1000);
  const total = (phase === 'work' ? WORK_MIN : BREAK_MIN) * 60_000;
  const progress = phase === 'idle' ? 0 : 1 - remainingMs / total;

  return (
    <div className="surface rounded-xl p-12 flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-xs uppercase tracking-[0.3em] opacity-60">{phase}</div>
      <div className="relative w-64 h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="6"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke={phase === 'break' ? '#FFB300' : '#00E5FF'}
            strokeWidth="6"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 500ms linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="display text-6xl glow-cyan">
            {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={start}
            className="neon-border rounded-md px-6 py-2 font-mono uppercase tracking-wider"
          >
            ▶ Start 25/5
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="neon-border rounded-md px-6 py-2 font-mono uppercase tracking-wider"
          >
            ⏹ Stop
          </button>
        )}
      </div>
    </div>
  );
}
