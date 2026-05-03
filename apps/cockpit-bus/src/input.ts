import { bus } from './bus.js';
import { config } from './config.js';

/**
 * Input plane — turns the Pixel into a remote mouse/keyboard.
 *
 * The actual native input dispatch (move cursor, click, type) is done
 * via dynamic import of `@nut-tree-fork/nut-js` so the bus can run on
 * machines that don't need this feature without a hard dep on a native
 * binary.
 *
 * To enable:
 *   pnpm --filter cockpit-bus add @nut-tree-fork/nut-js
 *   COCKPIT_INPUT_ENABLED=true
 *
 * Safety:
 *  - opt-in via env (config.inputEnabled)
 *  - kill switch: setInputArmed(false) refuses dispatch
 *  - 3-min idle disconnect
 */

interface MouseMovePayload {
  dx?: number;
  dy?: number;
  absX?: number;
  absY?: number;
}
interface MouseClickPayload {
  button?: 'left' | 'right' | 'middle';
  double?: boolean;
}
interface MouseScrollPayload {
  dy: number;
  dx?: number;
}
interface KeyPayload {
  key: string;
  modifiers?: string[];
}

let armed = config.inputEnabled;
let lastEventAt = Date.now();
const IDLE_MS = 3 * 60_000;

interface NutModule {
  mouse: {
    config: { mouseSpeed: number };
    setPosition: (p: { x: number; y: number }) => Promise<unknown>;
    getPosition: () => Promise<{ x: number; y: number }>;
    click: (b: unknown) => Promise<unknown>;
    doubleClick: (b: unknown) => Promise<unknown>;
    scrollDown: (n: number) => Promise<unknown>;
    scrollUp: (n: number) => Promise<unknown>;
    scrollLeft: (n: number) => Promise<unknown>;
    scrollRight: (n: number) => Promise<unknown>;
  };
  keyboard: {
    type: (s: string) => Promise<unknown>;
    pressKey: (...keys: unknown[]) => Promise<unknown>;
    releaseKey: (...keys: unknown[]) => Promise<unknown>;
  };
  Point: new (x: number, y: number) => { x: number; y: number };
  Button: { LEFT: unknown; RIGHT: unknown; MIDDLE: unknown };
  Key: Record<string, unknown>;
}

let nut: NutModule | null = null;
let warned = false;

async function ensureNut(): Promise<NutModule | null> {
  if (nut) return nut;
  try {
    // dynamic import; the package is an optional dep so missing it just
    // disables the input plane gracefully.
    // Optional native dep — keep the import string opaque to TS so we
    // don't need a `.d.ts` shim when the package isn't installed.
    const modName = '@nut-tree-fork/' + 'nut-js';
    const mod = (await import(modName)) as unknown as NutModule;
    nut = mod;
    nut.mouse.config.mouseSpeed = 1500;
    return nut;
  } catch {
    if (!warned) {
      warned = true;
      console.warn(
        '[cockpit-bus] @nut-tree-fork/nut-js not installed — input plane disabled. ' +
          'Run: pnpm --filter cockpit-bus add @nut-tree-fork/nut-js',
      );
    }
    return null;
  }
}

export function setInputArmed(value: boolean): void {
  armed = value;
  bus.emitEvent({
    type: 'log',
    ts: Date.now(),
    project: 'cockpit-bus',
    level: 'warn',
    line: `input plane ${armed ? 'ARMED' : 'DISARMED'}`,
  });
}

export function isInputArmed(): boolean {
  return armed && Date.now() - lastEventAt < IDLE_MS;
}

function touch(): void {
  lastEventAt = Date.now();
}

export async function dispatchMouseMove(p: MouseMovePayload): Promise<void> {
  if (!armed) return;
  const n = await ensureNut();
  if (!n) return;
  touch();
  if (typeof p.absX === 'number' && typeof p.absY === 'number') {
    await n.mouse.setPosition(new n.Point(p.absX, p.absY));
    return;
  }
  if (typeof p.dx === 'number' || typeof p.dy === 'number') {
    const cur = await n.mouse.getPosition();
    await n.mouse.setPosition(new n.Point(cur.x + (p.dx ?? 0), cur.y + (p.dy ?? 0)));
  }
}

export async function dispatchMouseClick(p: MouseClickPayload): Promise<void> {
  if (!armed) return;
  const n = await ensureNut();
  if (!n) return;
  touch();
  const btn =
    p.button === 'right' ? n.Button.RIGHT : p.button === 'middle' ? n.Button.MIDDLE : n.Button.LEFT;
  await (p.double ? n.mouse.doubleClick(btn) : n.mouse.click(btn));
}

export async function dispatchMouseScroll(p: MouseScrollPayload): Promise<void> {
  if (!armed) return;
  const n = await ensureNut();
  if (!n) return;
  touch();
  if (p.dy) await (p.dy > 0 ? n.mouse.scrollDown(p.dy) : n.mouse.scrollUp(-p.dy));
  if (p.dx) await (p.dx > 0 ? n.mouse.scrollRight(p.dx) : n.mouse.scrollLeft(-p.dx));
}

export async function dispatchKey(p: KeyPayload): Promise<void> {
  if (!armed) return;
  const n = await ensureNut();
  if (!n) return;
  touch();
  const isPrintable = p.key.length === 1 && (!p.modifiers || p.modifiers.length === 0);
  if (isPrintable) {
    await n.keyboard.type(p.key);
  } else {
    const keys = [...(p.modifiers ?? []), p.key].map(normalizeKey);
    await n.keyboard.pressKey(...keys);
    await n.keyboard.releaseKey(...keys);
  }
}

function normalizeKey(k: string): string {
  const map: Record<string, string> = {
    cmd: 'LeftCmd',
    ctrl: 'LeftControl',
    control: 'LeftControl',
    shift: 'LeftShift',
    alt: 'LeftAlt',
    option: 'LeftAlt',
    meta: 'LeftSuper',
    win: 'LeftSuper',
    enter: 'Enter',
    return: 'Enter',
    esc: 'Escape',
    escape: 'Escape',
    tab: 'Tab',
    backspace: 'Backspace',
    space: 'Space',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
  };
  return map[k.toLowerCase()] ?? k;
}
