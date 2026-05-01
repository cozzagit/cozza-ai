# cozza-ai — Business Analysis

> Documento prodotto dall'agente `business-analyst` secondo il framework definito in `C:\work\Cozza\CLAUDE.md`.
> Versione 1.0 — 2026-05-01 — Owner: Cozza (luca.cozza@gmail.com)

---

## 0. Executive Summary

cozza-ai e' una **PWA personale** che unifica Claude (Anthropic) e OpenAI in una singola interfaccia chat ottimizzata per **Viture Beast XR** (smart glasses 174" virtuali, OLED 1250 nit), gestita da telefono Android via USB-C DP Alt Mode. L'app aggiunge **voice I/O** (Web Speech API in input + ElevenLabs TTS italiano in output), un **launcher mediatico** (Netflix, NOW, DAZN, Spotify, YouTube) e un **layer di mobilita' per developer** (vscode.dev embed + SSH al PC di casa via Tailscale).

L'obiettivo e' trasformare gli occhiali Beast in un **terminale AI portatile**: caffe', treno, palestra, divano. Stack: Vite + React + TypeScript + TailwindCSS + PWA, backend Cloudflare Workers come proxy delle API key. Budget runtime target: **<30 EUR/mese**.

---

## 1. Persona principale: Cozza

### Profilo demografico e professionale

| Attributo | Valore |
|---|---|
| Nome | Luca Cozza |
| Eta' | 38 anni |
| Localita' | Italia (uso multi-contesto: casa, mobile, palestra) |
| Ruolo | Senior Software Developer / Solo-builder |
| Stack quotidiano | TypeScript, Node.js, React, Python, WSL2 Ubuntu, tmux |
| Strumenti AI | Claude Code agentico (25 agenti specialisti configurati in CLAUDE.md), ChatGPT Plus, Cursor occasionale |
| Hardware in arrivo | Viture Beast XR + tastiera Bluetooth tascabile |
| Setup casa | PC Windows con WSL2, OpenSSH server, Tailscale, Claude Code in tmux persistente |
| Lingua AI | Italiano (output) + inglese (codice e prompt tecnici) |

### Livello tecnico

Alto. Cozza non e' un utente passivo: ha gia' configurato un'**agency di 25 agenti** (Engineering + Marketing) con regole stringenti di code-review, security baseline e workflow per fasi. Conosce il dominio di OpenSSH, Tailscale, PWA, WebRTC, streaming SSE, Web Audio API. Apprezza soluzioni minimal, evita over-engineering, vuole spedire in giorni non mesi.

### Abitudini quotidiane

