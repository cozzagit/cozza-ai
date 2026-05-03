import { bus } from '../bus.js';
import { config } from '../config.js';
import { loadProjects, type ProjectEntry } from '../catalog.js';
import { discoverNginxSites, type NginxSite } from './nginx-discovery.js';
import type { CockpitEvent } from '../events.js';

interface Target {
  name: string;
  url: string;
}

const NGINX_REFRESH_MS = 10 * 60_000;
let lastNginx: NginxSite[] = [];
let lastNginxFetchAt = 0;

/**
 * Health adapter: every N seconds pings each known target and emits a
 * `health` event. The list of targets is derived as follows, in order:
 *
 *   1. nginx server_name discovery on the VPS (the truth: what is
 *      actually deployed and serving on the box). Refreshed every 10min.
 *   2. The `memory/all-projects.md` catalog provides friendly names — we
 *      fuzzy-match the bare domain (without subdomain) to project names.
 *   3. If nginx discovery fails (no SSH access), fall back to the
 *      catalog rows that have a real `https://` URL.
 *
 * This mirrors monitor-vps's own discovery so the two dashboards agree
 * on "what's up".
 */
export function startHealthAdapter(): () => void {
  const intervalMs = config.healthPollSeconds * 1000;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const targets = await getTargets();
    await Promise.allSettled(
      targets.map(async (t) => {
        const ev = await pingTarget(t);
        bus.emitEvent(ev);
      }),
    );
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function getTargets(): Promise<Target[]> {
  // Refresh nginx site list every 10min
  if (Date.now() - lastNginxFetchAt > NGINX_REFRESH_MS) {
    try {
      const sites = await discoverNginxSites();
      if (sites.length > 0) {
        lastNginx = sites;
        lastNginxFetchAt = Date.now();
      }
    } catch {
      // keep the previous list if SSH momentarily fails
    }
  }

  if (lastNginx.length > 0) {
    const projects = loadProjects();
    return lastNginx.map((s) => ({
      name: prettyName(s.domain, projects),
      url: `https://${s.domain}`,
    }));
  }

  // Fallback when nginx discovery fails (e.g. SSH key missing): use the
  // catalog but only rows with explicit https:// URLs.
  return loadProjects()
    .filter(
      (p): p is ProjectEntry & { url: string } =>
        typeof p.url === 'string' && p.url.startsWith('http'),
    )
    .map((p) => ({ name: p.name, url: p.url }));
}

/** Manual overrides for domains that don't match the catalog naturally. */
const NAME_OVERRIDES: Record<string, string> = {
  'cantierehub.it': 'Cantiere Hub',
  'new.ispezioniscaffalature.it': 'VIS Italia',
  'monitor.vibecanyon.com': 'VPS Monitor',
  'octchess.vibecanyon.com': 'OCT Chess',
  'cozza-ai.vibecanyon.com': 'cozza-ai',
};

function prettyName(domain: string, projects: ProjectEntry[]): string {
  if (NAME_OVERRIDES[domain]) return NAME_OVERRIDES[domain];
  // Try to match catalog entry by URL or subdomain → project name
  const sub = domain.split('.')[0];
  for (const p of projects) {
    if (p.url && p.url.includes(domain)) return p.name;
    if (sub && p.name.toLowerCase().replace(/\s+/g, '') === sub.toLowerCase().replace(/-/g, ''))
      return p.name;
  }
  // Apex domains: use last meaningful label, e.g. "vibecanyon.com" → "VibeCanyon"
  const sd = sub ?? domain;
  return sd
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

async function pingTarget(t: Target): Promise<CockpitEvent> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    let res = await fetch(t.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'cozza-cockpit-bus/0.1' },
    }).catch(() => null);
    // some servers don't like HEAD — retry GET
    if (!res || res.status >= 400) {
      res = await fetch(t.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'cozza-cockpit-bus/0.1' },
      });
    }
    const latency = Date.now() - started;
    const status: 'ok' | 'warn' | 'down' =
      res.status >= 500 ? 'down' : latency > 3000 ? 'warn' : 'ok';
    return {
      type: 'health',
      ts: Date.now(),
      project: t.name,
      status,
      url: t.url,
      latencyMs: latency,
      httpStatus: res.status,
    };
  } catch (e) {
    return {
      type: 'health',
      ts: Date.now(),
      project: t.name,
      status: 'down',
      url: t.url,
      message: e instanceof Error ? e.message : 'unknown error',
    };
  } finally {
    clearTimeout(timer);
  }
}
