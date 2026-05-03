import { spawn } from 'node:child_process';
import { config } from '../config.js';

export interface NginxSite {
  domain: string;
  configFile: string;
  /** True when the nginx config has a `proxy_pass` to a local port. */
  isProxy: boolean;
  /** Local upstream port if proxy_pass to 127.0.0.1:N or localhost:N. */
  port: number | null;
}

/**
 * SSH to the VPS and read the canonical list of nginx sites — the same
 * data monitor-vps uses for its dashboard. This is the source of truth
 * for "what's actually deployed and reachable" — far more accurate than
 * parsing the human-maintained `memory/all-projects.md` catalog (which
 * may include drafts and concepts that don't map to a live domain).
 *
 * Cached at the call-site; the script is read-only and side-effect free.
 */
export async function discoverNginxSites(): Promise<NginxSite[]> {
  if (!config.vpsKey || !config.vpsHost) return [];

  const remoteScript = `
    for f in /etc/nginx/sites-enabled/*; do
      [ -e "$f" ] || continue
      base=$(basename "$f")
      [ "$base" = "default" ] && continue
      domain=$(grep -h '^[[:space:]]*server_name' "$f" 2>/dev/null | head -1 \\
        | sed 's/.*server_name//; s/;.*//' \\
        | xargs -n1 2>/dev/null \\
        | grep -v '^_$' | grep -v '^localhost$' | head -1)
      [ -z "$domain" ] && continue
      proxy=$(grep -hE 'proxy_pass[[:space:]]+https?://(127\\.0\\.0\\.1|localhost):[0-9]+' "$f" 2>/dev/null | head -1)
      port=$(echo "$proxy" | grep -oE ':[0-9]+' | tr -d ':' | head -1)
      isProxy=0; [ -n "$port" ] && isProxy=1
      echo "$base|$domain|$isProxy|$port"
    done
  `;

  return new Promise((resolve) => {
    const proc = spawn(
      'ssh',
      [
        '-i',
        config.vpsKey,
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ConnectTimeout=8',
        `${config.vpsUser}@${config.vpsHost}`,
        remoteScript,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let buf = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf-8');
    });
    proc.on('error', () => resolve([]));
    proc.on('close', () => {
      const sites: NginxSite[] = [];
      for (const line of buf.split(/\r?\n/)) {
        const parts = line.trim().split('|');
        if (parts.length < 4) continue;
        const [configFile, domain, isProxyStr, portStr] = parts;
        if (!configFile || !domain) continue;
        sites.push({
          configFile,
          domain,
          isProxy: isProxyStr === '1',
          port: portStr && /^\d+$/.test(portStr) ? Number(portStr) : null,
        });
      }
      resolve(sites);
    });
  });
}
