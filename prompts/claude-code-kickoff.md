# Claude Code — Kickoff Prompt per cozza-ai Phase 1 (MVP)

> **Come usare questo file:** apri Claude Code nella cartella `C:\work\Cozza\cozza-ai\` (in modo che inerite il `CLAUDE.md` con i 25 agenti) e incolla l'intero blocco sotto come primo messaggio. Claude Code seguirà il protocollo Phase 1 del CLAUDE.md.

---

## PROMPT DA INCOLLARE IN CLAUDE CODE

```
Inizio Phase 1 (MVP) del progetto cozza-ai. Il brainstorming bundle di Phase 0 è già pronto in questa cartella, in particolare:

- 00-EXECUTIVE-BRIEF.md — sintesi direzionale (leggi prima)
- docs/01-business-analysis.md — user stories, scope MVP
- docs/02-solution-architecture.md — stack, ADR, diagram
- docs/03-ai-engineering.md — pipeline LLM e voice
- docs/04-ux-design.md — design system OLED
- docs/05-roadmap.md — sprint W1-W2 dettagliato
- docs/06-voice-commands-workspaces.md — wake word, intent system, 5 workspace (V1+, ma con hooks in MVP)

PROTOCOLLO DI ESECUZIONE (per CLAUDE.md di Cozza):

Phase 1 — MVP (2 settimane, ~20 ore di lavoro). Goal: PWA installabile su Android Chrome con chat streaming Claude+OpenAI e voice loop end-to-end via ElevenLabs.

Procedi nell'ordine seguente, usando gli agenti specialisti del CLAUDE.md:

=== SETTIMANA 1 — Foundation + Chat AI testuale ===

Step 1.1 — solution-architect: rileggi docs/02 e docs/05, poi crea il tree di progetto definitivo (monorepo pnpm con apps/web e apps/api), conferma o eventualmente correggi le decisioni dell'architettura, e produci il documento docs/architecture-final.md.

