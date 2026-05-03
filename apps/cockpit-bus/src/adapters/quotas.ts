import { bus } from '../bus.js';

/**
 * Quota adapter: polls Anthropic / OpenAI / ElevenLabs balance every 5
 * minutes if the API keys are present in env. All providers expose a
 * usage endpoint; for ElevenLabs we use the user info endpoint.
 *
 * NOTE: keys live in cozza-ai's apps/api/.env, not here. We re-read from
 * environment so the user can drop them into `cockpit-bus/.env` too if
 * they want quota events.
 */

const POLL_MS = 5 * 60_000;

export function startQuotaAdapter(): () => void {
  const tick = async (): Promise<void> => {
    await Promise.allSettled([pollAnthropic(), pollOpenAi(), pollEleven()]);
  };
  void tick();
  const t = setInterval(() => void tick(), POLL_MS);
  return () => clearInterval(t);
}

async function pollAnthropic(): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return;
  // Anthropic doesn't have a public balance endpoint — emit a simple
  // "alive" signal by hitting messages with 0 tokens. Cheap-and-cheerful.
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(5000),
    });
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'anthropic',
      message: res.ok ? 'reachable' : `status ${res.status}`,
    });
  } catch (e) {
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'anthropic',
      message: e instanceof Error ? e.message : 'unreachable',
    });
  }
}

async function pollOpenAi(): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'openai',
      message: res.ok ? 'reachable' : `status ${res.status}`,
    });
  } catch (e) {
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'openai',
      message: e instanceof Error ? e.message : 'unreachable',
    });
  }
}

async function pollEleven(): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return;
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      bus.emitEvent({
        type: 'quota',
        ts: Date.now(),
        provider: 'elevenlabs',
        message: `status ${res.status}`,
      });
      return;
    }
    const data = (await res.json()) as {
      subscription?: { character_count?: number; character_limit?: number };
    };
    const used = data.subscription?.character_count ?? 0;
    const limit = data.subscription?.character_limit ?? 0;
    const remaining = limit > 0 ? limit - used : undefined;
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'elevenlabs',
      ...(typeof remaining === 'number' ? { requestsRemaining: remaining } : {}),
      message: `${used.toLocaleString()} / ${limit.toLocaleString()} chars`,
    });
  } catch (e) {
    bus.emitEvent({
      type: 'quota',
      ts: Date.now(),
      provider: 'elevenlabs',
      message: e instanceof Error ? e.message : 'unreachable',
    });
  }
}
