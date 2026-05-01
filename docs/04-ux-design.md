# 04 — UX/UI Design — cozza-ai

> Documento di design per **cozza-ai**, la PWA personale di Cozza pensata per essere usata principalmente attraverso gli smart glasses **Viture Beast XR**. Autore: `ux-ui-designer`. Versione 1.0 — 2026-05-01.

---

## 1. Premessa di design

cozza-ai non è un'app per telefono che "funziona anche sugli occhiali". E' un'app pensata **prima** per gli occhiali e poi adattata al telefono. Questa inversione cambia tutte le decisioni di design.

### 1.1 Caratteristiche peculiari del Viture Beast XR

| Caratteristica | Valore | Implicazione di design |
|---|---|---|
| Schermo virtuale percepito | 174" | Densità informativa bassa, contenuti grandi |
| FOV reale | 58° | Solo il 70% centrale e' "comodo" da fissare |
| Display | Sony micro-OLED 1200p/occhio | Neri assoluti = il fondo nero non costa batteria |
| Luminosita' | 1250 nit | Ottimo anche in semi-luce, ma evitare bianchi pieni |
| 3DoF VisionPair | Spatial Anchor / Smooth Follow | Layout deve funzionare sia "ancorato" sia "che segue" |
| Modalita' Ultrawide | 32:9 | Layout multi-pane reale, non solo split forzato |
| Connessione | USB-C DP Alt Mode al telefono | Latenza bassa, ma il telefono e' sempre "fisicamente" coinvolto |

### 1.2 Cinque principi guida

1. **Il sweet spot prima di tutto** — tutto cio' che e' azione, lettura o decisione vive nel 70% centrale del viewport. I bordi sono per indicatori passivi.
2. **Voice as default, touch as backup** — l'interfaccia parte sempre presupponendo che le mani siano occupate. Touch e tastiera sono fallback equivalenti, mai privilegiati.
3. **Nero e' la nostra tela** — `#000000` puro come background dappertutto: pixel spenti = batteria salvata + contrasto cinematografico + zero glow nelle scene scure.
4. **Tipografia generosa** — minimo 18px per body. Lo schermo e' grande, ma a 2-3 metri di distanza percepita: il testo deve respirare.
5. **Niente UI nei bordi** — il 15% perimetrale e' "no-man's land". Zero CTA, zero contenuto leggibile. Solo glyph piccoli e indicatori di stato.

---

## 2. Layout & Sweet Spot

### 2.1 Definizione del sweet spot 58°

Il FOV reale del Beast e' 58 gradi, ma la zona dove l'occhio si muove **senza ruotare la testa** e' circa il 70% centrale. Tutto il contenuto primario (chat, code editor, video player, CTA) deve stare li' dentro.

```
+================================================================+
|  [STATUS]                                          [CONNESS.]  |  <- 7.5% top: status bar
|----------------------------------------------------------------|
|  .                                                          .  |
|  .         ###############################              .  |
|  .         #                             #              .  |  <- 15% laterale:
|  .         #     SWEET SPOT - 70%        #              .  |     no critical UI
|  .         #     CONTENUTO PRIMARIO      #              .  |
|  .         #     CHAT / CODE / VIDEO     #              .  |
|  .         #                             #              .  |
|  .         #                             #              .  |
|  .         ###############################              .  |
|  .                                                          .  |
|----------------------------------------------------------------|
|  [HINT]                  [VOICE BTN]              [TIMESTAMP] |  <- 7.5% bottom
+================================================================+
   <----------------------- 100% width ------------------------->
   ^15%^  <----------- 70% sweet zone ------------>  ^15%^
```

### 2.2 Comportamento responsive

| Breakpoint | Aspect | Layout |
|---|---|---|
| `<768px` | 9:16 portrait phone | Single column, voice modal full-screen, chat verticale |
| `768-1280px` | 16:9 landscape / tablet | Chat + sidebar collassabile |
| `1280-2560px` | 16:9 desktop / Beast standard | 3 colonne (apps / chat / context) |
| `>=2560px (32:9)` | Beast Ultrawide | Multi-pane stabile: editor + chat + terminale |

