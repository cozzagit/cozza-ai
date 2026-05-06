import { useEffect, useRef, useState } from 'react';
import { useCockpitStore } from './store';

/**
 * Software cursor + d-pad focus navigator overlay rendered on top of the
 * HUD shell. Listens to `input` events from the cockpit-bus and:
 *
 *  - mouseMove → moves a virtual cursor `<div>` (pointer-events: none for
 *    the user, but synthesized clicks dispatched at its location)
 *  - mouseClick → `document.elementFromPoint(...).click()`
 *  - keyDown with Arrow keys → moves focus to the closest focusable in
 *    that direction (Netflix-style)
 *
 * Limitation: cross-origin iframes (code-server, ttyd, Vite dev) do not
 * receive synthesized clicks because the browser sandbox blocks it. For
 * those, pair a real Bluetooth mouse to the Viture/Pixel.
 */
export function PointerOverlay() {
  const token = useCockpitStore((s) => s.token);
  const busUrl = useCockpitStore((s) => s.busUrl);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastMoveRef = useRef<number>(0);

  useEffect(() => {
    if (!token) return;
    const wsUrl = busUrl.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
    let stopped = false;
    let retry = 0;

    const open = (): void => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        ws.send(JSON.stringify({ kind: 'subscribe', topic: 'input' }));
      };
      ws.onmessage = (m: MessageEvent<string>) => {
        try {
          const f = JSON.parse(m.data) as {
            kind: string;
            event?: { type: string; kind?: string; payload?: Record<string, unknown> };
          };
          if (f.kind !== 'event' || f.event?.type !== 'input') return;
          const k = f.event.kind;
          const p = f.event.payload ?? {};
          // Only react to events explicitly addressed to the HUD (or
          // 'all'). When the user routes the trackpad to the PC native
          // cursor (target='pc') we MUST stay out so they actually see
          // the Windows cursor moving instead of a duplicate inside
          // the viewport.
          const tgt = (p as { _target?: string })._target ?? 'hud';
          if (tgt !== 'hud' && tgt !== 'all') return;
          if (k === 'mouseMove') {
            handleMove(p);
          } else if (k === 'mouseClick') {
            handleClick(p);
          } else if (k === 'keyDown') {
            handleKey(p);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        retry = Math.min(retry + 1, 6);
        setTimeout(open, 1000 * 2 ** retry);
      };
      ws.onerror = () => undefined;
    };

    const handleMove = (p: Record<string, unknown>): void => {
      const dx = typeof p.dx === 'number' ? p.dx : 0;
      const dy = typeof p.dy === 'number' ? p.dy : 0;
      setVisible(true);
      lastMoveRef.current = Date.now();
      setPos((prev) => {
        const cur = prev ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const x = clamp(cur.x + dx, 0, window.innerWidth - 1);
        const y = clamp(cur.y + dy, 0, window.innerHeight - 1);
        return { x, y };
      });
    };
    const handleClick = (p: Record<string, unknown>): void => {
      const cur = posRef.current;
      if (!cur) return;
      const el = document.elementFromPoint(cur.x, cur.y);
      if (!el) return;
      // Find the nearest clickable
      const target = (el.closest('button, a, [role="button"], input, label, select') ??
        el) as HTMLElement;
      const button = (p.button as string) ?? 'left';
      if (button === 'left') {
        target.click();
      } else if (button === 'right') {
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      }
    };
    const handleKey = (p: Record<string, unknown>): void => {
      const key = String(p.key ?? '');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        moveFocus(key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right');
      } else if (key === 'Enter') {
        (document.activeElement as HTMLElement | null)?.click();
      } else if (key === 'Escape') {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };

    open();
    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [token, busUrl]);

  // Mirror to ref for handleClick closure
  const posRef = useRef<typeof pos>(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Auto-hide cursor after 4s of inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastMoveRef.current > 4000) setVisible(false);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!visible || !pos) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: pos.x - 14,
        top: pos.y - 14,
        width: 28,
        height: 28,
        pointerEvents: 'none',
        zIndex: 1000,
        transition: 'transform 30ms linear',
        transform: 'translate(0,0)',
      }}
    >
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle
          cx="14"
          cy="14"
          r="12"
          fill="rgba(0,229,255,0.15)"
          stroke="#00E5FF"
          strokeWidth="2"
        />
        <circle cx="14" cy="14" r="3" fill="#00E5FF" />
      </svg>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Find the next focusable element in a direction relative to the
 * currently focused element. Implements a simple "spatial" navigator:
 * collects all visible focusables, filters those in the right
 * half-plane, picks the one with the smallest weighted distance.
 */
function moveFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
  const focusables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
  });
  const active = (document.activeElement as HTMLElement | null) ?? null;
  const start = active && focusables.includes(active) ? active : focusables[0];
  if (!start) return;
  const sr = start.getBoundingClientRect();
  const sx = sr.left + sr.width / 2;
  const sy = sr.top + sr.height / 2;

  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of focusables) {
    if (el === start) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - sx;
    const dy = cy - sy;
    const okDir =
      (dir === 'right' && dx > 8) ||
      (dir === 'left' && dx < -8) ||
      (dir === 'down' && dy > 8) ||
      (dir === 'up' && dy < -8);
    if (!okDir) continue;
    // Weighted: prefer same-axis closeness
    const along = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + cross * 2;
    if (!best || score < best.score) best = { el, score };
  }
  if (best) {
    best.el.focus();
    best.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
