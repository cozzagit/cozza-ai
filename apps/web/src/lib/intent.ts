import type { Intent, IntentParams, IntentResult } from '@cozza/shared';

/**
 * MVP stub: only START_CHAT is implemented (dispatches a CustomEvent
 * the App listens to). All other intents return `not_implemented`.
 *
 * V1 will replace this with a real dispatcher wired to wake-word + workspace
 * orchestration, without changing this signature.
 */
export async function executeIntent(
  intent: Intent,
  params: IntentParams = {},
): Promise<IntentResult> {
  switch (intent) {
    case 'START_CHAT':
      window.dispatchEvent(
        new CustomEvent<IntentParams>('cozza:start-chat', { detail: params }),
      );
      return { ok: true };
    case 'SWITCH_WORKSPACE':
    case 'OPEN_APP':
    case 'STOP':
    case 'READ_LAST':
    case 'OPEN_TERMINAL':
      return { ok: false, reason: 'not_implemented' };
  }
}