L'app legge `window.matchMedia('(min-aspect-ratio: 21/9)')` per attivare il **GlassesUltrawideLayout**.

---

## 3. Design System

### 3.1 Color palette (OLED-first)

Su display OLED il nero puro `#000000` e' un pixel spento: nessuna emissione, nessun consumo. Il design e' costruito per sfruttare questo come superficie principale.

| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#000000` | Background app, modal, splash |
| `--bg-surface-1` | `#0A0A0A` | Card primarie, chat bubble assistant |
| `--bg-surface-2` | `#141414` | Card secondarie, input fields, dropdown |
| `--bg-surface-3` | `#1F1F1F` | Hover state, selected state |
| `--border-subtle` | `#2A2A2A` | Bordi 1px tra elementi |
| `--border-strong` | `#3D3D3D` | Bordi focus, active |
| `--accent-primary` | `#00E5FF` | Cozza brand: ciano elettrico, voice active, link, CTA primaria |
| `--accent-primary-dim` | `#0099B3` | Hover, stati secondari del primary |
| `--accent-secondary` | `#B8FF5C` | Verde lime, model "auto", success secondari |
| `--success` | `#00FF88` | Conferme, completamento |
| `--warning` | `#FFB300` | Warning, costi prossimi al limite |
| `--error` | `#FF3B5C` | Errori, distruttivo |
| `--info` | `#7C9CFF` | Info neutra, hint |
| `--text-primary` | `#F5F5F5` | Body principale, titoli |
| `--text-secondary` | `#A0A0A0` | Metadata, label, timestamp |
| `--text-muted` | `#6B6B6B` | Disabled, placeholder |
| `--text-on-accent` | `#000000` | Testo su pulsanti accent |

**Scelta del brand color**: `#00E5FF` (ciano elettrico) e' stato preferito a un verde mentolato perche':
- Massimo contrasto su nero OLED (rapporto 13.4:1, AAA)
- "Tech-spaziale" coerente con l'estetica AR
- Riconoscibile a colpo d'occhio anche in bordo viewport

### 3.2 Typography

**Font primario**: **Geist** (Vercel, 2024). Motivazione:
- Disegnato per leggibilita' a schermo, X-height alta
- Contrasto modulato che regge bene sul micro-OLED
- Open source, peso variabile, performance ottime in PWA

**Font monospace**: **Geist Mono** per coerenza visiva con il primario (chat, code blocks, terminale).

**Scala tipografica**:

| Token | Size | Line-height | Letter-spacing | Uso |
|---|---|---|---|---|
| `display` | 48px / 3rem | 1.1 | -0.02em | Splash, onboarding hero |
| `h1` | 36px / 2.25rem | 1.25 | -0.01em | Page title, voice transcript live |
| `h2` | 28px / 1.75rem | 1.3 | -0.005em | Section heading |
| `h3` | 22px / 1.375rem | 1.35 | 0 | Card heading, chat speaker |
| `body-lg` | 20px / 1.25rem | 1.6 | 0 | Reading mode, risposta principale |
| `body` | 18px / 1.125rem | 1.6 | 0 | Default body, chat messages |
| `caption` | 14px / 0.875rem | 1.4 | 0.01em | Timestamp, metadata, hint |
| `mono` | 16px / 1rem | 1.5 | 0 | Code blocks |

Niente sotto i 14px. Il body **non** scende mai sotto 18px. La caption 14px e' riservata a metadata di supporto, mai a testo principale.

### 3.3 Spacing scale

Base unit **8px**. Scala: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`.

| Token | Value | Uso tipico |
|---|---|---|
| `space-0.5` | 4px | Gap interno icona-label |
| `space-1` | 8px | Padding stretto |
| `space-1.5` | 12px | Padding compact button |
| `space-2` | 16px | Padding default |
| `space-3` | 24px | Padding card, gap tra elementi |
| `space-4` | 32px | Margine tra sezioni |
| `space-6` | 48px | Margine top page |
| `space-8` | 64px | Spaziatura major |

**Touch target minimo**: 48x48 px (anche se input primario e' voce). Su Beast, dove l'utente potrebbe usare il telefono come trackpad indiretto, target piccoli sono ingestibili.

### 3.4 Componenti core

#### `ChatBubble`

Bubble per messaggi chat. Varianti `user` (allineato destra) / `assistant` (sinistra) / `system` (centro, neutro).

```tsx
interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;       // markdown supportato in reading mode
  timestamp?: Date;
  speaker?: 'claude' | 'gpt' | 'auto';
  isStreaming?: boolean;
  isSpeaking?: boolean;  // TTS attivo su questa bubble
}

