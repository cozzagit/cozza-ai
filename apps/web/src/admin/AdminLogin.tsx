import { useEffect, useRef, useState } from 'react';

interface AdminLoginProps {
  onSubmit: (pin: string) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
}

export function AdminLogin({ onSubmit }: AdminLoginProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tryLogin = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await onSubmit(value);
    if (!r.ok) {
      setError(r.error);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 400);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    setBusy(false);
  };

  const onKey = (digit: string): void => {
    if (digit === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (digit === 'clear') {
      setPin('');
      return;
    }
    setPin((p) => {
      const next = (p + digit).slice(0, 6);
      if (next.length === 6) {
        void tryLogin(next);
      }
      return next;
    });
  };

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-oled">
      <div
        className={[
          'w-full max-w-sm rounded-3xl glass-surface p-8 transition-transform',
          shake ? 'animate-[shake_0.4s_ease-in-out]' : '',
        ].join(' ')}
      >
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-full bg-accent/10 border border-accent/30 items-center justify-center mb-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Admin cozza-ai</h1>
          <p className="text-sm text-muted-fg/70 mt-1">Inserisci il PIN a 6 cifre</p>
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPin(v);
            if (v.length === 6) void tryLogin(v);
          }}
          className="sr-only"
          aria-label="PIN"
        />

        <div className="flex justify-center gap-3 mb-6">
          {dots.map((on, i) => (
            <div
              key={i}
              className={[
                'w-3.5 h-3.5 rounded-full border-2 transition-all',
                on
                  ? 'bg-accent border-accent shadow-[0_0_8px_rgba(0,229,255,0.55)]'
                  : 'border-white/15',
              ].join(' ')}
              aria-hidden
            />
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-md px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => onKey(k)}
                className={[
                  'focus-accent h-14 rounded-2xl text-lg font-medium select-none transition-colors',
                  k === 'clear' || k === 'back'
                    ? 'text-muted-fg hover:text-white hover:bg-white/5 text-sm'
                    : 'glass-surface hover:bg-white/5',
                ].join(' ')}
                aria-label={k === 'back' ? 'Cancella ultima cifra' : k === 'clear' ? 'Pulisci' : k}
              >
                {k === 'back' ? '⌫' : k === 'clear' ? 'CLR' : k}
              </button>
            ),
          )}
        </div>

        <p className="text-xs text-muted-fg/50 text-center mt-6">
          5 tentativi falliti → blocco di 15 minuti
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
