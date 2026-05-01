import type { Conversation } from '@/lib/db';

interface SidebarProps {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onNew: () => void;
}

export function Sidebar({ open, conversations, activeId, onSelect, onClose, onNew }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={[
          'fixed md:static inset-y-0 left-0 z-40 w-72 bg-oled-200 border-r border-white/5 flex flex-col transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:-translate-x-full',
        ].join(' ')}
        aria-label="Cronologia conversazioni"
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <h2 className="font-medium">Conversazioni</h2>
          <button
            type="button"
            onClick={onNew}
            className="focus-accent rounded-full px-3 py-1 bg-accent/15 text-accent text-sm hover:bg-accent/25"
          >
            + Nuova
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <li className="text-muted-fg/60 text-sm p-3">
              Nessuna conversazione ancora.
            </li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={[
                    'focus-accent w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
                    c.id === activeId
                      ? 'bg-accent/15 text-white'
                      : 'text-muted-fg hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <div className="truncate font-medium">{c.title || 'Conversazione'}</div>
                  <div className="text-xs text-muted-fg/60 truncate">
                    {c.model} · {c.messageCount} msg
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}