<ChatBubble
  role="assistant"
  content="Ciao Cozza, sono qui."
  speaker="claude"
  isSpeaking
/>
```

Stati:
- **default**: bg `--bg-surface-1`, padding 16/24
- **streaming**: cursore blink `--accent-primary`
- **speaking**: bordo sinistro 3px `--accent-primary`, glow soft
- **error**: bordo `--error`, icona warning

#### `VoiceButton`

CTA principale, sempre visibile in basso al centro. Press-and-hold per push-to-talk, tap per modalita' continuous.

```tsx
type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

<VoiceButton state="listening" onPress={...} onRelease={...} />
```

Stati visivi:
- `idle`: cerchio 64px, bg `--bg-surface-2`, icona mic `--text-secondary`
- `listening`: pulse animato, ring esterno `--accent-primary`, scale 1.1
- `processing`: orbital loader (3 dot rotanti) `--accent-primary`
- `speaking`: waveform animato, bg `--accent-primary` 20% opacity

#### `AppLauncherTile`

Tile grandi per il media launcher.

```tsx
<AppLauncherTile
  icon="netflix"
  label="Netflix"
  bgImage="/tiles/netflix.jpg"
  onLaunch={() => openApp('netflix')}
/>
```

Dimensioni: 280x180 px (16:9), bordo radius 16px, hover scale 1.03 + glow `--accent-primary`.

#### `ModelSelector`

Segmented control orizzontale: `Claude | GPT | Auto`. Larghezza fissa 320px. Il segmento attivo ha bg `--accent-primary` e testo `--text-on-accent`.

#### `CostMeter`

Barra orizzontale piccola (height 4px, width 200px) nello status bar. Riempimento gradiente `--success` -> `--warning` -> `--error` in base a % del budget mensile.

```
Costo mese:  [##########----------]  €4.20 / €15.00
```

#### `StatusBar`

Top bar fissa, height 48px. Contenuto:
- Sinistra: model selector compatto, costo mensile
- Centro: stato connessione PC (icon dot verde/rosso)
- Destra: batteria Beast, batteria phone, ora

#### `CommandPalette`

Cmd+K / Ctrl+K stile. Overlay full-width 720px, posizionato a 25% dall'alto (dentro sweet spot). Fuzzy search su comandi, app, conversazioni recenti, file.

```
+--------------------------------------------------+
|  >  scrivi una mail in italiano per...           |
|--------------------------------------------------|
|  ACTIONS                                          |
|  > Nuova chat                            [N]      |
|  > Apri Reading Mode                     [R]      |
|  > Cambia modello (Claude)               [M]      |
|--------------------------------------------------|
|  RECENT                                           |
|  > Discussione architettura cozza-ai (ieri)       |
+--------------------------------------------------+
```

---

## 4. Wireframes

### 4.1 Home Dashboard

```
+================================================================+
| [Claude v]  EUR 4.20/15  [PC: ON]            22:14  [BAT 87%] |
|----------------------------------------------------------------|
|                                                                 |
|   APPS              CHAT                          CONTEXT       |
|   +-----+    +-----------------------+      +----------------+ |
|   |Netfl|    | A: Buongiorno Cozza,  |      | Sessione:      | |
|   +-----+    |    cosa serve oggi?   |      | Coding         | |
|   +-----+    +-----------------------+      |                | |
|   |DAZN |    | U: Apri il progetto   |      | Token: 1.2k    | |
|   +-----+    |    cozza-ai           |      | Modello: Claude| |
|   +-----+    +-----------------------+      | Costo: 0.04E   | |
|   |Spoti|    | A: Apro vscode.dev... |      |                | |
|   +-----+    +-----------------------+      | [Cambia ctx]   | |
|   +-----+                                   +----------------+ |
|   |YouTu|                                                       |
|   +-----+                                                       |
|                                                                 |
|----------------------------------------------------------------|
|  Cmd+K per comandi              ((  MIC  ))           [Help]   |
+================================================================+
```

### 4.2 Voice Modal Full-Screen

Quando attivato (push-to-talk o wake word "Hey Cozza"), tutto il resto si dissolve.

```
+================================================================+
|                                            [X chiudi]           |
|                                                                 |
|                                                                 |
|                                                                 |
|              ~  ~~  ~~~~~  ~~~~~~~  ~~~~~  ~~  ~                |
|             ~~~ ~~~ ~~~~~ ~~~~~~~~~ ~~~~~ ~~~ ~~                |
|              ~  ~~  ~~~~~  ~~~~~~~  ~~~~~  ~~  ~                |
|                                                                 |
|                                                                 |
|        "Apri il progetto cozza-ai e mostra ..."                 |
|                                                                 |
|                                                                 |
|                                                                 |
|        Suggerimenti:                                            |
|        > "Continua quello che stavamo facendo"                  |
|        > "Riassumi la chat di ieri"                             |
|        > "Apri Spotify"                                         |
|                                                                 |
|                                                                 |
|                       (( ASCOLTO ))                              |
+================================================================+
```

### 4.3 Coding View (Ultrawide 32:9)

```
+==========================================================================================+
| [Claude] [Modello: Sonnet]   ws: cozza-ai/src/        Connesso a PC                    Bat|
|------------------------------------------------------------------------------------------|
|                                                       |                                   |
|   VSCODE.DEV                                          |   AI CHAT                         |
|   +--------------------------------------------------+|   +-----------------------------+ |
|   | src/components/ChatBubble.tsx                    ||   | U: refactor questo file     | |
|   |                                                  ||   +-----------------------------+ |
|   | 1  import { FC } from 'react';                   ||   | A: Ecco la versione...      | |
|   | 2                                                ||   |                             | |
|   | 3  export const ChatBubble: FC = ({...}) => {    ||   | ```tsx                      | |
|   | 4    return (                                    ||   | export const ChatBubble...  | |
|   | 5      <div className="bubble">                  ||   | ```                         | |
|   | 6        ...                                     ||   |                             | |
|   | ...                                              ||   | Vuoi che applichi il diff?  | |
|   |                                                  ||   |                             | |
|   |                                                  ||   | [Applica]   [Annulla]       | |
|   +--------------------------------------------------+|   +-----------------------------+ |
|                                                       |                                   |
|------------------------------------------------------------------------------------------|
|  TERMINAL                                                                                 |
|  $ npm run dev                                                                             |
|  > vite v5  ready in 312 ms                                                                |
+==========================================================================================+
```

### 4.4 Media Launcher

```
+================================================================+
|  Media                                       22:14  [BAT 87%]  |
|----------------------------------------------------------------|
|                                                                 |
|    +------------+     +------------+     +------------+         |
|    |            |     |            |     |            |         |
|    |  NETFLIX   |     |    NOW     |     |    DAZN    |         |
|    |            |     |            |     |            |         |
|    +------------+     +------------+     +------------+         |
|                                                                 |
|    +------------+     +------------+     +------------+         |
|    |            |     |            |     |            |         |
|    |  SPOTIFY   |     |  YOUTUBE   |     |  PRIME     |         |
|    |            |     |            |     |            |         |
|    +------------+     +------------+     +------------+         |
|                                                                 |
|----------------------------------------------------------------|
|  "Metti un film" -> chiedi all'AI            ((  MIC  ))        |
+================================================================+
```

### 4.5 Reading Mode

Quando l'utente dice "leggimi" o apre risposta lunga, il layout si compatta in colonna unica centrata.

```
+================================================================+
|  Reading mode                              [X esci] [Aa+]      |
|----------------------------------------------------------------|
|                                                                 |
|         +--------------------------------------------+          |
|         |                                            |          |
|         |  # Architettura di cozza-ai                |          |
|         |                                            |          |
|         |  cozza-ai e' una PWA che si comporta       |          |
|         |  come un cockpit AI personale, pensata     |          |
|         |  per essere usata principalmente attra-    |          |
|         |  verso gli smart glasses Viture Beast XR.  |          |
|         |                                            |          |
|         |  ## Componenti principali                  |          |
|         |                                            |          |
|         |  - Voice loop (Whisper -> LLM -> TTS)      |          |
|         |  - Chat surface                            |          |
|         |  - App launcher                            |          |
|         |                                            |          |
|         |       max-width 720px, font 20px, lh 1.7   |          |
|         +--------------------------------------------+          |
|                                                                 |
|----------------------------------------------------------------|
|  Scroll giu' o "vai avanti"          ((  MIC  ))                |
+================================================================+
```

### 4.6 Settings

```
+================================================================+
|  Impostazioni                              [X chiudi]           |
|----------------------------------------------------------------|
|                                                                 |
|  +- API Keys -----------------------+                           |
|  | Anthropic     [********ab12]  v  |                           |
|  | OpenAI        [********cd34]  v  |                           |
|  | ElevenLabs    [********ef56]  v  |                           |
|  | [Come configurare il proxy?]     |                           |
|  +----------------------------------+                           |
|                                                                 |
|  +- Voice --------------------------+                           |
|  | Voce TTS:    [ Rachel IT    v ]  |                           |
|  | Lingua STT:  [ Italiano     v ]  |                           |
|  | Wake word:   [x] "Hey Cozza"     |                           |
|  +----------------------------------+                           |
|                                                                 |
|  +- Modelli ------------------------+                           |
|  | Default chat:    [ Claude    v ] |                           |
|  | Default coding:  [ Claude    v ] |                           |
|  +----------------------------------+                           |
|                                                                 |
|  +- Glasses Mode -------------------+                           |
|  | [x] Attiva ottimizzazioni Beast  |                           |
|  | Ancoraggio: ( ) Spatial          |                           |
|  |             (o) Smooth Follow    |                           |
|  |             ( ) 0DoF             |                           |
|  +----------------------------------+                           |
|                                                                 |
|  +- Privacy / Accessibility --------+                           |
|  | [x] Subtitle live durante TTS    |                           |
|  | [x] Reduced motion (system)      |                           |
|  | Font scale: ( ) 100% (o) 125%    |                           |
|  +----------------------------------+                           |
+================================================================+
```

---

## 5. Voice-first interaction patterns

### 5.1 Wake word vs button-press

**Soluzione adottata**: entrambi, configurabili.

- **Wake word "Hey Cozza"** via Picovoice Porcupine (modello custom on-device, zero rete, ~100kB). Default ON.
- **Push-to-talk** via long-press (>=300ms) di qualunque area del viewport non-interattiva, oppure tasto del Pro Neckband Viture, oppure spazio sulla tastiera BT.

Il wake word e' opt-in nelle Settings (alcuni utenti preferiscono privacy assoluta).

### 5.2 Flusso voice loop

```
[utente parla] -> wake/PTT detection
              -> VoiceModal aperta + animazione listening
              -> Whisper STT streaming (transcript live)
              -> end-of-speech detection (1.5s silence)
              -> processing state (orbital loader)
              -> LLM stream tokens
              -> TTS frase per frase (ElevenLabs)
              -> highlight della frase TTS in corso nella ChatBubble
              -> end -> ritorno a idle
```

### 5.3 Visual feedback per stato

| Stato | Visual |
|---|---|
| `idle` | Mic icon statica, `--text-secondary` |
| `listening` | Waveform reattiva al volume, glow `--accent-primary` pulsante |
| `processing` | Orbital loader 3 dot, fade testo "elaboro..." |
| `speaking` | Bubble con bordo sinistro `--accent-primary` + sottolineatura mobile sulla frase TTS in corso |

### 5.4 Barge-in

Mentre l'AI sta parlando, se l'utente inizia a parlare (volume > soglia per >250ms):
1. TTS si interrompe immediatamente (fade-out 100ms)
2. STT riparte
3. La risposta tronca viene marcata come `[interrotto]` nel log

### 5.5 Escape rapidi

- **Doppio tap-temple del Beast** (gesto nativo) → chiude voice modal
- **Esc** su tastiera BT → idem
- **"Annulla" / "Stop"** vocale → idem
- **3 secondi senza parlare in listening** → torna a idle senza errore

---

## 6. Multi-input switching

| Input primario | Layout attivato | Tono risposta AI | Componenti chiave |
|---|---|---|---|
| Voice (no kb, no touch) | VoiceModal full-screen | Conciso, no markdown, TTS auto, max 80 parole | Waveform, transcript live, suggerimenti |
| Touch only (phone) | Mobile portrait | Medio, markdown leggero | Bottoni 48px+, no shortcut |
| Touch + tastiera BT | Desktop-like | Completo, markdown ricco | Cmd+K palette, shortcut visibili |
| Beast 32:9 | UltrawideLayout | Completo + multi-pane awareness | Sidebar permanenti, editor + chat |

L'app rileva la presenza di tastiera BT via `navigator.keyboard` (sperimentale) + heuristic su eventi `keydown` non da on-screen keyboard, e adatta il layout in `<300ms`.

---

## 7. Glasses-specific UX

### 7.1 Sweet spot enforcement

Il **15% perimetrale** e' off-limits per contenuto critico. Implementazione tramite CSS custom property:

```css
:root {
  --safe-area-glasses: 7.5%;
}

.app-shell {
  padding: var(--safe-area-glasses);
}

@media (display-mode: glasses) {
  /* tutto il primary content e' dentro il sweet spot */
  .primary-content { max-width: 70%; margin-inline: auto; }
}
```

### 7.2 Modalita' di ancoraggio 3DoF

| Modalita' | Quando usare | Comportamento app |
|---|---|---|
| **Spatial Anchor** | Sessione lunga seduta (coding, reading) | App "fissa" nello spazio. L'utente gira la testa per consultare zone diverse: chat al centro, settings ruotando 30° a destra, status sopra. |
| **Smooth Follow** | Video, scroll lungo | App segue lo sguardo con lag ~150ms. Meno faticoso per gli occhi su contenuti consumistici. |
| **0DoF / Body-locked** | In movimento (camminata, treno) | App fissa al display. Niente parallax. Ideale per leggere brevi notifiche o usare voce mentre si cammina. |

L'utente sceglie la modalita' nelle Settings, ma cozza-ai propone un default contestuale (es. video → Smooth Follow automatico).

### 7.3 Quadranti

- **Top-right**: status sempre li' (battery, network, AI active). Mai informazioni che richiedono lettura prolungata.
- **Bottom-center**: VoiceButton sempre li'. Posizione "muscolare" anche al buio.
- **Centro**: contenuto.
- **Bordi**: glyph piccoli per hint contestuali (es. "→ Cmd+K"), max 14px.

### 7.4 Animazioni

Su un display indossato, ogni movimento e' amplificato dalla percezione vestibolare. Regole:

- **Niente flash**: transizioni opacity sotto 200ms o sopra 600ms (mai 300-500ms che sono "sussulto").
- **Niente shake**: zero animazioni con jitter sull'asse X/Y.
- **Easing morbido**: `cubic-bezier(0.4, 0, 0.2, 1)` standard, mai bouncy.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disattiva ogni transizione non funzionale.

---

## 8. Accessibility

### 8.1 Contrasto

Tutto il body text rispetta **AAA (>=7:1)** su nero:
- `#F5F5F5` su `#000000` = 19.5:1 ✓
- `#A0A0A0` su `#000000` = 9.8:1 ✓ (AAA)
- `#6B6B6B` su `#000000` = 4.6:1 ✗ → solo per testo decorativo, mai contenuto

### 8.2 Font scaling

Toggle in Settings: `100% / 125% / 150%`. Implementato come `--font-scale: 1` su `:root`, tutte le size in `calc(var(--size) * var(--font-scale))`.

### 8.3 Voice come accessibilita'

L'interfaccia voice-first e' nativamente inclusiva per:
- Dyslexia (no lettura forzata)
- Ipovisione (TTS per output)
- Mobility (no touch richiesto)

### 8.4 Subtitle live

Durante TTS, i subtitle compaiono nel sweet spot bottom (line-height 1.4, 22px) per chi:
- Ha speaker open-ear in ambiente rumoroso
- Ha hearing impairment
- Vuole rileggere

Toggle in Settings, default ON quando `glasses-mode` attivo.

### 8.5 Reduced motion & keyboard nav

- `prefers-reduced-motion`: disabilita pulse, fade lunghi, shimmer.
- Tab order chiaro, focus ring sempre visibile (`outline: 2px solid var(--accent-primary)`).
- Skip-to-content come primo focusable element.

---

## 9. Branding

### 9.1 Identita'

- **Nome**: cozza-ai (sempre minuscolo, hyphen, monospaziato nel logo)
- **Personality**: minimale, premium, "personal AI cockpit", italiano elegante
- **Mood**: notturno, spaziale, focalizzato. Niente emoji nelle UI critiche.

### 9.2 Logo concept

Proposta: **monogramma `ca` in lowercase**, dentro un cerchio sottile (1.5px stroke) `--accent-primary`. La `c` e la `a` condividono uno stelo verticale: simboleggia la fusione tra l'utente (Cozza) e l'AI. Il cerchio richiama la lente del visore.

Variante secondaria: la `c` di cozza disegnata come iride aperta (semicerchio + punto centrale = pupilla) — il "tuo occhio aumentato".

### 9.3 Tagline (3 proposte)

1. **"Il tuo cockpit AI personale."** — italiano, descrittivo, premium
2. **"AI on your face."** — inglese, ironico, hardware-first
3. **"AI personale per l'era spaziale."** — evocativo, italiano, futurista

Raccomandazione: **#1 in italiano per il prodotto**, #2 come claim secondario nei contesti tech-internazionali.

### 9.4 Tono di voce

- **Amichevole-tecnico**: "Apro vscode.dev e ti collego al repo." (non "Sto avviando l'integrazione")
- **Mai infantile**: niente "yay", "ecco fatto!", emoji nelle risposte di sistema
- **Mai burocratico**: niente "Si prega di", "Provveda a"
- **In italiano scorrevole**: "ti", "tu" (mai "Lei"), frasi corte, soggetto-verbo-oggetto

---

## 10. Microcopy raccomandata (italiano)

| Contesto | Stringa |
|---|---|
| Voice prompt iniziale (idle) | "Dimmi pure." |
| Voice listening | "Ti ascolto." |
| Voice processing | "Un attimo..." |
| Voice no input timeout | "Non ho sentito. Riprova quando vuoi." |
| Wake word abilitato hint | "Dimmi 'Hey Cozza' o tieni premuto." |
| Errore connessione | "Non riesco a raggiungere il server. Controlla la connessione." |
| Errore API key mancante | "Configura prima la tua chiave API in Impostazioni." |
| Conferma azione distruttiva | "Sicuro? Questa cosa non si annulla." |
| Empty state chat | "Iniziamo. Cosa serve?" |
| Empty state apps | "Nessuna app collegata. Aggiungine una dalle Impostazioni." |
| Onboarding step 1 | "Ciao Cozza. Configuriamo le chiavi API." |
| Onboarding step 2 | "Scegli come ti piace parlarmi: voce, testo o entrambi." |
| Onboarding step 3 | "Pronto. Premi e tieni premuto per iniziare." |
| Costo budget warning | "Hai usato l'80% del budget mensile." |
| Costo budget over | "Budget mensile esaurito. Le richieste ora vanno a costo extra." |
| Modello switch | "Passo a Claude per questa risposta." |
| Reading mode entrata | "Modalita' lettura. Tocca per uscire." |
| TTS interrotto | "Ok, mi fermo." |
| App launch | "Apro {app}." |
| App launch fallita | "Non sono riuscito ad aprire {app}. Provo in un altro modo?" |
| Settings salvate | "Fatto." |
| Errore generico fallback | "Qualcosa non ha funzionato. Vuoi riprovare?" |

---

*Fine documento. Prossimi passi: validare la palette su display Beast reale, prototipare il VoiceModal in Figma con animazioni, definire ADR per la scelta wake-word engine (Picovoice vs Vosk).*
