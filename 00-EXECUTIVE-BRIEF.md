# cozza-ai — Executive Brief

> **Audience:** Cozza · **Scope:** sintesi direzionale del brainstorming bundle Phase 0 · **Tempo di lettura:** 10 minuti
>
> Per gli approfondimenti vedi `docs/01..05` e per partire col coding vedi `prompts/claude-code-kickoff.md`.

---

## 1. La visione in tre frasi

Cozza vuole **smettere di tirare fuori il telefono** ogni volta che gli serve un'AI, mentre è in mobilità con i suoi futuri **Viture Beast XR**. cozza-ai sarà la sua **PWA personale come personal cockpit** che, via wake word "**Ehy Cozza**" sempre in ascolto, gli consente di parlare con Claude e OpenAI in italiano, ascoltare le risposte con una voce naturale ElevenLabs, switchare istantaneamente fra **5 workspace preconfigurati** ("Lavoriamo" apre vscode.dev + chat Claude + preview live, "Cinema" lancia Netflix/DAZN, ecc.), e collegarsi via SSH al PC Windows di casa per programmare in mobilità — tutto da uno schermo virtuale da 174 pollici davanti agli occhi. **Niente di tutto questo esiste come prodotto commerciale**, perciò se lo costruisce.

## 2. Le cinque decisioni che cambiano tutto

Dopo discovery con 5 agenti specialisti (business-analyst, solution-architect, ai-engineer, ux-ui-designer, project-orchestrator), il team ha convergence-point sulle seguenti decisioni che diventano i pilastri del progetto.

**A. Stack solo edge, niente server di casa nei cammino critico.** Frontend Vite + React + TypeScript + Tailwind, backend **Cloudflare Workers** con Hono + Zod (secrets nativi, free tier sufficiente per uso personale). Niente Express su PC casa per la prod: Workers ha latenza minore in giro per il mondo, deploy in 30 secondi e zero manutenzione. Il PC casa rimane solo per dev e per SSH personale (Tailscale).

**B. Voice loop con Web Speech in input + ElevenLabs Flash in output.** Web Speech API italiana è gratis, latency ~200ms per onfinalresult — buona abbastanza. ElevenLabs Flash v2.5 streaming dà TTFT audio <500ms con voce italiana naturale. **Trick fondamentale**: chunking della risposta AI per frase (regex split su `[.!?]`) e invio progressivo a TTS appena pronta → il loop end-to-end resta sotto i **2 secondi** percepiti.

**C. Glasses-first design ma con fallback graceful.** Sweet spot 58° FOV del Beast: il contenuto core deve stare nel **70% centrale**, mai informazioni vitali nei bordi. OLED nero puro come tela (`#000000`), accent ciano elettrico `#00E5FF` per brand. Font Geist 18px minimo. Voice è il **default** quando indossato; touch + tastiera BT prendono il sopravvento solo in modalità "seduto al bar".

**D. Costo runtime sotto €30/mese, dominato da ElevenLabs.** Modelli LLM consumano €8-15/mese (mix Haiku per chat veloce, Sonnet per coding, gpt-4o-mini per task semplici). ElevenLabs Creator a €22/mese è il driver principale. Hosting Cloudflare = €0. **Hard cap a €30/mese** con monitor giornaliero e alert.

**E. Niente API key client-side, mai.** Ogni chiamata AI passa dal backend Workers che mantiene i secrets in env vars. CORS allowlist sull'origin della PWA, CSP strict, rate limiting via Durable Object, validation Zod su ogni endpoint. Se il bundle frontend viene compromesso, il danno massimo è una richiesta consumata, non una key trafugata.

## 2-bis. Il livello sopra: voice commands & workspaces

Il bundle Phase 0 prevede **fin dall'inizio** funzionalità che vanno oltre la "chat AI". Vedi `docs/06-voice-commands-workspaces.md` per il dettaglio completo. In sintesi:

- **Wake word "Ehy Cozza"** sempre in ascolto via Picovoice Porcupine WASM (free tier, on-device, privacy-first, 0€ in più al mese)
- **Intent classifier ibrido**: pattern matching deterministico per i 12 comandi base + Claude Haiku come fallback per frasi non riconosciute
- **5 workspaces** preconfigurati che riorganizzano la UI in un colpo: *Casual* (home), *Lavoriamo* (vscode + chat + preview), *Cinema* (media tile fullscreen), *Studio* (reading + AI), *Ambient* (voice hands-free)
- **Workspace "Lavoriamo" deep dive**: vscode.dev a sinistra (60%) + ChatBubble Claude in alto a destra (25%) + iframe browser preview del progetto sul dev server del PC casa via Tailscale (15%). Comandi tipo "Ehy Cozza, esegui i test" mandano comandi a tmux SSH

