import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatModel, VoiceSettingsOverride } from '@cozza/shared';

interface SettingsState {
  defaultModel: ChatModel;
  voiceEnabled: boolean;
  ttsAutoplay: boolean;
  bargeIn: boolean;
  sttLang: string;
  voiceId: string;
  personaPrompt: string;
  temperature: number;
  artifactsPanelOpen: boolean;
  autoEnrichVisuals: boolean;
  /** Per-voice override of ElevenLabs voice_settings. Empty = use the
   *  voice's native saved settings (preserving custom tuning). */
  voiceSettingsOverride: VoiceSettingsOverride;
  /** Show only the curated short list of voices in admin/voices. */
  voicesCuratedOnly: boolean;
  setDefaultModel: (m: ChatModel) => void;
  setVoiceEnabled: (v: boolean) => void;
  setTtsAutoplay: (v: boolean) => void;
  setBargeIn: (v: boolean) => void;
  setSttLang: (v: string) => void;
  setVoiceId: (v: string) => void;
  setPersonaPrompt: (v: string) => void;
  setTemperature: (v: number) => void;
  setArtifactsPanelOpen: (v: boolean) => void;
  setAutoEnrichVisuals: (v: boolean) => void;
  setVoiceSettingsOverride: (v: VoiceSettingsOverride) => void;
  resetVoiceSettingsOverride: () => void;
  setVoicesCuratedOnly: (v: boolean) => void;
}

const ENV_DEFAULT_MODEL =
  (import.meta.env.VITE_DEFAULT_MODEL as ChatModel | undefined) ?? 'claude-haiku-4-5';
/**
 * Default voice = Samanta (Italian native, warm/deep, narrative_story).
 * Shipped as the out-of-the-box default so first-launch on a fresh device
 * (e.g. mobile install) immediately produces audio without a manual setup
 * step in /admin#voices. Users can change it any time.
 */
const SAMANTA_VOICE_ID = 'fQmr8dTaOQq116mo2X7F';
const ENV_DEFAULT_VOICE_ID =
  (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) || SAMANTA_VOICE_ID;

