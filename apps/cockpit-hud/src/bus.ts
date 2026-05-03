import { useEffect, useRef, useState } from 'react';
import { useCockpitStore } from './store';

export interface CockpitEvent {
  type: 'health' | 'build' | 'claude' | 'log' | 'git' | 'metric' | 'quota' | 'input';
  ts: number;
  project?: string;
  // We keep payload loose on the client — adapters validate server-side.
  [k: string]: unknown;
}

interface ConnectionState {
  connected: boolean;
  events: CockpitEvent[];
  error: string | null;
}

/**
 * React hook that connects to the cockpit-bus WebSocket and keeps a
 * rolling buffer of the last N events. Components filter by `type` /
 * `project` as they need.
 */
export function useCockpitBus(maxEvents = 300): ConnectionState {
  const token = useCockpitStore((s) => s.token);
  const busUrl = useCockpitStore((s) => s.busUrl);
  const [state, setState] = useState<ConnectionState>({
    connected: false,
    events: [],
    error: null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ connected: false, events: [], error: 'no token' });
      return;
    }
    const wsBase = busUrl.replace(/^http/, 'ws');
    const url = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
    let stopped = false;
    let retry = 0;

    const open = (): void => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setState((p) => ({ ...p, connected: true, error: null }));
        ws.send(JSON.stringify({ kind: 'subscribe', topic: 'all' }));
      };
      ws.onmessage = (m: MessageEvent<string>) => {
        try {
          const f = JSON.parse(m.data) as { kind: string; event?: CockpitEvent };
          if (f.kind === 'event' && f.event) {
            const ev = f.event;
            setState((p) => ({
              ...p,
              events: [ev, ...p.events].slice(0, maxEvents),
            }));
          }
        } catch {
          // ignore malformed
        }
      };
      ws.onclose = () => {
        setState((p) => ({ ...p, connected: false }));
        if (!stopped) {
          retry = Math.min(retry + 1, 6);
          const delay = 1000 * 2 ** retry;
          setTimeout(open, delay);
        }
      };
      ws.onerror = () => {
        setState((p) => ({ ...p, error: 'ws error' }));
      };
    };

    open();
    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [token, busUrl, maxEvents]);

  return state;
}