- 07:30 — Caffe' al bar: vorrebbe consultare Claude per pianificare la giornata senza tirare fuori il laptop.
- 09:00 — Lavoro al PC fisso (sessione Claude Code in tmux gia' attiva).
- 13:00 — Pausa pranzo: legge documentazione, fa brainstorming.
- 18:00 — Palestra: vuole controllare lo stato di task in background (es. build CI/CD) o ascoltare un riassunto vocale di un articolo.
- 21:00 — Divano: Netflix/NOW/DAZN sugli occhiali Beast, ma vuole anche poter chattare con un'AI senza cambiare device.
- Notte — Sessioni di coding mobile sporadiche: SSH al PC di casa per controllare un long-running task.

### Frustrazioni attuali con i tool AI da mobile

1. **Le app native (ChatGPT, Claude) sono pensate per smartphone in mano**, non per occhiali XR con FOV 58° e layout 16:9 ultrawide.
2. **Voice input mediocre** in italiano nelle app ufficiali: latenza alta, no streaming reale.
3. **Voice output robotico**: la TTS di sistema Android in italiano e' inascoltabile per piu' di 2 minuti.
4. **Switching modello laborioso**: cambiare tra Claude Sonnet 4.5 e GPT-4o richiede di cambiare app.
5. **Niente shortcut unificati**: per passare da chat AI a Spotify a Netflix servono tre tap e tre app.
6. **SSH dal cellulare e' scomodo**: Termux funziona ma richiede setup, niente integrazione con le AI.
7. **Costo e privacy**: usare l'app ufficiale OpenAI da mobile espone l'account; vorrebbe un layer suo con rate limit e log.

### Obiettivi specifici con cozza-ai

- **OB-1**: Avere **una sola PWA** che parli con Claude e OpenAI, con switch del modello in 1 tap.
- **OB-2**: Dettare in italiano e ricevere risposta vocale **naturale** (ElevenLabs) in <2s round-trip.
- **OB-3**: Da occhiali Beast, lanciare Netflix/NOW/DAZN/Spotify/YouTube senza togliersi gli occhiali.
- **OB-4**: Aprire una sessione SSH al PC di casa direttamente dalla PWA, riprendere tmux dove l'aveva lasciato.
- **OB-5**: Editare un file su vscode.dev embeddato senza cambiare contesto.
- **OB-6**: Spendere meno di 30 EUR/mese di API totali.
- **OB-7**: Non esporre mai una API key client-side.

### Situazioni d'uso tipiche

- **Caffe' (5 min)**: occhiali off, telefono in mano, voice query rapida a Claude.
- **Treno (45 min)**: occhiali on, tastiera BT, sessione di coding via vscode.dev + chat parallela con Claude.
- **Palestra (60 min)**: occhiali off, auricolari, voice-to-voice con AI per audio-learning.
- **Divano sera (2-3h)**: occhiali on, modalita' immersiva, switch fluido tra chat e Netflix/DAZN.

---

## 2. Personas secondarie

### Persona 2 — Marco, l'early-adopter di smart glasses

| Attributo | Valore |
|---|---|
| Eta' | 29 |
| Ruolo | Product Manager tech |
| Hardware | Xreal One, valuta Viture Pro |
| Bisogno | Una PWA AI ottimizzata per FOV stretti, dark mode OLED, font grandi |
| Trigger di adozione | Scopre cozza-ai su GitHub o Reddit r/Xreal; ha gia' un account Anthropic |
| Comportamento | Forka il repo, configura le sue API key, contribuisce con PR di compatibilita' Xreal |

Se cozza-ai venisse rilasciato open-source, Marco diventerebbe contributor entro la prima settimana e portrebbe il supporto a Xreal/Rokid come PR.

### Persona 3 — Sara, dev mobile-first content creator

| Attributo | Valore |
|---|---|
| Eta' | 33 |
| Ruolo | Indie developer + tech YouTuber |
| Pain point | Lavora spesso da iPad e telefono, le app AI native non offrono pipeline voice di qualita' |
| Trigger di adozione | Cerca un'alternativa a ChatGPT app per registrare voice-overs in italiano usando ElevenLabs |
| Use case | Usa cozza-ai per dettare script video, ottenere riscritture, esportare l'audio TTS direttamente |

Sara userebbe cozza-ai come **back-office vocale** integrato nel suo workflow di creator.

---

## 3. Epic + User Stories

### EPIC-1 — Conversazione AI multi-modello

- **US-1.1** Come Cozza, voglio una chat unificata con Claude Sonnet 4.5 e GPT-4o/4.1, perche' voglio scegliere il modello migliore per ogni task senza cambiare app.
- **US-1.2** Come Cozza, voglio cambiare modello con un selector in alto a 1 tap, perche' in 58° FOV non posso permettermi menu profondi.
- **US-1.3** Come Cozza, voglio risposte in **streaming SSE** token-by-token, perche' percepisco velocita' e posso interrompere.
- **US-1.4** Come Cozza, voglio una **conversation history persistente** in IndexedDB, perche' voglio riprendere chat aperte da device diversi (stesso utente).
- **US-1.5** Come Cozza, voglio poter **interrompere** il streaming con un bottone o comando vocale "stop", perche' a volte capisco subito che la risposta sbaglia.
- **US-1.6** Come Cozza, voglio un selettore di **system prompt preset** (coding, brainstorm, italiano colloquiale), perche' cambia il tono in base al contesto.

### EPIC-2 — Voice Pipeline

- **US-2.1** Come Cozza, voglio dettare in italiano via Web Speech API con feedback visivo del livello audio, perche' devo sapere che mi sta sentendo.
- **US-2.2** Come Cozza, voglio TTS in italiano via ElevenLabs (voce naturale), perche' la TTS di sistema Android non e' tollerabile per piu' di 2 minuti.
- **US-2.3** Come Cozza, voglio un fallback automatico a `SpeechSynthesis` del browser se ElevenLabs e' offline o ho superato la quota mensile, perche' non voglio mai un'esperienza muta.
- **US-2.4** Come Cozza, voglio un toggle **Push-to-talk** (tieni premuto) vs **Hands-free** (VAD - Voice Activity Detection), perche' in palestra voglio hands-free, in treno push-to-talk.
- **US-2.5** Come Cozza, voglio salvare le ultime 10 risposte audio TTS in cache, perche' se ripeto la stessa domanda non voglio ripagarla.
- **US-2.6** Come Cozza, voglio impostare la voce ElevenLabs (femminile/maschile, velocita' 0.8-1.2x), perche' personalizzo l'esperienza.

### EPIC-3 — Media Launcher

- **US-3.1** Come Cozza, voglio una griglia di tile (Netflix, NOW, DAZN, Spotify, YouTube) sulla home, perche' voglio lanciare un servizio in 1 tap dagli occhiali.
- **US-3.2** Come Cozza, voglio che ogni tile apra il servizio in **standalone PWA** se installata, altrimenti in nuova tab, perche' massimizzo immersione sugli occhiali.
- **US-3.3** Come Cozza, voglio un comando vocale "apri Netflix", perche' senza tastiera devo poter delegare alla voce.
- **US-3.4** Come Cozza, voglio riordinare le tile via drag-and-drop e salvare l'ordine in localStorage, perche' uso piu' Spotify che DAZN.
- **US-3.5** Come Cozza, voglio aggiungere shortcut custom (URL + label + icona), perche' domani potrei voler aggiungere Twitch o Plex.

### EPIC-4 — Dev Mobility

- **US-4.1** Come Cozza, voglio un bottone "Open VS Code" che apre `https://vscode.dev` in iframe a tutto schermo (o nuova tab se iframe blocked), perche' devo poter editare codice da treno.
- **US-4.2** Come Cozza, voglio un bottone "SSH home" che apre `https://termius.com/web` o `https://ssh.cozza.dev` (se self-hosted) col mio PC raggiungibile via Tailscale, perche' devo riprendere la sessione tmux con Claude Code.
- **US-4.3** Come Cozza, voglio una **command palette** (Ctrl/Cmd+K) con tutte le azioni cercabili, perche' lavoro da tastiera BT e voglio efficienza.
- **US-4.4** Come Cozza, voglio incollare snippet di codice nella chat con **syntax highlighting** Prism/Shiki, perche' leggo molto codice in chat.
- **US-4.5** Come Cozza, voglio un bottone "Copia" su ogni code-block della risposta AI, perche' incollo subito in vscode.dev.
- **US-4.6** Come Cozza, voglio inviare la chat corrente come prompt a Claude Code via webhook al mio PC casa (opzionale/futuro), perche' delego il long-running task al desktop.

### EPIC-5 — Glasses Optimization (Beast XR)

- **US-5.1** Come Cozza, voglio un **layout dark OLED-true** (`#000000` puro) con accenti `#FF6A00`, perche' OLED Beast a 1250 nit con vero black risparmia luminanza e batteria.
- **US-5.2** Come Cozza, voglio font minimo 18px e line-height 1.5, perche' il FOV 58° rende piccolo tutto cio' che e' fuori sweet spot.
- **US-5.3** Come Cozza, voglio una modalita' **Ultrawide 32:9** con chat a sinistra e media-launcher a destra, perche' sfrutto il 174" virtuale.
- **US-5.4** Come Cozza, voglio una modalita' **Glasses Mode** che concentra contenuto nel central 70% del viewport, perche' i bordi sono distorti.
- **US-5.5** Come Cozza, voglio shortcut tastiera BT per tutte le azioni principali (`/` chat, `m` mic, `Esc` stop), perche' non ho mouse.
- **US-5.6** Come Cozza, voglio un toggle "Reading mode" che ingrandisce il testo a 22px e aumenta padding, perche' a volte voglio leggere lunghi paper.

### EPIC-6 — Privacy & Security

- **US-6.1** Come Cozza, voglio che le API key Anthropic/OpenAI/ElevenLabs **vivano solo sul backend proxy**, perche' non voglio chiavi nel bundle JS.
- **US-6.2** Come Cozza, voglio autenticazione semplice (token bearer condiviso o passkey), perche' il proxy deve servire solo me.
- **US-6.3** Come Cozza, voglio rate limit per IP e quota mensile per provider, perche' se qualcuno trova l'endpoint non deve farmi fallire.
- **US-6.4** Come Cozza, voglio un dashboard **costi correnti del mese** per provider, perche' devo restare sotto 30 EUR.
- **US-6.5** Come Cozza, voglio CSP strict e HTTPS only, perche' uso PWA e devo minimizzare attack surface.
- **US-6.6** Come Cozza, voglio cancellare l'intera history con un bottone "Wipe all data", perche' ho diritto al reset.

### EPIC-7 — PWA & Offline

- **US-7.1** Come Cozza, voglio installare cozza-ai sulla home Android come app standalone, perche' deve sembrare nativa.
- **US-7.2** Come Cozza, voglio service worker che cachi shell, font, icone, perche' il caricamento successivo sia <500ms.
- **US-7.3** Come Cozza, voglio vedere lo stato connessione (online/offline) in topbar, perche' in mobilita' la rete fluttua.
- **US-7.4** Come Cozza, voglio compose offline (digito senza rete) con invio in coda quando torno online, perche' in metro non ho 4G.

### EPIC-8 — Observability & Feedback

- **US-8.1** Come Cozza, voglio log strutturati JSON sul backend con `requestId`, `model`, `tokens`, `latency`, perche' devo capire dove ottimizzare.
- **US-8.2** Come Cozza, voglio una pagina `/stats` interna con grafici settimanali (queries, costo, latenza media), perche' misuro il prodotto.
- **US-8.3** Come Cozza, voglio segnalare una risposta cattiva con thumbs-down + nota, perche' a fine settimana voglio capire i fail-mode.

---

## 4. Requisiti funzionali

| ID | Requisito |
|---|---|
| **RF-001** | L'app DEVE supportare almeno 2 provider AI: Anthropic (Claude Sonnet 4.5 e Haiku) e OpenAI (GPT-4o, GPT-4.1-mini). |
| **RF-002** | Lo switch del modello DEVE avvenire via dropdown nella topbar, max 1 tap, senza ricaricare la pagina. |
| **RF-003** | Le risposte AI DEVONO arrivare in streaming SSE token-by-token. |
| **RF-004** | L'utente DEVE poter interrompere lo streaming via bottone o comando vocale "stop". |
| **RF-005** | La conversation history DEVE persistere in IndexedDB con schema: `{conversationId, model, messages[], createdAt, updatedAt}`. |
| **RF-006** | L'app DEVE offrire voice input via Web Speech API (`SpeechRecognition`) configurato per `lang=it-IT`. |
| **RF-007** | L'app DEVE offrire voice output via ElevenLabs TTS streaming (modello `eleven_turbo_v2_5` o `eleven_multilingual_v2`). |
| **RF-008** | Se ElevenLabs ritorna 429/5xx o quota esaurita, l'app DEVE fare fallback a `SpeechSynthesisUtterance`. |
| **RF-009** | Il toggle Push-to-talk vs Hands-free (VAD) DEVE essere persistito in localStorage. |
| **RF-010** | Le risposte audio TTS DEVONO essere cachate in IndexedDB (max 10 entries, LRU). |
| **RF-011** | La home DEVE mostrare 5 tile media: Netflix, NOW TV, DAZN, Spotify, YouTube, ognuna con icona, label e action handler. |
| **RF-012** | Il tap su una tile DEVE aprire l'URL `https://www.netflix.com`, `https://www.nowtv.it`, `https://www.dazn.com/it-IT/home`, `https://open.spotify.com`, `https://www.youtube.com` in `target=_blank`. |
| **RF-013** | L'utente DEVE poter aggiungere shortcut custom via form (label, URL, emoji/icona). |
| **RF-014** | L'app DEVE esporre un bottone "Open VS Code" che apre `https://vscode.dev` in nuova tab. |
| **RF-015** | L'app DEVE esporre un bottone "SSH Home" configurabile con URL custom (default: redirect a Termius web o a un'istanza self-hosted di `wetty`). |
| **RF-016** | L'app DEVE supportare Cmd/Ctrl+K per aprire una command palette con fuzzy-search di tutte le azioni. |
| **RF-017** | I code-block nelle risposte DEVONO avere syntax highlighting (Shiki) e bottone "Copy". |
| **RF-018** | L'app DEVE offrire 3 layout: `mobile` (default), `glasses-16:9`, `glasses-32:9-ultrawide`. |
| **RF-019** | Il layout `glasses` DEVE limitare il contenuto al central 70% del viewport. |
| **RF-020** | L'app DEVE offrire un toggle "Reading mode" che porta il body a 22px e line-height 1.6. |
| **RF-021** | Tutte le chiamate alle API AI DEVONO passare attraverso un backend proxy (Cloudflare Workers o Node Express). |
| **RF-022** | Il backend DEVE autenticare le richieste con bearer token (env `COZZA_AUTH_TOKEN`). |
| **RF-023** | Il backend DEVE applicare rate limit: 60 req/min per IP, 5000 req/giorno totali. |
| **RF-024** | Il backend DEVE tracciare i token consumati per provider e esporre `/stats/cost` con costo stimato del mese corrente. |
| **RF-025** | L'app DEVE essere installabile come PWA (manifest, service worker, icone 192/512). |
| **RF-026** | Il service worker DEVE cachare shell, JS bundle, font, icone con strategia stale-while-revalidate. |
| **RF-027** | L'app DEVE mostrare un indicatore connessione online/offline nella topbar. |
| **RF-028** | L'utente DEVE poter cancellare tutta la storia (chat + cache TTS) tramite bottone "Wipe all data" con conferma. |

---

## 5. Requisiti non funzionali

| ID | Requisito | Soglia / Criterio |
|---|---|---|
| **RNF-001** | TTFT (Time To First Token) di risposta AI in streaming | <500ms p50, <800ms p95, misurato su Android Chrome 120 + 4G |
| **RNF-002** | Voice round-trip end-to-end (parola finita -> primo audio TTS) | <2000ms p50 |
| **RNF-003** | First Contentful Paint PWA (cold load) | <1.5s su 4G; <500ms warm load |
| **RNF-004** | Bundle JS iniziale gzipped | <180KB |
| **RNF-005** | Zero API key esposte client-side | verificato via inspect del bundle in CI |
| **RNF-006** | CORS allowlist | solo origin `https://cozza-ai.pages.dev` e `http://localhost:5173` |
| **RNF-007** | CSP | `default-src 'self'; script-src 'self'; connect-src 'self' api.anthropic.com api.openai.com api.elevenlabs.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'` |
| **RNF-008** | Rate limit backend | 60 req/min per IP, return 429 con `Retry-After` |
| **RNF-009** | Contrasto WCAG | AAA su body text (ratio >=7:1) |
| **RNF-010** | Font scalable | rem-based, supporto user zoom fino a 200% senza overflow orizzontale |
| **RNF-011** | Compatibilita' browser | Android Chrome 120+, Edge 120+, Desktop Chrome/Edge 120+ |
| **RNF-012** | Costo runtime mensile | <30 EUR (stimato: 8 EUR Anthropic + 8 EUR OpenAI + 12 EUR ElevenLabs Starter + 0 EUR Cloudflare Workers free tier) |
| **RNF-013** | Reliability ElevenLabs | fallback automatico a Web Speech entro 1500ms in caso di errore o timeout |
| **RNF-014** | Logging | strutturato JSON, livelli error/warn/info/debug, mai logga API key, password o full request body |
| **RNF-015** | Privacy | nessun tracker analytics terzo (Google Analytics, Hotjar, ecc.); solo logs interni |
| **RNF-016** | Disponibilita' | best effort, target 99% (uso personale, no SLA) |
| **RNF-017** | Backup history | export JSON manuale via bottone "Export conversations" |
| **RNF-018** | Internazionalizzazione | UI in italiano, prompt di sistema in italiano, code/snippet in inglese |
| **RNF-019** | Accessibilita' input | tutti i bottoni con `aria-label`, keyboard-navigable, focus ring visibile |
| **RNF-020** | OLED-friendly dark mode | background `#000`, evitare large white surfaces, accenti saturi `#FF6A00`/`#0EA5E9` |

---

## 6. Acceptance Criteria (user stories chiave)

### AC US-1.3 — Streaming SSE

- **Given** una conversazione attiva con modello Claude Sonnet 4.5
- **When** l'utente invia un prompt di 100 token
- **Then** il primo token DEVE comparire in UI entro 500ms (TTFT)
- **And** i token successivi DEVONO essere renderizzati incrementalmente senza re-render dell'intera lista
- **And** un bottone "Stop" DEVE essere visibile finche' lo stream non termina

### AC US-2.2 — TTS ElevenLabs

- **Given** una risposta testuale di 200 caratteri italiana ricevuta
- **When** l'utente attiva lettura vocale (auto se hands-free, bottone se push-to-talk)
- **Then** la richiesta a ElevenLabs DEVE partire entro 100ms dalla fine dello streaming testo
- **And** il primo chunk audio DEVE essere riprodotto entro 1500ms
- **And** il file audio completo DEVE essere salvato in IndexedDB cache con chiave `hash(testo+voiceId)`

### AC US-2.3 — Fallback voice

- **Given** quota ElevenLabs mensile esaurita (HTTP 401 con `quota_exceeded`)
- **When** l'utente richiede TTS
- **Then** il backend DEVE rispondere con `{fallback: true}` entro 200ms
- **And** il client DEVE invocare `SpeechSynthesisUtterance` con `lang=it-IT` voce default
- **And** un toast DEVE notificare "Modalita' voce di sistema attiva"

### AC US-3.3 — Comando vocale "apri X"

- **Given** voice input attivo e VAD funzionante
- **When** l'utente dice "apri Netflix"
- **Then** il client DEVE riconoscere il pattern `apri (netflix|now|dazn|spotify|youtube)` localmente (no chiamata AI)
- **And** DEVE aprire l'URL corrispondente in nuova tab entro 200ms dalla fine della frase

### AC US-5.3 — Layout 32:9

- **Given** viewport con aspect ratio >= 21:9 (rilevato via `matchMedia`)
- **When** l'utente attiva manualmente "Ultrawide" o si autorileva
- **Then** il layout DEVE mostrare chat (50% width) a sinistra e launcher+stats (50% width) a destra
- **And** il padding interno DEVE essere 4rem ai lati per evitare distorsione bordi Beast

### AC US-6.1 — Niente API key client

- **Given** il bundle JS minificato in produzione
- **When** si esegue `grep -E "(sk-|claude-)" dist/assets/*.js`
- **Then** zero match
- **And** la CI DEVE fallire la build se il check trova match

### AC US-7.1 — Installazione PWA

- **Given** Android Chrome 120 su mobile
- **When** l'utente visita `https://cozza-ai.pages.dev` per la prima volta
- **Then** Chrome DEVE mostrare il prompt "Aggiungi a schermata iniziale" entro 30s di interazione
- **And** dopo install l'icona DEVE aprire l'app in modalita' standalone (no browser chrome)

---

## 7. Scoping in 3 release

### MVP — 2 settimane (sprint 1-2)

**In scope (lista esatta US):** US-1.1, US-1.2, US-1.3, US-1.5, US-2.1, US-2.2, US-2.3, US-3.1, US-3.2, US-6.1, US-6.2, US-6.5, US-7.1, US-7.2.

In sintesi: chat funzionante con switch Claude/OpenAI in streaming, voice input italiano, voice output ElevenLabs con fallback, 5 tile media-launcher cliccabili, backend proxy Cloudflare Workers con auth bearer, PWA installabile, layout mobile-first (no glasses optimization ancora).

**Out of scope MVP:** ultrawide layout, vscode.dev embed, SSH, command palette, custom shortcuts, history persistente, dashboard costi, comandi vocali per launcher, riordino drag-drop.

### V1 Glasses-Ready — +4 settimane (sprint 3-6)

Aggiunge: US-1.4 (history IndexedDB), US-1.6 (preset prompt), US-2.4 (toggle PTT/hands-free), US-2.5 (cache TTS), US-2.6 (selezione voce), US-3.3 (voice launcher), US-3.4 (riordino), US-4.1 (vscode.dev), US-4.5 (copy code), US-5.1, US-5.2, US-5.3, US-5.4, US-5.5 (full glasses optimization), US-6.3 (rate limit), US-6.4 (dashboard costi), US-7.3 (online indicator), US-8.1 (logs).

In sintesi: l'app diventa **degna degli occhiali Beast** con layout 32:9, dark mode OLED, font scalabili, voice hands-free, history persistente, dashboard costi.

### V2 Power User — +8 settimane (sprint 7-14)

Aggiunge: US-2.4 VAD avanzato, US-3.5 custom shortcuts, US-4.2 SSH client, US-4.3 command palette completa, US-4.4 syntax highlight Shiki, US-4.6 webhook a Claude Code casa, US-5.6 Reading mode, US-6.6 wipe data, US-7.4 offline compose+queue, US-8.2 stats UI, US-8.3 feedback thumbs.

In sintesi: cozza-ai diventa il **terminale AI completo** per Cozza, con SSH integrato, command palette, offline-first, observability completa.

---

## 8. KPI e Success Metrics

| KPI | Target | Frequenza misura | Strumento |
|---|---|---|---|
| **K-1 Voice round-trip latency** | <2s p50 | settimanale | log backend `requestId.totalLatency` |
| **K-2 Query/giorno** | >=15 (segno di adoption reale) | giornaliera | aggregato logs |
| **K-3 % voice vs touch** | >=40% query in voice | settimanale | flag `inputMode` nel log |
| **K-4 Costo API mensile reale** | <=30 EUR | mensile | `/stats/cost` endpoint backend |
| **K-5 Retention settimanale** | >=5 giorni/settimana di uso | settimanale | conteggio giorni con almeno 1 query |
| **K-6 Tempo per accedere a Spotify dagli occhiali** | <3s da PWA aperta | manuale weekly | crono manuale |
| **K-7 Errori per sessione** | <=1 errore (5xx o crash) ogni 50 query | settimanale | log backend filtro level=error |
| **K-8 NPS personale settimanale** | >=8/10 entro V1 | settimanale | self-rating in `/stats` |
| **K-9 TTFT p50** | <500ms | continuo | log backend |
| **K-10 PWA install -> ritorno entro 24h** | 100% (1 utente) | giornaliera | service worker activate event |

---

## 9. Rischi business

| ID | Rischio | Probabilita' | Impatto | Mitigazione |
|---|---|---|---|---|
| **R-1** | Costo ElevenLabs sopra budget (es. uso intensivo TTS hands-free) | Media | Alto | Cache aggressiva (RF-010), quota mensile hard-stop a 25k caratteri (piano Starter), fallback Web Speech dopo soglia 80% |
| **R-2** | Web Speech API italiano qualita' scarsa o non supportato su tutti gli Android | Media | Medio | Test su 3 device fisici prima MVP; in fallback usare API Whisper-mini o `whisper.cpp` server-side (costo aggiuntivo ~3 EUR/mese) |
| **R-3** | Viture Beast XR non compatibile con il telefono attuale di Cozza (DP Alt Mode mancante) | Bassa | Alto | Verificare specs telefono prima dell'acquisto Beast; in alternativa acquistare Viture Pro Neckband (199 USD) come host Android dedicato |
| **R-4** | Rate limit API Anthropic/OpenAI che bloccano una sessione lunga | Bassa | Medio | Backoff esponenziale, retry max 3, switch automatico al provider alternativo se uno fallisce |
| **R-5** | API key proxy compromessa (qualcuno scopre l'endpoint pubblico) | Bassa | Alto | Bearer token rotabile in env, rate limit per IP (RNF-008), CSP+CORS strict, alert se costo giornaliero supera 2 EUR |
| **R-6** | iframe `vscode.dev` bloccato da `X-Frame-Options` di Microsoft | Alta | Medio | Fallback `target=_blank`, gia' previsto in RF-014 |
| **R-7** | PWA su iOS Safari limitata (Cozza usa Android, ma persone secondarie no) | Media | Basso | Documentare incompatibilita' iOS in V1; valutare TWA o native shell in V3 se domanda emerge |
| **R-8** | Beast XR ritardo di consegna o defective | Media | Medio | Sviluppare MVP testabile su monitor 16:9 1200p simulato; layout glasses validato via Chrome DevTools device emulation |
| **R-9** | Tailscale down o SSH endpoint irraggiungibile da rete pubblica | Bassa | Basso | SSH e' V2, non MVP; documentare runbook con `ssh -J jump.cozza.dev` come fallback |
| **R-10** | Cozza perde interesse / progetto abbandonato dopo MVP | Media | Medio | Scoping ridotto MVP a 2 settimane = quick win; KPI K-5 (retention) misura il segnale di abbandono presto |

---

## 10. Decisioni assunte (motivate)

| Decisione | Motivazione |
|---|---|
| **Cloudflare Workers** invece di Node Express per il proxy | Free tier 100k req/giorno coprono ampiamente l'uso, deploy in 1 comando, edge globale = TTFT migliore, niente server da mantenere |
| **Bearer token statico** invece di OAuth/passkey per MVP | Cozza e' singolo utente, OAuth e' over-engineering. Token in env, rotabile, sufficiente |
| **IndexedDB** invece di Postgres remoto per history | Privacy (data resta su device), zero costi, riduce dipendenze. Export JSON come backup |
| **ElevenLabs Starter (5 USD/mese, 30k char)** invece di Creator | 30k caratteri/mese sufficienti se cache funziona; upgrade se K-4 mostra bisogno |
| **Vite + React** invece di Next.js | PWA semplice, no SSR necessario, bundle piu' piccolo, build piu' veloce |
| **TailwindCSS** invece di CSS modules | Velocita' di iterazione su layout glasses, design tokens via config |
| **Web Speech API** invece di Whisper API per voice input MVP | Zero costi, latenza locale, italiano supportato. Whisper come fallback solo se K-1 fallisce |
| **target=_blank** invece di iframe per launcher media | Netflix/Spotify bloccano iframe via CSP; il _blank e' l'esperienza piu' affidabile |

---

*Documento prodotto secondo il framework agency in `CLAUDE.md`. Prossimo step: handoff a `solution-architect` per ADR e architettura, poi a `project-orchestrator` per breakdown sprint-by-sprint.*
