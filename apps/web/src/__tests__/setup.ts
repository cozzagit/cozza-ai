import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom: no MediaSource by default
if (typeof globalThis.MediaSource === 'undefined') {
  // Disable MediaSource → audio.ts falls back to Blob path automatically
  Object.defineProperty(globalThis, 'MediaSource', {
    configurable: true,
    value: undefined,
    writable: true,
  });
}
