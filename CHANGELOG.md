# Changelog

Tutte le modifiche significative a cozza-ai. Formato: [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Added — Phase 1 W1 scaffold (2026-05-01)
- Monorepo pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`
- `docs/architecture-final.md`: documento autoritativo Phase 1 con tree, ADR consolidati, contratti API Zod, schema Dexie, hooks V1
- `packages/shared`: Zod schemas + tipi TS condivisi (chat, tts, intent)
- `apps/web`: Vite + React 18 + TypeScript strict + Tailwind v3 + vite-plugin-pwa
  - Stores Zustand: `workspace` (V1 hook predisposto), `settings` (modello default, TTS toggle)
  - Lib: `db` Dexie schema, `api` SSE + TTS client, `intent` dispatcher stub, `audio` StreamingAudioPlayer con barge-in
  - Hooks: `useChat`, `useVoiceInput` (Web Speech IT), `useTts`, `useConversations`, `useMessages`
  - Components chat: `ChatBubble` (markdown + highlight), `MessageList`, `PromptInput`, `ModelSelector`
  - Components voice: `VoiceButton` (push-to-talk + Spazio per tastiera BT)
  - Components layout: `AppShell`, `Sidebar`
  - Manifest PWA, fonts Geist, palette OLED + accent ciano `#00E5FF`
  - Wake-word worker placeholder (V1)
- `apps/api`: Cloudflare Workers + Hono + Zod
  - Endpoint `/api/chat/anthropic` SSE streaming Claude
  - Endpoint `/api/chat/openai` SSE streaming GPT
  - Endpoint `/api/tts` proxy ElevenLabs Flash v2.5 streaming MP3
  - Endpoint `/api/healthz`
  - Middleware: CORS allowlist, security headers (CSP/HSTS/Permissions-Policy), rate limit native CF binding 30/min, Zod body validator con limit 1 MB
- DevOps: GitHub Actions CI (lint + typecheck + test + build + secret scan), workflow Deploy su tag, husky pre-commit + lint-staged
- TypeScript strict everywhere, no `any`, ESLint con regole TS + React + a11y + sicurezza

### Added — Phase 1 W2 testing & robustness (2026-05-01 PM)
- Vitest config per `apps/web` (jsdom + RTL + fake-indexeddb), `apps/api` (node), `packages/shared` (node)
- Test setup `apps/web/src/__tests__/setup.ts` con cleanup automatico e MediaSource shim
- 8 file di test smoke:
  - `packages/shared/src/schemas.test.ts` — Zod request/tts/intent edge cases
  - `apps/api/src/lib/sentence-chunker.test.ts` — streaming chunker boundaries
  - `apps/api/src/middleware/cors.test.ts` — preflight allow/deny + non-echo header
  - `apps/api/src/middleware/validate.test.ts` — invalid JSON / schema / 1MB cap
  - `apps/api/src/routes/health.test.ts` — risposta + commit echo
  - `apps/web/src/lib/api.test.ts` — SSE parser frame splitting + ApiError
  - `apps/web/src/lib/intent.test.ts` — START_CHAT dispatch + not_implemented fallback
  - `apps/web/src/components/chat/ChatBubble.test.tsx` — markdown link, streaming caret, security rel-attrs
- Playwright config + smoke E2E `apps/web/e2e/smoke.spec.ts` (manifest, OLED bg, model selector, voice button)
- `docs/TESTING.md` strategia + run + convenzioni
- Logo brand SVG `assets/logo.svg` (cyan ring + mic glyph) per generazione PWA icons via pwa-asset-generator

### Changed — Phase 1 W2 robustness (2026-05-01 PM)
- `apps/api/src/middleware/validate.ts`: tipizzazione esplicita `ValidatedVars` per Hono Variables (no più cast unsafe)
- `apps/api/src/routes/chat.ts`: handler estratto in funzione `handleStream`, tipi propagati con `Context<AppEnv>`
- `apps/api/src/routes/tts.ts`: stesso pattern `ValidatedVars`
- `apps/web/src/lib/audio.ts`: pump pulita, `signal.abort` gestito una volta sola, no race su `endOfStream`, drain check pre-`endOfStream` per evitare InvalidStateError
- `apps/web/src/hooks/useChat.ts`: `cancel()` no-op se già abortito
- `apps/web/src/App.tsx`: workspace store letto via subscribe (non `getState` in render), esposto su `window.__cozza` in useEffect
- ESLint v9 → v8.57 + parser/plugin TS v7 (compat `.eslintrc.cjs` legacy, no flat config)
- `prettier-plugin-tailwindcss` rimosso da config root (resta solo come editor plugin in apps/web)

### Changed — Phase 1 W2 deploy target switch (2026-05-01 evening)
- **Backend portato Cloudflare Workers → Node Hono + PM2 su VPS Aruba**
  - Nuovo entry `apps/api/src/server.ts` con `@hono/node-server`, listen 127.0.0.1:3025
  - Nuovo `apps/api/src/config.ts` con dotenv + Zod validation (fail-fast in prod su key mancanti)
  - Tutti i route/middleware migrati da `c.env.X` a `c.var.config.X` via `c.set('config', ...)`
  - Rate-limit: nuovo `rate-limit.ts` token bucket in-memory (Map IP+path, 60s window, GC opportunistico)
  - Test rate-limit aggiunto: `apps/api/src/middleware/rate-limit.test.ts`
  - Test cors/validate/health aggiornati per nuovo `AppEnv`
  - Eliminati `wrangler.toml`, `.dev.vars.example`
- **Frontend**:
  - Eliminati `apps/web/public/_headers` e `_redirects` (specifici Cloudflare Pages)
  - Vite ha proxy `/api/* → 127.0.0.1:3025` per dev (same-origin in prod)
  - `VITE_API_BASE_URL` default vuoto (same-origin via nginx)
- **Build pipeline**:
  - `packages/shared` ora compila in `dist/` (target: ESM + d.ts) → consumato via node_modules workspace symlink invece di TS path alias
  - Rimosso path alias `@cozza/shared` da tsconfig + vite + vitest (risolto via package.json#main)
  - `apps/api/package.json` aggiunto `tsx`, `tsc-alias`, `rimraf`, `@hono/node-server`, `dotenv`
  - Script root `pnpm dev`/`build`/`test` ora buildano shared come prerequisito
- **Deploy**:
  - Nuovo `ecosystem.config.cjs` (PM2 fork, 300M restart, log su /var/log/pm2/)
  - Nuovo `deploy/nginx-cozza-ai.conf` (subdomain SSL-ready, proxy_buffering off per SSE, cache 30d su /assets)
  - Nuovo `deploy/deploy.sh` end-to-end (build → rsync → pm2 reload → nginx reload → certbot idempotente → curl healthz)
  - Script `pnpm deploy:vps`
- **CI**: drop deploy.yml CF, ci.yml unico job (lint + typecheck + test + build + secret scan)
- **Docs**: `docs/DEPLOY.md` riscritta per VPS, `README.md` con link repo `cozzagit/cozza-ai`, `architecture-final.md` ADR-001 e ADR-004 aggiornati
- **DNS**: record A `cozza-ai.vibecanyon.com → 188.213.170.214` impostato 2026-05-01

### Pending — utente
- Push del primo commit su `https://github.com/cozzagit/cozza-ai.git`
- `pnpm install` locale (genera lockfile)
- Generare PWA icons 192/512 in `apps/web/public/icons/` (vedi `assets/logo.svg`)
- Compilare `apps/api/.env` locale + `apps/web/.env` (voice id IT)
- Creare `/var/www/cozza-ai/apps/api/.env` sulla VPS con i secrets prod (vedi `docs/DEPLOY.md §1.4`)
- `pnpm deploy:vps` per il primo deploy
- Smoke test E2E con Pixel 10a (in arrivo 2026-05-04)
- Test E2E con Beast (in arrivo 2026-05-07)
