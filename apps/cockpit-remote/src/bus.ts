import { useEffect, useRef, useState } from 'react';
import { useRemoteStore } from './store';

export interface CockpitEvent {
  type: 'health' | 'build' | 'claude' | 'log' | 'git' | 'metric' | 'quota' | 'input';
  ts: number;
  project?: string;
  [k: string]: unknown;
}

interface BusApi {
  connected: boolean;
  events: CockpitEvent[];
  send: (frame: Record<string, unknown>) => void;
  vibrate: (ms?: number) => void;
}

/**
 * WebSocket connection to the cockpit-bus + helper to send input frames
 * (mouse / keyboard / killswitch). Auto-reconnect with exponential backoff.
 */
export function useCockpitBus(maxEvents = 100): BusApi {
  const token = useRemoteStore((s) => s.token);
  const busUrl = useRemoteStore((s) => s.busUrl);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CockpitEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const wsBase = busUrl.replace(/^http/, 'ws');
    const url = `${wsBase}/ws?token=${encodeURIComponent(token)}`;
    let stopped = false;
    let retry = 0;

    const open = (): void => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        ws.send(JSON.stringify({ kind: 'subscribe', topic: 'all' }));
      };
      ws.onmessage = (m: MessageEvent<string>) => {
        try {
          const f = JSON.parse(m.data) as { kind: string; event?: CockpitEvent };
          if (f.kind === 'event' && f.event) {
            const ev = f.event;
            setEvents((p) => [ev, ...p].slice(0, maxEvents));
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) {
          retry = Math.min(retry + 1, 6);
          setTimeout(open, 1000 * 2 ** retry);
        }
      };
      ws.onerror = () => undefined;
    };

    open();
    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [token, busUrl, maxEvents]);

  const send = (frame: Record<string, unknown>): void => {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };
  const vibrate = (ms = 8): void => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  };

  return { connected, events, send, vibrate };
}
