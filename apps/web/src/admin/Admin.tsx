import { useEffect } from 'react';
import { useAdminAuth } from './useAdminAuth';
import { AdminLogin } from './AdminLogin';
import { AdminShell } from './AdminShell';
import { AdminVoices } from './AdminVoices';
import { AdminSettings } from './AdminSettings';
import { AdminApps } from './AdminApps';
import { AdminWorkspaces } from './AdminWorkspaces';
import { AdminMaintenance } from './AdminMaintenance';
import { AdminErrorBoundary } from './ErrorBoundary';
import { seedIfEmpty } from '@/lib/seed';

interface AdminProps {
  /** Called when the user clicks "Torna alla chat" */
  onClose: () => void;
}

export function Admin({ onClose }: AdminProps) {
  const { state, login, logout } = useAdminAuth();

  useEffect(() => {
    void seedIfEmpty();
  }, []);

  if (state !== 'authenticated') {
    return <AdminLogin onSubmit={login} />;
  }

  return (
    <AdminShell onLogout={() => void logout()} onClose={onClose}>
      {(tab) => {
        const page = (() => {
          switch (tab) {
            case 'voices':
              return <AdminVoices />;
            case 'settings':
              return <AdminSettings />;
            case 'apps':
              return <AdminApps />;
            case 'workspaces':
              return <AdminWorkspaces />;
            case 'maintenance':
              return <AdminMaintenance />;
            default:
              return null;
          }
        })();
        return (
          <AdminErrorBoundary key={tab} label={tab}>
            {page}
          </AdminErrorBoundary>
        );
      }}
    </AdminShell>
  );
}
