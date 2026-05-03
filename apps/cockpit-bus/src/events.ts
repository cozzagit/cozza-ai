import { z } from 'zod';

/**
 * Cockpit event protocol — every adapter normalizes its source's events
 * into one of these shapes, so HUD / Remote / VS Code extension can
 * subscribe by `type` and `project`.
 */

export const HealthEvent = z.object({
  type: z.literal('health'),
  ts: z.number(),
  project: z.string(),
  status: z.enum(['ok', 'warn', 'down', 'unknown']),
  url: z.string().url().optional(),
  latencyMs: z.number().optional(),
  httpStatus: z.number().optional(),
  message: z.string().optional(),
});

export const BuildEvent = z.object({
  type: z.literal('build'),
  ts: z.number(),
  project: z.string(),
  target: z.enum(['web', 'api', 'shared', 'cockpit-hud', 'cockpit-remote', 'cockpit-bus', 'other']),
  status: z.enum(['start', 'success', 'fail']),
  durationMs: z.number().optional(),
  message: z.string().optional(),
});

export const ClaudeEvent = z.object({
  type: z.literal('claude'),
  ts: z.number(),
  sessionId: z.string(),
  project: z.string().optional(),
  msg: z.string(),
  progress: z.number().min(0).max(1).optional(),
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
});

export const LogEvent = z.object({
  type: z.literal('log'),
  ts: z.number(),
  project: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  line: z.string(),
});

export const GitEvent = z.object({
  type: z.literal('git'),
  ts: z.number(),
  project: z.string(),
  action: z.enum(['commit', 'branch-change', 'push', 'pull']),
  hash: z.string().optional(),
  ref: z.string().optional(),
  msg: z.string().optional(),
});

export const MetricEvent = z.object({
  type: z.literal('metric'),
  ts: z.number(),
  source: z.string(),
  cpu: z.number().optional(),
  ram: z.number().optional(),
  disk: z.number().optional(),
  rps: z.number().optional(),
});

export const QuotaEvent = z.object({
  type: z.literal('quota'),
  ts: z.number(),
  provider: z.enum(['anthropic', 'openai', 'elevenlabs']),
  balanceUsd: z.number().optional(),
  requestsRemaining: z.number().optional(),
  message: z.string().optional(),
});

export const InputEvent = z.object({
  type: z.literal('input'),
  ts: z.number(),
  kind: z.enum(['mouseMove', 'mouseClick', 'mouseScroll', 'keyDown', 'keyUp', 'macro']),
  payload: z.record(z.string(), z.unknown()),
});

/** Broadcast/control events drive other surfaces (HUD switch, deploy trigger, …). */
export const CommandEvent = z.object({
  type: z.literal('command'),
  ts: z.number(),
  /** unique id to dedupe replays. */
  id: z.string(),
  /** target surface — 'hud' / 'desktop' / 'all' */
  target: z.enum(['hud', 'desktop', 'remote', 'all']),
  /** command name (free-form, e.g. 'hud.setMode', 'desktop.openProject', 'deploy.web') */
  command: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
});

/** Cursor presence on a given surface. */
export const HandoffEvent = z.object({
  type: z.literal('handoff'),
  ts: z.number(),
  surface: z.enum(['desktop', 'xr', 'mobile']),
  /** which surface should now own the cursor */
  to: z.enum(['desktop', 'xr', 'mobile']),
  /** optional context the cursor was last over */
  context: z.string().optional(),
});

export const CockpitEventSchema = z.discriminatedUnion('type', [
  HealthEvent,
  BuildEvent,
  ClaudeEvent,
  LogEvent,
  GitEvent,
  MetricEvent,
  QuotaEvent,
  InputEvent,
  CommandEvent,
  HandoffEvent,
]);

export type CockpitEvent = z.infer<typeof CockpitEventSchema>;