Step 1.2 — senior-frontend-dev + devops-engineer in parallelo:
  - Frontend dev: scaffold Vite + React 18 + TypeScript + TailwindCSS + vite-plugin-pwa nella cartella apps/web. Configura Tailwind con palette OLED (background #000, accent #00E5FF, font Geist), dark mode forzato, manifest PWA con icon + shortcut.
  - DevOps: configura GitHub Actions per build+test+preview deploy su Cloudflare Pages; setup .env.example documentato; pre-commit hook con lint+typecheck.

Step 1.3 — senior-backend-dev + security-auditor in parallelo:
  - Backend: scaffold Cloudflare Workers in apps/api con Hono + Zod. Endpoints: POST /api/chat/anthropic (streaming SSE), POST /api/chat/openai (streaming SSE), POST /api/tts (proxy ElevenLabs streaming MP3), GET /api/healthz. Secrets via wrangler.toml binding (ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY).
  - Security: review CORS allowlist (solo origin PWA), CSP header strict, rate limiting via Durable Object o cf-rate-limit, validation Zod su ogni body, no full prompt in logs.

Step 1.4 — senior-frontend-dev + ux-ui-designer in parallelo:
  - UI chat: componenti ChatBubble, MessageList con virtualizzazione, PromptInput con Textarea autoresize, ModelSelector (segmented control con haiku/sonnet/4o-mini/4o). Streaming text rendering character-by-character con buffering 50ms per smoothing.
  - UX: applicare design system docs/04 (sweet spot 70%, padding generoso, no UI nei bordi).

Step 1.5 — code-reviewer: full review pre-merge dello scaffold + chat. Test E2E base: 3 messaggi a Claude e 3 a OpenAI con streaming visibile in UI.

=== SETTIMANA 2 — Voice loop + storage + polish ===

Step 2.1 — senior-frontend-dev + ai-engineer in parallelo:
  - Voice input: hook React `useVoiceInput()` che incapsula Web Speech API (italiano: lang='it-IT'). Stati: idle | listening | processing. Push-to-talk via long-press su VoiceButton, oppure attivabile da spazio su tastiera BT.
  - AI engineer: implementa il "sentence chunker" lato backend Workers che spezza la stream Anthropic/OpenAI per [.!?] e fa pre-fetch ElevenLabs streaming alla prima frase completa. Vedi docs/03 sezione 3 (voice pipeline) per il pattern raccomandato.

Step 2.2 — ai-engineer + senior-backend-dev:
  - Endpoint /api/tts: proxy stream ElevenLabs Flash v2.5 con optimize_streaming_latency=4, voice_id parametrizzato. Audio frontend riprodotto con MediaSource + Audio() element. Implementa anche barge-in: utente parla mentre AI risponde → tronca audio (audio.pause(), AbortController su fetch).

Step 2.3 — senior-frontend-dev + data-engineer:
  - Storage IndexedDB con Dexie. Schema: conversations (id, model, createdAt, lastMessageAt) + messages (id, conversationId, role, content, audioUrl, createdAt). Hook React useConversations() + useMessages(conversationId).
  - UI history sidebar collapsabile con elenco conversazioni recenti.
  - **Hooks architetturali** (vedi docs/06): predispone Zustand `useWorkspaceStore` con workspace "casual" hardcoded e intent dispatcher stub `executeIntent(intent, params)` con solo `START_CHAT` implementato. Service worker pronto per registrazione Porcupine WASM in V1. Questi hooks NON aggiungono feature visibili nel MVP, ma evitano refactoring quando arriva V1.

Step 2.4 — code-reviewer + security-auditor:
  - Review finale: nessuna API key nel bundle (verifica con grep nel build output), CSP attivo, rate limit testato (>10 req/min ritornano 429), Dexie funziona offline.
  - Smoke test E2E completo: voice loop italiano con 3 query reali end-to-end. Misura latency (target <2s) e logga.

Step 2.5 — devops-engineer: deploy MVP su Cloudflare Pages (prod), domain custom o subdomain coworkers.dev. Tag git v0.1.0-mvp.

=== DEFINITION OF DONE MVP (verifica finale) ===

Conferma esplicitamente che TUTTI i seguenti criteri sono soddisfatti prima di chiudere la Phase 1:

- [ ] PWA installabile su Android Chrome (manifest + icons + service worker)
- [ ] Chat con Claude (haiku-4-5 e sonnet-4-6) streaming visibile in UI
- [ ] Chat con OpenAI (gpt-4o-mini, gpt-4o) streaming visibile in UI
- [ ] Selettore modello UI funzionante
- [ ] Voice input via Web Speech API in italiano funzionante
- [ ] TTS via ElevenLabs streaming con voce italiana selezionata
- [ ] Backend proxy con env vars per API keys (verificato no leak)
- [ ] Rate limiting (>10 req/min ritornano 429)
- [ ] Storage history in IndexedDB con Dexie
- [ ] Dark mode forzato (`color-scheme: dark`)
- [ ] HTTPS attivo in dev e prod
- [ ] Voice loop end-to-end <2.5s misurato (target 2s)
- [ ] CORS allowlist origin only
- [ ] CSP header strict deployato
- [ ] Test smoke E2E con Playwright per 3 query reali

=== REGOLE OPERATIVE (da CLAUDE.md di Cozza) ===

- Nessun commit senza passaggio di code-reviewer
- Nessuna modifica security senza pass di security-auditor
- TypeScript strict mode, no any senza TODO
- Conventional Commits con scope (feat(api), feat(web), fix, refactor, etc.)
- Branch naming: feature/W1-scaffold, feature/W2-voice-loop, etc.
- API key MAI nel client: se le vedo nel bundle, code-reviewer blocca il merge
- Test passing prima di ogni merge
- README.md aggiornato con istruzioni dev locale dopo ogni step

=== INIZIA QUI ===

Per cominciare:
1. Conferma di aver letto i 5 documenti di docs/
2. Apri Step 1.1 chiamando l'agente solution-architect
3. Procedi step by step

Ho un budget di 5-10 ore/settimana. Mantieni i task piccoli e completabili in 1-2 ore ciascuno. Se uno step è troppo grande, spezzalo in sub-step e fammi sapere.

Forza, partiamo.
```

---

## Note operative per Cozza

### Prima di lanciare il prompt sopra

Assicurati di aver completato i quick wins indicati nel `00-EXECUTIVE-BRIEF.md` §6:

- [ ] API key Anthropic generata (Console → API Keys → con rate limit)
- [ ] API key OpenAI generata (Project key con spending cap $10/mese)
- [ ] Subscription ElevenLabs Creator attiva, voice ID italiana scelta
- [ ] Cloudflare account creato (free tier OK)
- [ ] WSL2 + Ubuntu 24.04 installato su Windows
- [ ] Repo GitHub privato `cozza-ai` creato
- [ ] Node 20+ e pnpm installati

### Variabili da preparare nel `.env.example`

```bash
# Frontend (apps/web/.env)
VITE_API_BASE_URL=https://api.cozza-ai.workers.dev
VITE_ELEVENLABS_VOICE_ID=<voice_id_italiana>
VITE_DEFAULT_MODEL=claude-haiku-4-5

# Backend (apps/api/.dev.vars - mai committato)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=sk_...
ALLOWED_ORIGINS=http://localhost:5173,https://cozza-ai.pages.dev
```

### Comandi di setup iniziale

Quando Claude Code chiede di iniziare lo scaffold:

```bash
# Crea monorepo pnpm
mkdir cozza-ai && cd cozza-ai
pnpm init
echo "packages:\n  - 'apps/*'" > pnpm-workspace.yaml

# Frontend
mkdir -p apps/web
cd apps/web
pnpm create vite@latest . --template react-ts
pnpm add -D tailwindcss postcss autoprefixer vite-plugin-pwa
pnpm add dexie zod
cd ../..

# Backend
mkdir -p apps/api
cd apps/api
pnpm create cloudflare@latest . --type=hello-world --framework=hono
pnpm add zod
pnpm add -D wrangler
```

### Se qualcosa va storto

Pattern di troubleshooting:
- **Build fallisce**: `debugger` agent + log completo
- **API restituisce 401/403**: `security-auditor` per verifica chiavi e CORS
- **Voice non funziona su Android**: verifica HTTPS attivo (Web Speech API richiede secure context)
- **Latency sopra 3s**: `ai-engineer` per ottimizzare chunking
- **Bundle troppo grande**: `senior-frontend-dev` per code splitting

### Prossimi prompt (dopo MVP)

Quando l'MVP è chiuso, tornerò con:
- `prompts/claude-code-phase2-v1.md` per Phase 2 (V1 Cockpit: wake word "Ehy Cozza" via Picovoice Porcupine + 3 workspace base [Casual, Lavoriamo, Cinema] + intent catalog 12 comandi + UI Beast 32:9)
- `prompts/claude-code-phase3-v2.md` per Phase 3 (V2 Power User: 5 workspace completi, 25+ intent, memoria long-term, multimodal, integrazioni Calendar/Mail)

### Anticipazione V1 (per orientamento, non da implementare ora)

Il V1 introdurrà:
- **Wake word "Ehy Cozza"** sempre in ascolto, via Picovoice Porcupine WASM (free tier personale, on-device privacy-first)
- **Intent classifier ibrido**: pattern matching regex/keyword (5-10ms) per i 12 comandi base + fallback Claude Haiku per frasi non riconosciute (200-400ms)
- **3 workspaces**: Casual (home), Lavoriamo (vscode.dev + Claude chat + iframe preview via Tailscale), Cinema (launcher Netflix/DAZN/NOW/YouTube/Prime/Spotify)
- **Action dispatcher**: handler per `OPEN_APP`, `SWITCH_WORKSPACE`, `START_CHAT`, `STOP`, `READ_LAST`, `OPEN_TERMINAL` via SSH

L'MVP costruisce le **fondamenta** per tutto questo (Zustand store, intent dispatcher stub, service worker). Vedi docs/06-voice-commands-workspaces.md per il dettaglio.

---

*Pronto a partire. Ricorda: shipping > completeness, voice > text, glasses-first ma fallback graceful.*
