import { describe, it, expect, vi } from 'vitest';
import { executeIntent } from './intent';

describe('executeIntent', () => {
  it('START_CHAT dispatches a CustomEvent and returns ok', async () => {
    const handler = vi.fn();
    window.addEventListener('cozza:start-chat', handler as EventListener, { once: true });
    const r = await executeIntent('START_CHAT', { text: 'ciao' });
    expect(r).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns not_implemented for SWITCH_WORKSPACE', async () => {
    const r = await executeIntent('SWITCH_WORKSPACE', { workspace: 'lavoriamo' });
    expect(r).toEqual({ ok: false, reason: 'not_implemented' });
  });

  it.each(['OPEN_APP', 'STOP', 'READ_LAST', 'OPEN_TERMINAL'] as const)(
    '%s returns not_implemented stub',
    async (intent) => {
      const r = await executeIntent(intent, {});
      expect(r).toEqual({ ok: false, reason: 'not_implemented' });
    },
  );
});
