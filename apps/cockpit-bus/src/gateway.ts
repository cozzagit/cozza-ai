import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Buffer } from 'node:buffer';
import { bus } from './bus.js';
import { verifyToken, hasScope, type CockpitClaims } from './auth.js';
import {
  dispatchKey,
  dispatchMouseClick,
  dispatchMouseMove,
  dispatchMouseScroll,
  isInputArmed,
  setInputArmed,
} from './input.js';
import { config } from './config.js';

interface WsClient {
  ws: WebSocket;
  claims: CockpitClaims;
  topics: Set<string>;
}

interface IncomingFrame {
  kind: 'subscribe' | 'unsubscribe' | 'input' | 'killswitch' | 'ping' | 'broadcast' | 'handoff';
  topic?: string;
  // input frames
  type?: 'mouseMove' | 'mouseClick' | 'mouseScroll' | 'keyDown';
  payload?: Record<string, unknown>;
  killCode?: string;
  // input target — 'pc' = nut.js native, 'hud' = software cursor in HUD,
  // 'all' = both. Default 'pc' for backwards compat.
  target?: 'hud' | 'pc' | 'all' | 'desktop' | 'remote';
  // broadcast / handoff
  command?: string;
  args?: Record<string, unknown>;
  surface?: 'desktop' | 'xr' | 'mobile';
  to?: 'desktop' | 'xr' | 'mobile';
  context?: string;
}

/**
 * Mounts the cockpit WebSocket gateway on the existing HTTP server.
 * Endpoint: /ws (clients connect with `?token=JWT`).
 *
 * Topics: 'all', 'health', 'build', 'log', 'git', 'metric', 'quota', 'claude', `project:<name>`.
 */
export function mountWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WsClient>();

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws' && url.pathname !== '/cockpit/ws') {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    let claims: CockpitClaims;
    try {
      claims = await verifyToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      attach(ws, claims);
    });
  });

  function attach(ws: WebSocket, claims: CockpitClaims): void {
    const client: WsClient = { ws, claims, topics: new Set(['all']) };
    clients.add(client);

    ws.on('message', (raw: Buffer) => {
      let frame: IncomingFrame;
      try {
        const text = raw.toString('utf-8');
        frame = JSON.parse(text) as IncomingFrame;
      } catch {
        return;
      }
      handleFrame(client, frame).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'error';
        ws.send(JSON.stringify({ kind: 'error', message: msg }));
      });
    });

    ws.on('close', () => {
      clients.delete(client);
    });

    ws.send(JSON.stringify({ kind: 'hello', sub: claims.sub, scopes: claims.scopes }));
  }

  async function handleFrame(c: WsClient, frame: IncomingFrame): Promise<void> {
    switch (frame.kind) {
      case 'ping':
        c.ws.send(JSON.stringify({ kind: 'pong', ts: Date.now() }));
        return;
      case 'subscribe':
        if (frame.topic) c.topics.add(frame.topic);
        return;
      case 'unsubscribe':
        if (frame.topic) c.topics.delete(frame.topic);
        return;
      case 'killswitch':
        if (frame.killCode !== config.killCode) {
          c.ws.send(JSON.stringify({ kind: 'error', message: 'invalid kill code' }));
          return;
        }
        setInputArmed(false);
        c.ws.send(JSON.stringify({ kind: 'killed', ts: Date.now() }));
        return;
      case 'input': {
        const p = frame.payload ?? {};
        const target = frame.target ?? 'pc'; // default backwards-compat
        // Always broadcast input events on the bus so HUD/Remote/etc.
        // listening clients (e.g. PointerOverlay in HUD) can react.
        bus.emitEvent({
          type: 'input',
          ts: Date.now(),
          kind: (frame.type ?? 'mouseMove') as
            | 'mouseMove'
            | 'mouseClick'
            | 'mouseScroll'
            | 'keyDown'
            | 'keyUp'
            | 'macro',
          payload: p,
        });
        // PC-targeted events also drive nut.js (real cursor on home PC).
        if (target === 'pc' || target === 'all') {
          if (!hasScope(c.claims, 'input:write')) {
            c.ws.send(JSON.stringify({ kind: 'error', message: 'missing scope input:write' }));
            return;
          }
          if (!isInputArmed()) return; // silently drop, broadcast still happened
          if (frame.type === 'mouseMove') await dispatchMouseMove(p);
          else if (frame.type === 'mouseClick') await dispatchMouseClick(p);
          else if (frame.type === 'mouseScroll') await dispatchMouseScroll(p as { dy: number });
          else if (frame.type === 'keyDown') await dispatchKey(p as { key: string });
        }
        return;
      }
      case 'broadcast': {
        if (!frame.command || !frame.target) return;
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        // CommandEvent.target is the narrower 'hud'|'desktop'|'remote'|'all'
        const allowed: ReadonlyArray<'hud' | 'desktop' | 'remote' | 'all'> = [
          'hud',
          'desktop',
          'remote',
          'all',
        ];
        const target = (allowed as readonly string[]).includes(frame.target)
          ? (frame.target as 'hud' | 'desktop' | 'remote' | 'all')
          : 'all';
        bus.emitEvent({
          type: 'command',
          ts: Date.now(),
          id,
          target,
          command: frame.command,
          ...(frame.args ? { args: frame.args } : {}),
        });
        return;
      }
      case 'handoff': {
        if (!frame.surface || !frame.to) return;
        bus.emitEvent({
          type: 'handoff',
          ts: Date.now(),
          surface: frame.surface,
          to: frame.to,
          ...(frame.context ? { context: frame.context } : {}),
        });
        return;
      }
      default:
        return;
    }
  }

  // Forward bus events to subscribed clients
  bus.on('event', (e) => {
    const projectTopic = 'project' in e && e.project ? `project:${e.project}` : null;
    const payload = JSON.stringify({ kind: 'event', event: e });
    for (const c of clients) {
      if (c.ws.readyState !== c.ws.OPEN) continue;
      const wantsAll = c.topics.has('all');
      const wantsType = c.topics.has(e.type);
      const wantsProject = projectTopic && c.topics.has(projectTopic);
      if (wantsAll || wantsType || wantsProject) {
        c.ws.send(payload);
      }
    }
  });
}
