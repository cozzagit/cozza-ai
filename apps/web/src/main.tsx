import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Admin } from './admin/Admin';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

function isAdminPath(): boolean {
  return window.location.pathname.startsWith('/admin');
}

function Root() {
  const [admin, setAdmin] = useState(isAdminPath);

  useEffect(() => {
    const onPop = (): void => setAdmin(isAdminPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (admin) {
    return (
      <Admin
        onClose={() => {
          window.history.pushState({}, '', '/');
          setAdmin(false);
        }}
      />
    );
  }
  return <App />;
}

createRoot(rootEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
