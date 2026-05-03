import 'dotenv/config';

export interface CockpitConfig {
  port: number;
  jwtSecret: string;
  allowedOrigins: string[];
  dbPath: string;
  projectsCatalog: string;
  vpsHost: string;
  vpsUser: string;
  vpsKey: string;
  healthPollSeconds: number;
  inputEnabled: boolean;
  killCode: string;
}

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config: CockpitConfig = {
  port: Number(process.env.PORT ?? 3030),
  jwtSecret: req('COCKPIT_JWT_SECRET', 'dev-only-change-me-32-chars-min-x'),
  allowedOrigins: (
    process.env.COCKPIT_ALLOWED_ORIGINS ?? 'http://localhost:5174,http://localhost:5175'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dbPath: process.env.COCKPIT_DB_PATH ?? './cockpit.db',
  projectsCatalog: process.env.COCKPIT_PROJECTS_CATALOG ?? '',
  vpsHost: process.env.COCKPIT_VPS_HOST ?? '188.213.170.214',
  vpsUser: process.env.COCKPIT_VPS_USER ?? 'root',
  vpsKey: process.env.COCKPIT_VPS_KEY ?? '',
  healthPollSeconds: Number(process.env.COCKPIT_HEALTH_POLL_SECONDS ?? 30),
  inputEnabled: process.env.COCKPIT_INPUT_ENABLED === 'true',
  killCode: process.env.COCKPIT_KILL_CODE ?? 'change-me',
};
