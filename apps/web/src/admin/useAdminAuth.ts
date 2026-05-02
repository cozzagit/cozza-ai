import { useCallback, useEffect, useState } from 'react';
import {
  adminToken,
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  AdminApiError,
} from '@/lib/admin-api';

export type AuthState = 'unknown' | 'authenticated' | 'unauthenticated';

export function useAdminAuth() {
  const [state, setState] = useState<AuthState>(() =>
    adminToken.get() ? 'authenticated' : 'unauthenticated',
  );

  useEffect(() => {
    const onLogout = (): void => setState('unauthenticated');
    window.addEventListener('cozza:admin-logout', onLogout);
    return () => window.removeEventListener('cozza:admin-logout', onLogout);
  }, []);

  const login = useCallback(
    async (pin: string): Promise<{ ok: true } | { ok: false; error: string; code?: string }> => {
      try {
        await apiLogin(pin);
        setState('authenticated');
        return { ok: true };
      } catch (e) {
        const err = e instanceof AdminApiError ? e : null;
        return {
          ok: false,
          error: err?.message ?? 'Errore',
          ...(err?.code ? { code: err.code } : {}),
        };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    await apiLogout();
    setState('unauthenticated');
  }, []);

  return { state, login, logout };
}
