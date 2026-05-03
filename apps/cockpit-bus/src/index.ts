import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { config } from './config.js';
import { bus } from './bus.js';
import { persistEvent, recentEvents } from './store.js';
import { issueToken, verifyToken, hasScope, type CockpitClaims } from './auth.js';
import { CockpitEventSchema, type CockpitEvent } from './events.js';
import { startHealthAdapter } from './adapters/health.js';
import { startGitWatcher } from './adapters/git-watcher.js';
import { startPm2Adapter } from './adapters/pm2.js';
import { startQuotaAdapter } from './adapters/quotas.js';
import { startClaudeAdapter } from './adapters/claude.js';
import { mountWs } from './gateway.js';
import { setInputArmed, isInputArmed } from './input.js';

type Vars = { claims: CockpitClaims };

// ─── Persist every event to SQLite for replay ─────────────────────
bus.on('event', (e) => persistEvent(e));

// ─── HTTP API ────────────────────────────────────────────────────
const app = new Hono<{ Variables: Vars }>();

app.use(
  '*',
  cors({
    origin: config.allowedOrigins,
    credentials: true,
  }),
);

app.get('/', (c) =>
  c.json({
    service: 'cozza-cockpit-bus',
    version: '0.1.0',
    ts: Date.now(),
    inputArmed: isInputArmed(),
  }),
);

app.get('/healthz', (c) => c.text('ok'));

// Issue a token (dev convenience: one shared admin secret guards this)
const TokenSchema = z.object({
  pin: z.string().min(4),
  scopes: z.array(z.string()).optional(),
  ttlSec: z
    .number()
    .min(60)
    .max(86400 * 30)
    .optional(),
});
app.post('/auth/token', async (c) => {
  const body = TokenSchema.parse(await c.req.json());
  if (body.pin !== process.env.COCKPIT_PIN) {
    return c.json({ error: 'invalid pin' }, 401);
  }
  const tok = await issueToken('cozza', body.scopes ?? ['cockpit:read'], body.ttlSec ?? 86400);
  return c.json({ token: tok, expiresIn: body.ttlSec ?? 86400 });
});

// Bearer auth middleware for everything below /api
app.use('/api/*', async (c, next) => {
  const h = c.req.header('Authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return c.json({ error: 'missing token' }, 401);
  try {
    const claims = await verifyToken(token);
    c.set('claims', claims);
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }
  await next();
});

app.get('/api/projects', (c) => {
  const last = recentEvents({ type: 'health', limit: 50 });
  // dedupe by project, keep most recent
  const map = new Map<string, CockpitEvent>();
  for (const e of last) {
    if ('project' in e && e.project && !map.has(e.project)) map.set(e.project, e);
  }
  return c.json({ projects: [...map.values()] });
});

app.get('/api/events', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 200), 500);
  const type = c.req.query('type') as CockpitEvent['type'] | undefined;
  const project = c.req.query('project') ?? undefined;
  const events = recentEvents({
    limit,
    ...(type ? { type } : {}),
    ...(project ? { project } : {}),
  });
  return c.json({ events });
});

const EmitSchema = CockpitEventSchema;
app.post('/api/emit', async (c) => {
  const claims = c.get('claims');
  if (!hasScope(claims, 'cockpit:emit')) return c.json({ error: 'forbidden' }, 403);
  const body = EmitSchema.parse(await c.req.json());
  bus.emitEvent(body);
  return c.json({ ok: true });
});

// Broadcast command to subscribed clients (HUD/Remote/Desktop ext)
const CommandBodySchema = z.object({
  target: z.enum(['hud', 'desktop', 'remote', 'all']),
  command: z.string().min(1).max(64),
  args: z.record(z.string(), z.unknown()).optional(),
});
app.post('/api/command', async (c) => {
  const claims = c.get('claims');
  if (!hasScope(claims, 'cockpit:emit')) return c.json({ error: 'forbidden' }, 403);
  const body = CommandBodySchema.parse(await c.req.json());
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  bus.emitEvent({
    type: 'command',
    ts: Date.now(),
    id,
    target: body.target,
    command: body.command,
    ...(body.args ? { args: body.args } : {}),
  });
  return c.json({ ok: true, id });
});

// Cursor handoff between surfaces
const HandoffBodySchema = z.object({
  surface: z.enum(['desktop', 'xr', 'mobile']),
  to: z.enum(['desktop', 'xr', 'mobile']),
  context: z.string().max(120).optional(),
});
app.post('/api/handoff', async (c) => {
  const body = HandoffBodySchema.parse(await c.req.json());
  bus.emitEvent({
    type: 'handoff',
    ts: Date.now(),
    surface: body.surface,
    to: body.to,
    ...(body.context ? { context: body.context } : {}),
  });
  return c.json({ ok: true });
});

app.post('/api/input/arm', (c) => {
  const claims = c.get('claims');
  if (!hasScope(claims, 'input:write')) return c.json({ error: 'forbidden' }, 403);
  setInputArmed(true);
  return c.json({ armed: true });
});

app.post('/api/input/disarm', (c) => {
  setInputArmed(false);
  return c.json({ armed: false });
});

// ─── Boot ────────────────────────────────────────────────────────
const server = serve({ fetch: app.fetch, port: config.port });
mountWs(server as unknown as Parameters<typeof mountWs>[0]);

console.log(`🛸 cozza-cockpit-bus listening on :${config.port}`);
console.log(`   allowed origins: ${config.allowedOrigins.join(', ')}`);
console.log(`   input plane: ${isInputArmed() ? 'ARMED' : 'disarmed'}`);

// Adapters
const stopHealth = startHealthAdapter();
const stopGit = startGitWatcher({ root: 'c:/work/Cozza', ignore: ['node_modules', 'dist'] });
const stopPm2 = startPm2Adapter();
const stopQuota = startQuotaAdapter();
const stopClaude = startClaudeAdapter();

const shutdown = (): void => {
  console.log('🛬 shutting down…');
  stopHealth();
  stopGit();
  stopPm2();
  stopQuota();
  stopClaude();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