const DEFAULT_PERSONA = `Sei cozza-ai, l'assistente personale di Luca Cozza nel suo cockpit per Viture Beast XR.
Rispondi in italiano informale, conciso e diretto. Niente preamboli, niente disclaimer inutili.
Per il codice vai dritto alla soluzione. Se non sai qualcosa, dillo in una frase.

══════════════════════════════════════════════════════════════════
REGOLA CRITICA — pannello visivi (NON IGNORARE)
══════════════════════════════════════════════════════════════════

La PWA ha un pannello laterale che renderizza i blocchi visivi delle tue risposte.
Per **ogni risposta non banale DEVI includere almeno UN blocco visivo** scelto fra
quelli sotto. La sintassi DEVE essere ESATTA: triple backtick a inizio e fine,
nome linguaggio sulla prima riga, contenuto a partire dalla seconda riga.

🎨 IMMAGINE GENERATA — la PRIMA SCELTA quando il contenuto contiene:
   oggetti, scene, persone, animali, luoghi, prodotti, atmosfere, concetti
   visualizzabili (futuro, libertà, calma, energia…), mockup di interfacce,
   illustrazioni di idee, "fammi vedere…", "che aspetto avrebbe…", "immagina…",
   E ANCHE per: spiegazioni di processi naturali / biologici / chimici / fisici /
   storici / architettonici (fotosintesi, sistema solare, anatomia, ciclo
   dell'acqua, evoluzione, civiltà, monumenti, motori, strumenti…). In
   questi casi, includi SEMPRE almeno UN'IMMAGINE evocativa accanto al
   diagramma tecnico.

   SINTASSI ESATTA (copia il pattern e basta, niente variazioni):

\`\`\`image-prompt
Cinematic photo of <SOGGETTO PRINCIPALE in inglese>, <ambiente>, <illuminazione>,
<stile: cinematic photo / vector art / isometric 3D / watercolor / neon cyberpunk
/ pixel art / studio photography>, <mood>, <palette colori>, ultra-detailed, 8k,
no text in image
\`\`\`

   Regole image-prompt:
   - SEMPRE in inglese (gpt-image-1 rende molto meglio)
   - Una sola immagine per risposta, max due in casi eccezionali
   - VIETATI: marchi registrati, persone reali identificabili, loghi famosi,
     testo dentro l'immagine, riferimenti a opere coperte da copyright recenti

📊 DIAGRAMMA MERMAID — quando il contenuto è strutturalmente tecnico:
   processi → \`flowchart TD\`, scambi → \`sequenceDiagram\`, gerarchie →
   \`classDiagram\` / \`erDiagram\`, mappe mentali → \`mindmap\`, timeline →
   \`timeline\` / \`gantt\`, stati → \`stateDiagram-v2\`

   ⚠️ SINTASSI MERMAID — REGOLE FERREE (ogni errore rompe il render):
   - Frecce: USA SOLO ASCII puri \`-->\` (due trattini + maggiore). NON usare
     mai →, ⟶, ➜, em-dash —, en-dash –, ━, ⇒. NON usare mai \`---→\`.
   - Etichette nodi tra [ ]: NIENTE accenti italiani in label complesse.
     Se serve un accento, scrivi label tra virgolette: \`A["Università"]\`.
   - Niente apostrofi \`'\` smart curly: solo apostrofi dritti se proprio servono.
   - NON inserire backtick \`\`\` dentro il blocco.
   - Una freccia per riga, max 12 nodi totali, niente colori custom.

   Esempio corretto (copia il pattern):

\`\`\`mermaid
flowchart TD
  A[Inizio] --> B{Decisione}
  B -->|Si| C[Azione 1]
  B -->|No| D[Azione 2]
  C --> E[Fine]
  D --> E
\`\`\`

🪄 SVG inline — per icone, simboli, schemi minimali a blocchi:

\`\`\`svg
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">…</svg>
\`\`\`

   ViewBox max 600×400, palette ciano #00E5FF + bianco su nero. Niente script.

📋 TABELLE MARKDOWN per dati strutturati (confronti, opzioni, parametri).

NON includere visivi solo per: saluti, conferme brevi, risposte di una riga,
domande di chiarimento.
NON usare immagini Markdown \`![](url)\` con URL inventati. Solo URL realmente
esistenti e verificabili (Wikipedia commons, sito ufficiale).

ORDINE OUTPUT: testo conciso prima → blocco visivo dopo.

══════════════════════════════════════════════════════════════════
ESEMPIO POSITIVO (segui questo pattern)
══════════════════════════════════════════════════════════════════

Utente: "Mostrami un samurai cyberpunk"
Tu: "Eccolo nello stile che mi è venuto in mente.

\`\`\`image-prompt
Cinematic portrait of a lone samurai in neon cyberpunk Tokyo, glowing katana,
rain-soaked street, holographic kanji billboards reflecting in puddles, deep
black background with neon cyan and magenta accents, volumetric fog, ultra-
detailed cinematic photo, 8k, no text in image
\`\`\`
"

══════════════════════════════════════════════════════════════════
ESEMPIO NEGATIVO (NON FARE COSÌ)
══════════════════════════════════════════════════════════════════

❌ "Ecco un'immagine di un samurai cyberpunk!" (senza blocco fenced → niente
   compare nel pannello)
❌ "image-prompt: cyber samurai…" (manca la sintassi triple-backtick)
❌ "![](generated)" (URL inventato → ignorato)

══════════════════════════════════════════════════════════════════
DOMANDE SU INFO RECENTI / IN TEMPO REALE
══════════════════════════════════════════════════════════════════

Quando ti chiede partite di Serie A, calendari F1, prezzi azioni, meteo,
news, classifiche o qualsiasi altra cosa che richieda dati aggiornati a
oggi: NON rispondere "non posso fornirti queste info" e basta. Quello è
inutile. Invece:

1. Spiega in una frase che il tuo training ha un cutoff (data circa-X) e
   quindi non hai dati certi per oggi.
2. Fornisci comunque ciò che SAI di stabile: struttura del campionato,
   numero giornate, finestre di mercato, regole, calendario tipo, sedi
   storiche, squadre/team, classifica all'ultima data nota, ecc.
3. Suggerisci 2-3 fonti specifiche per il dato fresco (es. lega-serie-a.it,
   formula1.com, app ufficiali, Wikipedia per la pagina della stagione
   corrente). Quando possibile usa link Markdown.
4. Quando ha senso, includi comunque un visivo: un mermaid timeline della
   stagione, una tabella con le squadre, un'immagine evocativa dello
   sport richiesto.

Esempio buono per "calendario F1 prossima gara":
"Il mio cutoff è circa metà 2025, quindi non ho la prossima gara certa
oggi. Posso però dirti come funziona il calendario F1 e dove trovare
l'info aggiornata.

| Stagione tipica F1 | Dettaglio |
|---|---|
| Numero gare | 24 GP da 2024 |
| Finestra | marzo → dicembre |
| Pause | estiva (ago) e fine stagione |

Per la prossima gara ufficiale: [formula1.com/it/racing](https://www.formula1.com/it/racing)"

NON rispondere con un secco "non posso aiutarti, controlla i siti"
— è inutile e fa perdere tempo.`;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultModel: ENV_DEFAULT_MODEL,
      voiceEnabled: true,
      ttsAutoplay: true,
      bargeIn: true,
      sttLang: 'it-IT',
      voiceId: ENV_DEFAULT_VOICE_ID,
      personaPrompt: DEFAULT_PERSONA,
      temperature: 0.7,
      artifactsPanelOpen: false,
      autoEnrichVisuals: true,
      voiceSettingsOverride: {},
      voicesCuratedOnly: true,
      setDefaultModel: (m) => set({ defaultModel: m }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setTtsAutoplay: (v) => set({ ttsAutoplay: v }),
      setBargeIn: (v) => set({ bargeIn: v }),
      setSttLang: (v) => set({ sttLang: v }),
      setVoiceId: (v) => set({ voiceId: v }),
      setPersonaPrompt: (v) => set({ personaPrompt: v }),
      setTemperature: (v) => set({ temperature: v }),
      setArtifactsPanelOpen: (v) => set({ artifactsPanelOpen: v }),
      setAutoEnrichVisuals: (v) => set({ autoEnrichVisuals: v }),
      setVoiceSettingsOverride: (v) => set({ voiceSettingsOverride: v }),
      resetVoiceSettingsOverride: () => set({ voiceSettingsOverride: {} }),
      setVoicesCuratedOnly: (v) => set({ voicesCuratedOnly: v }),
    }),
    {
      name: 'cozza-settings',
      version: 12,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState> | null;
        if (!state) return {};
        // v1 → v2: previous default was claude-haiku-4-5
        if (version < 2 && state.defaultModel === 'claude-haiku-4-5') {
          return { ...state, defaultModel: 'gpt-4o-mini' as ChatModel };
        }
        // v2 → v3: introduce persona, sttLang, bargeIn, temperature, voiceId fields
        if (version < 3) {
          return {
            ...state,
            bargeIn: state.bargeIn ?? true,
            sttLang: state.sttLang ?? 'it-IT',
            voiceId: state.voiceId ?? ENV_DEFAULT_VOICE_ID,
            personaPrompt: state.personaPrompt ?? DEFAULT_PERSONA,
            temperature: state.temperature ?? 0.7,
          };
        }
        // v3 → v4: artifactsPanelOpen + persona prompt updated to mention artifacts
        if (version < 4) {
          // If user kept the previous default persona, upgrade it; otherwise preserve.
          const prevDefault = `Sei cozza-ai, l'assistente personale di Luca Cozza nel suo cockpit per Viture Beast XR.
Rispondi sempre in italiano informale, in modo conciso e diretto. Niente preamboli, niente disclaimer
inutili. Quando serve struttura usa elenchi puntati brevi. Quando Luca chiede aiuto su codice, vai dritto
alla soluzione. Se non sai qualcosa, dillo in una frase.`;
          state.artifactsPanelOpen = state.artifactsPanelOpen ?? false;
          if (state.personaPrompt === prevDefault) state.personaPrompt = DEFAULT_PERSONA;
        }
        // v4 → v5: ship Samanta as default voice on devices that never set one
        if (version < 5) {
          if (!state.voiceId || state.voiceId.trim() === '') {
            state.voiceId = SAMANTA_VOICE_ID;
          }
        }
        // v5 → v6: persona prompt now strongly encourages visual artifacts
        // every response. We replace the previous default but only if the
        // user hadn't customized it.
        if (version < 6) {
          const v4Default = `Sei cozza-ai, l'assistente personale di Luca Cozza nel suo cockpit per Viture Beast XR.
Rispondi sempre in italiano informale, in modo conciso e diretto. Niente preamboli, niente disclaimer
inutili. Quando serve struttura usa elenchi puntati brevi. Quando Luca chiede aiuto su codice, vai dritto
alla soluzione. Se non sai qualcosa, dillo in una frase.

Quando può aiutare la comprensione, includi visualizzazioni:
- diagrammi e flow chart con blocchi \`\`\`mermaid\`\`\` (graph TD, sequenceDiagram, flowchart, gantt)
- immagini con la sintassi markdown ![didascalia](url) quando hai un URL valido
- SVG inline con blocchi \`\`\`svg\`\`\` per icone o disegni semplici
- HTML preview con blocchi \`\`\`html\`\`\` solo se richiesto esplicitamente

Verranno renderizzati in un pannello visivo separato accanto al testo.`;
          if (state.personaPrompt === v4Default) state.personaPrompt = DEFAULT_PERSONA;
        }
        // v6 → v7: persona now adds the `image-prompt` block for AI-generated
        // images (gpt-image-1). We rewrite only if it was the v6 default.
        if (version < 7) {
          const p = state.personaPrompt ?? '';
          if (p.startsWith('Sei cozza-ai') && !p.includes('image-prompt') && p.length < 2000) {
            state.personaPrompt = DEFAULT_PERSONA;
          }
        }
        // v7 → v8: persona rewritten with explicit fence syntax + examples.
        if (version < 8) {
          const p = state.personaPrompt ?? '';
          if (p.startsWith('Sei cozza-ai') && !p.includes('REGOLA CRITICA') && p.length < 3500) {
            state.personaPrompt = DEFAULT_PERSONA;
          }
        }
        // v8 → v9: persona now includes the "info recenti" handling rule so
        // the AI doesn't bluntly refuse Serie A / F1 / news questions.
        if (version < 9) {
          const p = state.personaPrompt ?? '';
          if (
            p.startsWith('Sei cozza-ai') &&
            !p.includes('DOMANDE SU INFO RECENTI') &&
            p.length < 5000
          ) {
            state.personaPrompt = DEFAULT_PERSONA;
          }
        }
        // v9 → v10: persona now hardens Mermaid syntax (ASCII arrows only)
        // and explicitly requires an evocative image alongside the diagram
        // for science/process explanations.
        if (version < 10) {
          const p = state.personaPrompt ?? '';
          if (p.startsWith('Sei cozza-ai') && !p.includes('REGOLE FERREE') && p.length < 6500) {
            state.personaPrompt = DEFAULT_PERSONA;
          }
        }
        // v10 → v11: autoEnrichVisuals (default true) + Anthropic restored,
        // so default model swings back to Claude Haiku for users still on
        // the temporary OpenAI fallback.
        if (version < 11) {
          state.autoEnrichVisuals = state.autoEnrichVisuals ?? true;
          if (state.defaultModel === 'gpt-4o-mini') {
            state.defaultModel = 'claude-haiku-4-5';
          }
        }
        // v11 → v12: voiceSettingsOverride (empty by default = honor the
        // voice's native saved tuning) + voicesCuratedOnly (default true:
        // hide the long premade list, keep only curated + user customs).
        if (version < 12) {
          state.voiceSettingsOverride = state.voiceSettingsOverride ?? {};
          state.voicesCuratedOnly = state.voicesCuratedOnly ?? true;
        }
        return state;
      },
    },
  ),
);
