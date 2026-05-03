import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RemoteMode = 'home' | 'trackpad' | 'switcher' | 'actions' | 'voice';

interface RemoteState {
  mode: RemoteMode;
  token: string;
  busUrl: string;
  trackpadSensitivity: number;
  setMode: (m: RemoteMode) => void;
  setToken: (t: string) => void;
  setBusUrl: (u: string) => void;
  setSensitivity: (s: number) => void;
}

const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const DEFAULT_BUS_URL = isProd ? `${window.location.origin}/cockpit` : 'http://localhost:3030';

export const useRemoteStore = create<RemoteState>()(
  persist(
    (set) => ({
      mode: 'home',
      token: '',
      busUrl: DEFAULT_BUS_URL,
      trackpadSensitivity: 1.5,
      setMode: (m) => set({ mode: m }),
      setToken: (t) => set({ token: t }),
      setBusUrl: (u) => set({ busUrl: u }),
      setSensitivity: (s) => set({ trackpadSensitivity: s }),
    }),
    { name: 'cozza-cockpit-remote', version: 1 },
  ),
);
