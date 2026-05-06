import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { bus } from './bus.js';
import { config } from './config.js';

// File-based diagnostic log dedicated to nut.js: pwsh transcripts in
// scheduled tasks don't capture stdout reliably, so we write directly.
const NUT_LOG = join(homedir(), '.config', 'cozza-cockpit', 'nut.log');
function nlog(line: string): void {
  try {
    appendFileSync(NUT_LOG, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore — log file unavailable
  }
}

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
// Auto-disarm after this much idle. Was 3min — too aggressive: the
// user had to re-arm via API every time they took a coffee break and
// the cursor "stopped working" without obvious cause. 1 hour balances
// security (still gates against forgotten-armed sessions) against
// usability (a normal work session keeps the input plane live).
const IDLE_MS = 60 * 60_000;

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
  nlog('ensureNut: import attempt');
  try {
    const mod = (await import('@nut-tree-fork/nut-js')) as unknown as NutModule;
    nut = mod;
    nut.mouse.config.mouseSpeed = 1500;
    nlog('ensureNut: SUCCESS — module keys=' + Object.keys(mod).slice(0, 5).join(','));
    console.warn('[cockpit-bus] nut.js loaded successfully — native cursor control armed');
    return nut;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? '') : '';
    nlog('ensureNut: FAILED — ' + msg + ' | stack: ' + stack.split('\n').slice(0, 3).join(' | '));
    if (!warned) {
      warned = true;
      console.warn('[cockpit-bus] @nut-tree-fork/nut-js failed to load:', msg);
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
  nlog(`dispatchMouseMove called: armed=${armed} payload=${JSON.stringify(p)}`);
  if (!armed) {
    nlog('  → DROP: input plane disarmed');
    return;
  }
  const n = await ensureNut();
  if (!n) {
    nlog('  → DROP: nut.js not available');
    return;
  }
  touch();
  try {
    if (typeof p.absX === 'number' && typeof p.absY === 'number') {
      await n.mouse.setPosition(new n.Point(p.absX, p.absY));
      nlog(`  → setPosition abs(${p.absX},${p.absY}) OK`);
      return;
    }
    if (typeof p.dx === 'number' || typeof p.dy === 'number') {
      const cur = await n.mouse.getPosition();
      await n.mouse.setPosition(new n.Point(cur.x + (p.dx ?? 0), cur.y + (p.dy ?? 0)));
      nlog(
        `  → setPosition rel(${p.dx ?? 0},${p.dy ?? 0}) from (${cur.x},${cur.y}) → (${cur.x + (p.dx ?? 0)},${cur.y + (p.dy ?? 0)}) OK`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    nlog('  → THREW: ' + msg);
    console.warn('[cockpit-bus] dispatchMouseMove threw:', msg);
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
