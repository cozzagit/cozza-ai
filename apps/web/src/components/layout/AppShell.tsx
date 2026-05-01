import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, sidebar, footer, children }: AppShellProps) {
  return (
    <div className="h-full w-full flex bg-oled text-white">
      {sidebar}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-white/5 bg-oled-300/80 backdrop-blur-sm">
          {header}
        </header>
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
        <footer className="border-t border-white/5 bg-oled-300/80 backdrop-blur-sm">
          {footer}
        </footer>
      </main>
    </div>
  );
}
