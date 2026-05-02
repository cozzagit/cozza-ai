import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatModel } from '@cozza/shared';

interface SettingsState {
  defaultModel: ChatModel;
  voiceEnabled: boolean;
  ttsAutoplay: boolean;
  setDefaultModel: (m: ChatModel) => void;
  setVoiceEnabled: (v: boolean) => void;
  setTtsAutoplay: (v: boolean) => void;
}

const ENV_DEFAULT = (import.meta.env.VITE_DEFAULT_MODEL as ChatModel | undefined) ?? 'gpt-4o-mini';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultModel: ENV_DEFAULT,
      voiceEnabled: true,
      ttsAutoplay: true,
      setDefaultModel: (m) => set({ defaultModel: m }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setTtsAutoplay: (v) => set({ ttsAutoplay: v }),
    }),
    {
      name: 'cozza-settings',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState> | null;
        // v1 → v2: previous default was claude-haiku-4-5; while Anthropic billing
        // is being unblocked, fall back to gpt-4o-mini for any client that had
        // the old default. User-chosen models are preserved.
        if (version < 2 && state?.defaultModel === 'claude-haiku-4-5') {
          return { ...state, defaultModel: 'gpt-4o-mini' as ChatModel };
        }
        return state ?? {};
      },
    },
  ),
);
