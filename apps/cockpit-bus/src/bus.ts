import { EventEmitter } from 'node:events';
import type { CockpitEvent } from './events.js';

/**
 * In-memory pub/sub used by every adapter and by the WebSocket gateway.
 * Adapters push CockpitEvent objects; subscribers receive them.
 *
 * For history beyond live, see the SQLite store in `store.ts`.
 */
class Bus extends EventEmitter {
  emitEvent(e: CockpitEvent): void {
    this.emit('event', e);
    // also emit on a per-type channel for finer-grained subscriptions
    this.emit(`event:${e.type}`, e);
  }
  override on(
    name: 'event' | `event:${CockpitEvent['type']}`,
    fn: (e: CockpitEvent) => void,
  ): this {
    return super.on(name, fn);
  }
}

export const bus = new Bus();
bus.setMaxListeners(64);
