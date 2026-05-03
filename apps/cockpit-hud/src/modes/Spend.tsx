import { useMemo } from 'react';
import type { CockpitEvent } from '../bus';

/**
 * Quick view of API quota signals coming from the bus quota adapter.
 * For now: reachability + character balance for ElevenLabs. Anthropic
 * and OpenAI don't expose a balance endpoint without account creds, so
 * we only show "reachable / unreachable".
 */
export function Spend({ events }: { events: CockpitEvent[] }) {
  const latest = useMemo(() => {
    const map = new Map<string, CockpitEvent>();
    for (const e of events) {
      if (e.type !== 'quota') continue;
      const provider = String(e.provider ?? '');
      if (!map.has(provider)) map.set(provider, e);
    }
    return map;
  }, [events]);

  const providers = ['anthropic', 'openai', 'elevenlabs'] as const;

  return (
    <div className="space-y-3">
      <h2 className="display text-lg glow-cyan">API budget</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {providers.map((p) => {
          const e = latest.get(p);
          const remaining = typeof e?.requestsRemaining === 'number' ? e.requestsRemaining : null;
          const message = String(e?.message ?? '—');
          return (
            <article key={p} className="surface rounded-xl p-4">
              <div className="font-mono text-xs uppercase tracking-wider opacity-60 mb-2">{p}</div>
              <div className="display text-3xl glow-cyan">
                {remaining !== null ? remaining.toLocaleString('it-IT') : '—'}
              </div>
              <div className="text-[11px] font-mono opacity-60 mt-2 truncate">{message}</div>
            </article>
          );
        })}
      </div>
      <p className="text-xs opacity-50">
        Anthropic e OpenAI espongono solo reachability senza credenziali account; ElevenLabs include
        anche il balance caratteri.
      </p>
    </div>
  );
}
