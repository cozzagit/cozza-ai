import { useMemo, useState } from 'react';
import type { CockpitEvent } from '../bus';

export function Logs({ events }: { events: CockpitEvent[] }) {
  const [filter, setFilter] = useState('');
  const logs = useMemo(() => {
    return events
      .filter((e) => e.type === 'log')
      .filter((e) => !filter || JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
      .slice(0, 200);
  }, [events, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-lg glow-cyan">Logs</h2>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter…"
          className="font-mono text-xs px-3 py-1.5 rounded-md bg-black/40 border border-current/20 outline-none focus:border-current"
        />
      </div>
      <div className="surface rounded-xl p-3 max-h-[70vh] overflow-y-auto font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          <div className="opacity-60">Nessun log al momento.</div>
        ) : (
          logs.map((e, i) => {
            const level = String(e.level ?? 'info');
            const color = level === 'error' ? '#FF3366' : level === 'warn' ? '#FFB300' : 'inherit';
            return (
              <div key={i} className="flex gap-2 items-start">
                <span className="opacity-50 shrink-0 w-20">
                  {new Date(e.ts).toLocaleTimeString('it-IT')}
                </span>
                <span style={{ color }} className="shrink-0 w-12 uppercase">
                  {level}
                </span>
                <span className="opacity-70 shrink-0 w-24 truncate">{e.project ?? '—'}</span>
                <span className="whitespace-pre-wrap break-all">{String(e.line ?? '')}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
