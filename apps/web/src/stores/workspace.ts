import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceId } from '@cozza/shared';

interface WorkspaceState {
  active: WorkspaceId;
  setActive: (id: WorkspaceId) => void;
}

/**
 * V1 hook predisposto. UI MVP non legge mai `active`.
 * In V1 il wake-word + intent classifier setteranno questo store
 * per re-organizzare il layout (Casual / Lavoriamo / Cinema / Studio / Ambient).
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      active: 'casual',
      setActive: (id) => set({ active: id }),
    }),
    { name: 'cozza-workspace' },
  ),
);
