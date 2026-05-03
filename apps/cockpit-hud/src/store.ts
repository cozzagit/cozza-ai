import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId = 'cyberpunk' | 'bauhaus';
export type HudMode =
  | 'vitals'
  | 'stream'
  | 'logs'
  | 'diff'
  | 'metrics'
  | 'spend'
  | 'pomodoro'
  | 'devstation'
  | 'ambient';

interface CockpitState {
  theme: ThemeId;
  mode: HudMode;
  token: string;
  busUrl: string;
  setTheme: (t: ThemeId) => void;
  toggleTheme: () => void;
  setMode: (m: HudMode) => void;
  setToken: (t: string) => void;
  setBusUrl: (u: string) => void;
}

const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const DEFAULT_BUS_URL = isProd ? `${window.location.origin}/cockpit` : 'http://localhost:3030';

export const useCockpitStore = create<CockpitState>()(
  persist(
    (set, get) => ({
      theme: 'cyberpunk',
      mode: 'vitals',
      token: '',
      busUrl: DEFAULT_BUS_URL,
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set({ theme: get().theme === 'cyberpunk' ? 'bauhaus' : 'cyberpunk' }),
      setMode: (m) => set({ mode: m }),
      setToken: (t) => set({ token: t }),
      setBusUrl: (u) => set({ busUrl: u }),
    }),
    { name: 'cozza-cockpit-hud', version: 1 },
  ),
);
