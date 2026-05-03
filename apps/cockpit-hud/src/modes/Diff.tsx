import { useMemo } from 'react';
import type { CockpitEvent } from '../bus';

export function Diff({ events }: { events: CockpitEvent[] }) {
  const gitEvents = useMemo(() => events.filter((e) => e.type === 'git').slice(0, 25), [events]);
  return (
    <div className="space-y-3">
      <h2 className="display text-lg glow-cyan">Git Activity</h2>
      {gitEvents.length === 0 ? (
        <div className="surface rounded-xl p-4 text-sm opacity-60">
          {`Nessuna attività git. Fai un commit per vedere l'evento qui.`}
        </div>
      ) : (
        <div className="space-y-2">
          {gitEvents.map((e, i) => (
            <article key={i} className="surface rounded-xl p-3 font-mono text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold">{e.project ?? '—'}</span>
                <span className="opacity-60">{new Date(e.ts).toLocaleTimeString('it-IT')}</span>
              </div>
              <div className="flex items-center gap-3 opacity-80">
                <span className="pill pill-unknown">{String(e.action ?? '')}</span>
                <span className="opacity-60">{String(e.ref ?? '')}</span>
                <span className="font-mono opacity-90 truncate">
                  {String(e.hash ?? '').slice(0, 8)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
