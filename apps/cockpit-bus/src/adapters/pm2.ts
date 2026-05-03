import { spawn } from 'node:child_process';
import { bus } from '../bus.js';
import { config } from '../config.js';

/**
 * PM2 adapter: every 30s SSH into the VPS and run `pm2 jlist`, parse
 * the JSON, normalize each process into a `metric` event so the HUD
 * can show CPU/RAM per app.
 *
 * Tail of pm2 logs for live `log` events is started separately on
 * demand (see startPm2LogTail).
 */

interface Pm2Process {
  name: string;
  pm2_env?: { status?: string };
  monit?: { cpu?: number; memory?: number };
}

export function startPm2Adapter(): () => void {
  if (!config.vpsKey || !config.vpsHost) {
    return () => {
      // disabled
    };
  }

  const tick = (): void => {
    const args = [
      '-i',
      config.vpsKey,
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      'ConnectTimeout=5',
      `${config.vpsUser}@${config.vpsHost}`,
      'pm2 jlist 2>/dev/null',
    ];
    const proc = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf-8');
    });
    proc.on('close', () => {
      try {
        const list = JSON.parse(buf) as Pm2Process[];
        for (const p of list) {
          bus.emitEvent({
            type: 'metric',
            ts: Date.now(),
            source: `pm2/${p.name}`,
            cpu: p.monit?.cpu,
            ram: p.monit?.memory,
          });
        }
      } catch {
        // noop on parse failure (probably empty / non-json)
      }
    });
    proc.on('error', () => {
      // ssh missing or unreachable
    });
  };

  const t = setInterval(tick, 30_000);
  // first tick after 3s so the bus boots first
  const first = setTimeout(tick, 3000);
  return () => {
    clearInterval(t);
    clearTimeout(first);
  };
}
