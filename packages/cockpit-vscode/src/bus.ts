/**
 * WebSocket client for the cockpit-bus, used by the VS Code extension.
 * Auto-reconnect on disconnect, exposes onEvent / onState callbacks.
 *
 * Uses the global WebSocket constructor (Node 22+ ships with one) — no
 * external `ws` dep so the .vsix stays tiny.
 */

export interface CockpitEventLike {
  type: string;
  ts: number;
  project?: string;
  [k: string]: unknown;
}

export interface BusClient {
  dispose(): void;
}

interface BusCallbacks {
  onEvent(e: CockpitEventLike): void;
  onState(s: 'connecting' | 'open' | 'closed'): void;
}

export function startBusClient(baseUrl: string, token: string, cb: BusCallbacks): BusClient {
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 0;
  let timer: NodeJS.Timeout | null = null;

  const open = (): void => {
    if (stopped) return;
    cb.onState('connecting');
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      cb.onState('closed');
      schedule();
      return;
    }
    ws.onopen = () => {
      retry = 0;
      cb.onState('open');
      ws?.send(JSON.stringify({ kind: 'subscribe', topic: 'all' }));
    };
    ws.onmessage = (m: MessageEvent) => {
      try {
        const data = m.data as string;
        const f = JSON.parse(data) as { kind?: string; event?: CockpitEventLike };
        if (f.kind === 'event' && f.event) cb.onEvent(f.event);
      } catch {
        // ignore malformed
      }
    };
    ws.onclose = () => {
      cb.onState('closed');
      ws = null;
      schedule();
    };
    ws.onerror = () => undefined;
  };

  const schedule = (): void => {
    if (stopped) return;
    retry = Math.min(retry + 1, 6);
    const delay = 1000 * 2 ** retry;
    timer = setTimeout(open, delay);
  };

  open();

  return {
    dispose() {
      stopped = true;
      if (timer) clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        // noop
      }
      ws = null;
    },
  };
}
