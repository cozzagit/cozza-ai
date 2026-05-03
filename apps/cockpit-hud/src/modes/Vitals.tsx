import { useMemo } from 'react';
import type { CockpitEvent } from '../bus';

interface VitalsProps {
  events: CockpitEvent[];
}

interface ProjectVital {
  project: string;
  status: 'ok' | 'warn' | 'down' | 'unknown';
  latency: number | null;
  url: string | null;
  ts: number;
}

export function Vitals({ events }: VitalsProps) {
  const projects = useMemo<ProjectVital[]>(() => {
    const map = new Map<string, ProjectVital>();
    for (const e of events) {
      if (e.type !== 'health') continue;
      const project = e.project ?? 'unknown';
      if (map.has(project)) continue;
      map.set(project, {
        project,
        status: (e.status as ProjectVital['status']) ?? 'unknown',
        latency: typeof e.latencyMs === 'number' ? e.latencyMs : null,
        url: typeof e.url === 'string' ? e.url : null,
        ts: e.ts,
      });
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const order = { down: 0, warn: 1, unknown: 2, ok: 3 } as const;
      return order[a.status] - order[b.status] || a.project.localeCompare(b.project);
    });
    return list;
  }, [events]);

  const counts = useMemo(() => {
    return projects.reduce(
      (acc, p) => ((acc[p.status] = (acc[p.status] ?? 0) + 1), acc),
      {} as Record<string, number>,
    );
  }, [projects]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Online" value={counts.ok ?? 0} tone="ok" />
        <Stat label="Warning" value={counts.warn ?? 0} tone="warn" />
        <Stat label="Down" value={counts.down ?? 0} tone="down" />
        <Stat label="Tot" value={projects.length} tone="unknown" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.length === 0 && (
          <div className="surface rounded-xl p-4 col-span-full text-sm opacity-60">
            In attesa di eventi health dal bus…
          </div>
        )}
        {projects.map((p) => (
          <article key={p.project} className="surface rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-mono font-semibold truncate">{p.project}</div>
              <span className={`pill pill-${p.status}`}>{p.status}</span>
            </div>
            {p.url && <div className="text-xs opacity-60 font-mono truncate mb-3">{p.url}</div>}
            <div className="flex items-end justify-between text-xs font-mono">
              <span className="opacity-60">latency</span>
              <span className="display text-2xl glow-cyan">
                {p.latency !== null ? `${p.latency}ms` : '—'}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'down' | 'unknown';
}) {
  return (
    <div className="surface rounded-xl p-4">
      <div className="text-xs opacity-60 uppercase tracking-wider">{label}</div>
      <div
        className={`display text-3xl mt-1 ${tone === 'ok' ? 'glow-cyan' : tone === 'down' ? 'glow-magenta' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