Queste feature **non sono nel MVP** (vedi §3) ma sono nel V1, e l'architettura del MVP ha già **hooks predisposti** (Zustand store per workspace, intent dispatcher stub) per non dover refattorizzare quando le aggiungeremo.

## 3. Cosa esce nel MVP (2 settimane, ~20 ore di lavoro)

L'MVP è **brutalmente focalizzato** su una sola cosa: chattare con Claude e OpenAI da PWA installabile su Android, con voice loop completo. Nient'altro nel V0.

**Nel MVP:**
- PWA installabile su Android Chrome con service worker basic
- Chat streaming Claude (haiku-4-5, sonnet-4-6) e OpenAI (gpt-4o-mini, gpt-4o)
- Selettore modello in UI (manual)
- Voice input via Web Speech API italiana
- TTS via ElevenLabs streaming con voce italiana scelta
- Backend proxy Cloudflare Workers con env vars + CORS + rate limit
- Storage history in IndexedDB (Dexie)
- Dark mode forzato, layout 16:9 mobile portrait
- Smoke test E2E: 3 query voice round-trip funzionanti

**Fuori dal MVP** (rimandati a V1+):
- Wake word "Ehy Cozza" via Picovoice Porcupine
- Intent classifier completo + action dispatcher
- 5 workspaces preconfigurati (Casual / Lavoriamo / Cinema / Studio / Ambient)
- Workspace "Lavoriamo" con vscode.dev + chat Claude + preview iframe
- Layout ultrawide 32:9 per Beast Spatial Anchor
- App launcher tiles (Netflix, DAZN, etc.)
- SSH client web al PC casa
- Multi-conversation tabs
- Memory long-term, RAG su Obsidian
- Multimodal (camera input)

**Hooks architetturali nel MVP** (predisposti ma vuoti):
- Zustand `useWorkspaceStore` con workspace "Casual" hardcoded
- Intent dispatcher stub `executeIntent()` con solo intent `START_CHAT` implementato
- Service worker registry pronto per Porcupine WASM (caricato in V1)

Questa scelta è deliberata: **Cozza ha 5-10 ore/settimana**, e shipping è > completeness. Un MVP voice-loop funzionante dopo 2 settimane è un risultato concreto che si auto-alimenta come motivazione, contro un V1 che richiede 6 settimane senza nulla di mostrabile prima.

## 4. Il workflow operativo che Cozza userà

Dal punto di vista dell'utente Cozza-in-mobilità, il flusso target è:

1. Indossa i Viture Beast, collega USB-C al telefono Android
2. Lancia la PWA cozza-ai installata sull'home screen del telefono
3. La vede appare sullo schermo virtuale 174", scura, minimale
4. Long-press sul touch dello smartphone (push-to-talk) e parla in italiano
5. Web Speech API trascrive, manda al backend Workers
6. Workers chiama Anthropic con streaming
7. La risposta arriva token-per-token; appena la prima frase è completa, parte la chiamata ElevenLabs streaming
8. L'audio MP3 inizia a riprodursi sui speaker open-ear del Beast (o sull'auricolare BT) entro **<2 secondi totali**
9. Mentre AI parla, il transcript live è visualizzato in carattere grande al centro del FOV
10. Cozza può interrompere parlando di nuovo (barge-in: tronca TTS, riavvia STT)

Per le sessioni di coding seduto:
1. Stesso setup hardware + tastiera Bluetooth tascabile
2. Layout 32:9 ultrawide Spatial Anchor (vista fissa nello spazio)
3. vscode.dev a sinistra, chat AI a destra, terminal SSH al PC casa in basso
4. Tutto navigabile via Cmd+K command palette o voce

## 5. I tre rischi da non sottovalutare

Su 12 rischi censiti nella matrix di `docs/05-roadmap.md`, tre meritano attenzione particolare perché sono **fuori dal controllo del coding**.

