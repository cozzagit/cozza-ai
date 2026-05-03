import { useMemo } from 'react';
import type { CockpitEvent } from '../bus';

export function Stream({ events }: { events: CockpitEvent[] }) {
  const claudeEvents = useMemo(
    () => events.filter((e) => e.type === 'claude').slice(0, 30),
    [events],
  );
  return (
    <div className="space-y-3">
      <h2 className="display text-lg glow-cyan">Claude Stream</h2>
      {claudeEvents.length === 0 ? (
        <div className="surface rounded-xl p-4 text-sm opacity-60">
          {`Nessun evento Claude. L'adapter parserà i log di sessione di Claude Code.`}
        </div>
      ) : (
        <div className="space-y-2">
          {claudeEvents.map((e, i) => (
            <article key={i} className="surface rounded-xl p-3 font-mono text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="opacity-60">{new Date(e.ts).toLocaleTimeString('it-IT')}</span>
                {typeof e.progress === 'number' && (
                  <span className="display glow-cyan">{Math.round(e.progress * 100)}%</span>
                )}
              </div>
              <div className="whitespace-pre-wrap">{String(e.msg ?? '')}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
