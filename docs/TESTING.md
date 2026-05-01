# Testing — cozza-ai

> Strategia test pratica per Phase 1. Pyramid: tante unit Vitest, pochi smoke Workers, 1 E2E manuale al giorno.

---

## 1. Stack

- **Unit / integration**: [Vitest](https://vitest.dev) per `apps/web` (jsdom), `apps/api` (node), `packages/shared` (node)
- **Component**: `@testing-library/react` + `jest-dom` matchers
- **IndexedDB in test**: `fake-indexeddb`
- **E2E**: Playwright opzionale (vedi `apps/web/playwright.config.ts`)

## 2. Run

```bash
pnpm test                         # tutti i workspace
pnpm --filter shared test         # solo schemi Zod
pnpm --filter api test            # backend Workers
pnpm --filter web test            # frontend
pnpm --filter web exec vitest --coverage  # con report v8
```

## 3. Cosa è coperto oggi (W1)

| File | Cosa testa |
|---|---|
| `packages/shared/src/schemas.test.ts` | Zod ChatRequest/Tts/Intent edge cases (5+ casi) |
| `apps/api/src/lib/sentence-chunker.test.ts` | streaming chunker — multiple boundaries, partial flush, decimali |
| `apps/api/src/middleware/cors.test.ts` | preflight reject ignoti, accept allowlist, no echo header su origini sconosciute |
| `apps/api/src/middleware/validate.test.ts` | invalid JSON, schema mismatch con details, body size 1 MB cap |
| `apps/api/src/routes/health.test.ts` | shape risposta + commit echo |
| `apps/web/src/lib/api.test.ts` | SSE parser frame splitting, errori HTTP |
| `apps/web/src/lib/intent.test.ts` | START_CHAT dispatch, fallback `not_implemented` |
| `apps/web/src/components/chat/ChatBubble.test.tsx` | render markdown link, streaming caret, rel-attributi |

## 4. Cosa NON è coperto (intenzionalmente)

- `useChat` end-to-end con Dexie reale → manuale (browser)
- Voice input — Web Speech API non emulabile in jsdom, smoke manuale
- TTS playback — MediaSource non disponibile in jsdom, smoke manuale
- Latenza end-to-end voice loop — misurazione manuale Day 1

## 5. E2E Playwright (opzionale)

Skippato di default in CI. Per girarlo locale:

```bash
pnpm --filter web exec playwright install
pnpm --filter web test:e2e
```

Spec base in `apps/web/e2e/smoke.spec.ts`: apre la PWA, controlla che il manifest sia valido e che la sidebar mostri lo stato vuoto.

## 6. Convenzioni

- Naming: `{file}.test.ts` o `.spec.ts` accanto al sorgente, **non** in cartella separata
- Format: `describe('Subject', () => { it('should X when Y', ...) })`
- No mock framework esterno — solo `vi.fn()` / `vi.stubGlobal()`
- I test devono essere deterministici (no `Date.now()` reale dove conta — mocka via `vi.useFakeTimers()`)
- Coverage minimo non bloccante in W1 — diventa gate dopo MVP

## 7. CI

Il job `CI · Lint · Typecheck · Build` esegue `pnpm test` come step obbligatorio. PR non passa se anche un solo test rosso.

## 8. Aggiungere un test

Prima il test, poi la feature (TDD ammesso ma non obbligatorio). Esempio:

```ts
// apps/web/src/lib/foo.test.ts
import { describe, it, expect } from 'vitest';
import { foo } from './foo';

describe('foo', () => {
  it('returns bar when called', () => {
    expect(foo()).toBe('bar');
  });
});
```
