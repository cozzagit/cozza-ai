# cozza-ai

> Il tuo cockpit AI personale per Viture Beast XR — Claude + OpenAI + voce italiana ElevenLabs in una PWA glasses-optimized.

**Status:** Phase 1 — MVP scaffolding committato (2026-05-01).
**Target deploy:** [https://cozza-ai.vibecanyon.com](https://cozza-ai.vibecanyon.com) (Aruba VPS, nginx + PM2 + Let's Encrypt).
**Repo:** [github.com/cozzagit/cozza-ai](https://github.com/cozzagit/cozza-ai)

---

## Architettura runtime

```
PWA (Pixel 10a + Beast XR)  ─HTTPS─▶  nginx @ cozza-ai.vibecanyon.com
                                       │
                                       ├─ /         → /var/www/cozza-ai/apps/web/dist  (statici)
                                       └─ /api/*    → 127.0.0.1:3025  (Node Hono via PM2)
                                                          │
                                                          └─▶ Anthropic / OpenAI / ElevenLabs
```

- **Frontend**: Vite + React 18 + TypeScript strict + Tailwind + vite-plugin-pwa
- **Backend**: Node 20+ + Hono + Zod, listen `127.0.0.1:3025`, PM2 fork
- **Stato locale**: IndexedDB via Dexie (chat history client-side)
- **Voice**: Web Speech API (STT, it-IT) + ElevenLabs Flash v2.5 streaming (TTS)
- **Deploy**: `pnpm deploy:vps` (rsync + PM2 reload + nginx reload + certbot idempotente)

## Local dev

```bash
# Prerequisiti
node --version            # >= 20.18.0
pnpm --version            # >= 9
corepack enable           # se pnpm non è installato

# 1. Install + build shared package
pnpm install
pnpm --filter @cozza/shared build

# 2. Backend env (gitignored)
cp apps/api/.env.example apps/api/.env
# Edita apps/api/.env e metti le 3 chiavi Anthropic / OpenAI / ElevenLabs

# 3. Frontend env
cp apps/web/.env.example apps/web/.env
# Edita VITE_ELEVENLABS_VOICE_ID con un voice id italiano

# 4. Avvia entrambi (vite proxa /api/* → 127.0.0.1:3025)
pnpm dev
# - frontend: http://localhost:5173
# - api:      http://127.0.0.1:3025

# 5. Smoke
curl http://127.0.0.1:3025/api/healthz
```

## Comandi utili

```bash
pnpm dev:web         # solo frontend (build shared incluso)
pnpm dev:api         # solo Hono Node
pnpm typecheck       # TS strict su tutti i workspace
pnpm lint            # ESLint
pnpm format          # Prettier
pnpm test            # Vitest tutti i package
pnpm build           # build prod (shared + web + api)
pnpm deploy:vps      # rsync + PM2 reload (vedi docs/DEPLOY.md)
```

## Documentazione

- [docs/architecture-final.md](docs/architecture-final.md) — riferimento autoritativo Phase 1
- [docs/DEPLOY.md](docs/DEPLOY.md) — deploy VPS Aruba step-by-step
- [docs/TESTING.md](docs/TESTING.md) — strategia test
- [docs/01..06](docs/) — bundle Phase 0 (business / UX / AI eng / roadmap / voice)
- [SETUP-GUIDE.md](SETUP-GUIDE.md) — setup ambiente Day 1 (parzialmente superata da DEPLOY.md)

## Decisioni tecniche (ratificate)

- **Frontend**: Vite + React 18 + TypeScript + Tailwind + vite-plugin-pwa
- **Backend**: Node Hono + Zod (rate-limit in-memory, fork instances=1)
- **Voice STT**: Web Speech API (browser, gratis, italiano)
- **Voice TTS**: ElevenLabs Flash v2.5 streaming (voice italiana, TTFB <500ms)
- **Storage**: IndexedDB via Dexie
- **Hosting**: VPS Aruba (188.213.170.214) + nginx + PM2 + Let's Encrypt
- **Brand color**: `#00E5FF` cyan elettrico su OLED puro
- **Font**: Geist + Geist Mono

## Costi runtime stimati

| Voce | MVP | V1 | V2 |
|------|-----|----|----|
| Anthropic API | €5 | €10 | €15 |
| OpenAI API | €3 | €5 | €8 |
| ElevenLabs Creator | €22 | €22 | €22 |
| Hosting VPS Aruba | €0* | €0 | €0 |
| **Totale** | **~€30** | **~€37** | **~€45** |

*La VPS è già condivisa con altri progetti Cozza, costo marginale 0.

## Roadmap

```
Phase 0 — Discovery        ✓ DONE
Phase 1 — MVP              ✓ Code scritto. In attesa pnpm install + secrets + deploy
Phase 2 — V1 Cockpit       wake word "Ehy Cozza" + 3 workspaces + UI Beast
Phase 3 — V2 Power User    5 workspace, 25+ intent, memoria, multimodal
Phase 4 — Polish & OSS     continuo
```

## Licenza & privacy

Repository privato fino al rilascio Phase 4. La PWA è strict zero-trust per il client: nessuna API key esposta, tutto via backend Node con CORS allowlist e CSP strict.

---

*Generato il 2026-05-01. Pattern deploy VPS standard (memoria `vps-aruba.md` + `feedback-deploy-pattern.md`).*
