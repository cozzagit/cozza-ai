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

const ENV_DEFAULT = (import.meta.env.VITE_DEFAULT_MODEL as ChatModel | undefined) ?? 'claude-haiku-4-5';

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
    { name: 'cozza-settings' },
  ),
);
