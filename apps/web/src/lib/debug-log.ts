/**
 * Tiny in-memory ring buffer for runtime events. Used by the chat debug
 * overlay and the admin Maintenance tab so we can investigate issues on
 * a phone without DevTools.
 */

export interface DebugEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  data?: unknown;
}

const MAX = 80;
const buf: DebugEntry[] = [];
const listeners = new Set<() => void>();

export function logEvent(
  level: DebugEntry['level'],
  scope: string,
  message: string,
  data?: unknown,
): void {
  const entry: DebugEntry = { ts: Date.now(), level, scope, message };
  if (data !== undefined) entry.data = data;
  buf.push(entry);
  if (buf.length > MAX) buf.shift();
  for (const fn of listeners) fn();
  // mirror to console for desktop dev
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.warn;
  fn(`[${scope}]`, message, data ?? '');
}

export const log = {
  info: (scope: string, message: string, data?: unknown) => logEvent('info', scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => logEvent('warn', scope, message, data),
  error: (scope: string, message: string, data?: unknown) =>
    logEvent('error', scope, message, data),
};

export function getDebugLog(): DebugEntry[] {
  return [...buf];
}

export function clearDebugLog(): void {
  buf.length = 0;
  for (const fn of listeners) fn();
}

export function subscribeDebugLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
