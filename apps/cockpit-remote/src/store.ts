import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RemoteMode = 'home' | 'trackpad' | 'dpad' | 'switcher' | 'actions' | 'voice';

/** Where the trackpad routes its events: HUD virtual cursor, or PC native input. */
export type TrackpadTarget = 'hud' | 'pc';

interface RemoteState {
  mode: RemoteMode;
  token: string;
  busUrl: string;
  trackpadSensitivity: number;
  trackpadTarget: TrackpadTarget;
  setMode: (m: RemoteMode) => void;
  setToken: (t: string) => void;
  setBusUrl: (u: string) => void;
  setSensitivity: (s: number) => void;
  setTrackpadTarget: (t: TrackpadTarget) => void;
}

const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const DEFAULT_BUS_URL = isProd ? `${window.location.origin}/cockpit` : 'http://localhost:3030';

export const useRemoteStore = create<RemoteState>()(
  persist(
    (set) => ({
      mode: 'home',
      token: '',
      busUrl: DEFAULT_BUS_URL,
      // Default 2.0 + acceleration curve in Trackpad.tsx scales the
      // 6-inch phone glass to a 27"+ desktop with one-swipe coverage.
      trackpadSensitivity: 2.0,
      trackpadTarget: 'hud',
      setMode: (m) => set({ mode: m }),
      setToken: (t) => set({ token: t }),
      setBusUrl: (u) => set({ busUrl: u }),
      setSensitivity: (s) => set({ trackpadSensitivity: s }),
      setTrackpadTarget: (t) => set({ trackpadTarget: t }),
    }),
    { name: 'cozza-cockpit-remote', version: 2 },
  ),
);