**Rischio 1 — Telefono Android non compatibile USB-C DP Alt Mode.** Senza questo, il Beast è inutile. Verifica obbligatoria PRIMA di ordinare gli occhiali: cerca "<modello tuo telefono> DisplayPort Alt Mode" e conferma. Mitigazione: se il telefono attuale non supporta, calcola sostituzione phone (es. Pixel 9, Galaxy S24+, OnePlus 12) prima di acquistare il Beast.

**Rischio 2 — Web Speech API italiano accuratezza variabile.** Il riconoscimento italiano del browser è buono in ambiente silenzioso ma può degradare in metro o al bar. Mitigazione: piano B implementato dal Day 1 = fallback a Whisper API (~$6/MTok input audio) attivabile via toggle quando l'ambiente è rumoroso. Costo accettabile per uso occasionale.

**Rischio 3 — Costi ElevenLabs runaway.** Se Cozza usa molto voice (es. lunghe sessioni di studio audio), il piano Creator da 100k chars/mese può saltare. Mitigazione: monitor giornaliero in dashboard interno, hard cap settabile, fallback automatico a Web Speech TTS browser (voce sintetica gratis, qualità inferiore ma always-on).

## 6. Cosa fare questa settimana, prima di toccare codice

Quick wins pre-coding identificati nella roadmap. Sono tutte azioni da 5-30 minuti che eliminano fricion frizione successiva:

1. **Sottoscrivi ElevenLabs Creator** ($22/mese) → ottieni la API key
2. **Crea API key Anthropic** dal Console (con rate limit basso per safety)
3. **Crea API key OpenAI** Project key (con spending cap a $10/mese)
4. **Verifica USB-C DP Alt Mode** del tuo telefono Android attuale
5. **Installa Tailscale** sul PC Windows e sul telefono, prova SSH end-to-end
6. **Setup OpenSSH server** su Windows 11 (Impostazioni → App → Funzionalità facoltative)
7. **Installa WSL2 + Ubuntu 24.04** dentro Windows
8. **Crea repo GitHub privato** `cozza-ai`, configura branch protection
9. **Ordina Viture Beast** (lead time variabile, meglio anticipare)
10. **Compra tastiera Bluetooth** (Logitech Keys-To-Go 2 o Keychron Mini)

A questo punto sei pronto per partire. Apri Claude Code dentro `cozza-ai/`, incolla il contenuto di `prompts/claude-code-kickoff.md`, e parte la Phase 1.

## 7. Mapping agenti CLAUDE.md per le prossime fasi

Cozza ha già 25 agenti configurati in `C:\work\Cozza\CLAUDE.md`. Per la Phase 1 (MVP), sono coinvolti **5 agenti core** + **3 di supporto**:

**Core (Phase 1):**
- `senior-frontend-dev` — scaffold Vite, UI chat, voice button, PWA setup
- `senior-backend-dev` — Cloudflare Workers proxy, endpoint streaming
- `ai-engineer` — pipeline streaming Anthropic/OpenAI, ElevenLabs streaming, prompt patterns
- `code-reviewer` — review pre-merge ogni PR
- `security-auditor` — review API key handling, CORS, CSP, rate limit

**Supporto (chiamati on-demand):**
- `ux-ui-designer` — refinement UI quando appare strana sul Beast
- `devops-engineer` — Cloudflare Pages deploy, GitHub Actions
- `debugger` — solo se qualcosa va storto

Per V1+V2 il roster cambia, vedi `docs/05-roadmap.md` §11.

## 8. Definizione di successo

cozza-ai è **un successo per Cozza** quando:

- Lo usa **almeno 2 volte al giorno** dopo il primo mese (retention naturale)
- La latency voice round-trip media misurata è **<2.5s** (target 2s)
- Il costo runtime mensile reale è **≤€35** (con tolleranza 15% sopra target €30)
- Cozza si **diverte a usarlo** (criterio soggettivo ma decisivo: è un progetto personale, deve essere fun)

## 9. Conclusione

Il bundle di brainstorming di Phase 0 è completo. **Tutte le decisioni architetturali e di prodotto sono state prese**, motivate e documentate nei 5 documenti di `docs/`. Non ci sono "TBD" o questioni aperte che bloccano la Phase 1.

L'unica incognita esterna è hardware-related (compatibilità telefono, lead time del Beast) e si risolve in parallelo al coding.

**Forza Cozza, attacchiamo W1.**

---

> *Per qualsiasi punto di questo brief che vuoi approfondire o ridiscutere, vai al documento di dettaglio corrispondente in `docs/`. Per partire concretamente, apri `prompts/claude-code-kickoff.md`.*
