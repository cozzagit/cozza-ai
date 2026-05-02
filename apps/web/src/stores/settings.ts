import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatModel } from '@cozza/shared';

interface SettingsState {
  defaultModel: ChatModel;
  voiceEnabled: boolean;
  ttsAutoplay: boolean;
  bargeIn: boolean;
  sttLang: string;
  voiceId: string;
  personaPrompt: string;
  temperature: number;
  setDefaultModel: (m: ChatModel) => void;
  setVoiceEnabled: (v: boolean) => void;
  setTtsAutoplay: (v: boolean) => void;
  setBargeIn: (v: boolean) => void;
  setSttLang: (v: string) => void;
  setVoiceId: (v: string) => void;
  setPersonaPrompt: (v: string) => void;
  setTemperature: (v: number) => void;
}

const ENV_DEFAULT_MODEL =
  (import.meta.env.VITE_DEFAULT_MODEL as ChatModel | undefined) ?? 'gpt-4o-mini';
const ENV_DEFAULT_VOICE_ID = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ?? '';

const DEFAULT_PERSONA = `Sei cozza-ai, l'assistente personale di Luca Cozza nel suo cockpit per Viture Beast XR.
Rispondi sempre in italiano informale, in modo conciso e diretto. Niente preamboli, niente disclaimer
inutili. Quando serve struttura usa elenchi puntati brevi. Quando Luca chiede aiuto su codice, vai dritto
alla soluzione. Se non sai qualcosa, dillo in una frase.`;

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
      setDefaultModel: (m) => set({ defaultModel: m }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setTtsAutoplay: (v) => set({ ttsAutoplay: v }),
      setBargeIn: (v) => set({ bargeIn: v }),
      setSttLang: (v) => set({ sttLang: v }),
      setVoiceId: (v) => set({ voiceId: v }),
      setPersonaPrompt: (v) => set({ personaPrompt: v }),
      setTemperature: (v) => set({ temperature: v }),
    }),
    {
      name: 'cozza-settings',
      version: 3,
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
        return state;
      },
    },
  ),
);
