import { bus } from '../bus.js';
import { config } from '../config.js';
import { loadProjects, type ProjectEntry } from '../catalog.js';
import type { CockpitEvent } from '../events.js';

/**
 * Health adapter: every N seconds, HEAD/GET each project's URL with a
 * tight timeout, classify (ok < 1s, warn < 3s, down else) and publish.
 */
export function startHealthAdapter(): () => void {
  const intervalMs = config.healthPollSeconds * 1000;
  let projects: ProjectEntry[] = loadProjects();
  let stopped = false;

  // re-read catalog every 10 minutes (the user edits all-projects.md)
  const reloadTimer = setInterval(() => {
    projects = loadProjects();
  }, 10 * 60_000);

  const tick = async (): Promise<void> => {
    if (stopped) return;
    await Promise.allSettled(
      projects
        .filter((p) => p.url)
        .map(async (p) => {
          const ev = await pingProject(p);
          bus.emitEvent(ev);
        }),
    );
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
    clearInterval(reloadTimer);
  };
}

async function pingProject(p: ProjectEntry): Promise<CockpitEvent> {
  const url = p.url!;
  const started = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'cozza-cockpit-bus/0.1' },
    });
    const latency = Date.now() - started;
    const status: 'ok' | 'warn' | 'down' =
      res.status >= 500 ? 'down' : latency > 3000 ? 'warn' : 'ok';
    return {
      type: 'health',
      ts: Date.now(),
      project: p.name,
      status,
      url,
      latencyMs: latency,
      httpStatus: res.status,
    };
  } catch (e) {
    return {
      type: 'health',
      ts: Date.now(),
      project: p.name,
      status: 'down',
      url,
      message: e instanceof Error ? e.message : 'unknown error',
    };
  } finally {
    clearTimeout(t);
  }
}
