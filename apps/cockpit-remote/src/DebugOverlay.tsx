import { useEffect, useState } from 'react';

/**
 * On-screen log viewer for the Remote PWA. Captures console.warn /
 * .log / .error / .info into a buffer and renders the last 30 entries
 * inside a draggable bottom sheet, so we can debug voice/intent flow
 * directly on the Pixel without chrome://inspect (USB debugging,
 * driver, cable). Toggleable from a small ⓘ button in the bottom-left
 * corner — out of the way until you actually need it.
 */

interface LogEntry {
  ts: number;
  level: 'log' | 'warn' | 'error' | 'info';
  text: string;
}

const buffer: LogEntry[] = [];
const subscribers = new Set<() => void>();
let installed = false;

function installConsoleHook(): void {
  if (installed || typeof console === 'undefined') return;
  installed = true;
  (['log', 'warn', 'error', 'info'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      const text = args
        .map((a) =>
          typeof a === 'string'
            ? a
            : typeof a === 'object' && a !== null
              ? safeStringify(a)
              : String(a),
        )
        .join(' ');
      buffer.push({ ts: Date.now(), level, text });
      if (buffer.length > 200) buffer.shift();
      subscribers.forEach((fn) => fn());
    };
  });
}

function safeStringify(o: unknown): string {
  try {
    return JSON.stringify(o);
  } catch {
    return String(o);
  }
}

export function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    installConsoleHook();
    const update = (): void => setEntries([...buffer].slice(-50));
    update();
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle debug log"
        title="Debug log"
        style={{
          position: 'fixed',
          left: 8,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          zIndex: 60,
          width: 32,
          height: 32,
          padding: 0,
          minHeight: 0,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(0,229,255,0.4)',
          color: '#00E5FF',
          fontSize: 14,
          fontFamily: 'monospace',
        }}
      >
        ⓘ
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 'auto 0 0 0',
            zIndex: 55,
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
            background: 'rgba(0,0,0,0.95)',
            borderTop: '1px solid rgba(0,229,255,0.3)',
            maxHeight: '50vh',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              position: 'sticky',
              top: 0,
              background: 'rgba(0,0,0,0.95)',
            }}
          >
            <span style={{ color: '#00E5FF' }}>Debug log ({entries.length})</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  buffer.length = 0;
                  setEntries([]);
                }}
                style={{
                  minHeight: 0,
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                Pulisci
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = entries
                    .map(
                      (e) =>
                        `${new Date(e.ts).toLocaleTimeString()} ${e.level.toUpperCase()} ${e.text}`,
                    )
                    .join('\n');
                  void navigator.clipboard.writeText(text);
                }}
                style={{
                  minHeight: 0,
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                Copia
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  minHeight: 0,
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            {entries.length === 0 ? (
              <div style={{ opacity: 0.5, padding: '8px 4px' }}>
                Nessun log ancora. Fai qualcosa nella PWA e i console.warn appariranno qui.
              </div>
            ) : (
              entries
                .slice()
                .reverse()
                .map((e, i) => (
                  <div
                    key={`${e.ts}-${i}`}
                    style={{
                      padding: '2px 0',
                      color:
                        e.level === 'error'
                          ? '#ff6b6b'
                          : e.level === 'warn'
                            ? '#ffb300'
                            : 'rgba(255,255,255,0.85)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      wordBreak: 'break-all',
                    }}
                  >
                    <span style={{ opacity: 0.5, marginRight: 6 }}>
                      {new Date(e.ts).toLocaleTimeString('it-IT', { hour12: false })}
                    </span>
                    {e.text}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
