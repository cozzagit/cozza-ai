import { useMemo } from 'react';
import type { CockpitEvent } from '../bus';

export function Metrics({ events }: { events: CockpitEvent[] }) {
  const latest = useMemo(() => {
    const map = new Map<string, CockpitEvent>();
    for (const e of events) {
      if (e.type !== 'metric') continue;
      const src = String(e.source ?? '');
      if (!map.has(src)) map.set(src, e);
    }
    return [...map.values()].sort((a, b) =>
      String(a.source ?? '').localeCompare(String(b.source ?? '')),
    );
  }, [events]);

  return (
    <div className="space-y-3">
      <h2 className="display text-lg glow-cyan">PM2 Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {latest.length === 0 && (
          <div className="surface rounded-xl p-4 col-span-full text-sm opacity-60">
            {`Nessuna metrica. L'adapter PM2 fa SSH al VPS ogni 30s.`}
          </div>
        )}
        {latest.map((m) => {
          const cpu = typeof m.cpu === 'number' ? m.cpu : null;
          const ram = typeof m.ram === 'number' ? Math.round(m.ram / 1024 / 1024) : null;
          return (
            <article key={String(m.source)} className="surface rounded-xl p-4">
              <div className="font-mono text-sm font-semibold truncate mb-3">
                {String(m.source)}
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <div className="opacity-60 uppercase tracking-wider">CPU</div>
                  <div className="display text-2xl glow-cyan mt-1">
                    {cpu !== null ? `${cpu.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="opacity-60 uppercase tracking-wider">RAM</div>
                  <div className="display text-2xl glow-magenta mt-1">
                    {ram !== null ? `${ram}MB` : '—'}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
