import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Conversation } from '@/lib/db';

interface SidebarProps {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onNew: () => void;
  onRename: (id: string, newTitle: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function Sidebar({
  open,
  conversations,
  activeId,
  onSelect,
  onClose,
  onNew,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
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
            <li className="text-muted-fg/60 text-sm p-3">Nessuna conversazione ancora.</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id} className="group">
                {editingId === c.id ? (
                  <ConversationEditor
                    initialTitle={c.title || 'Conversazione'}
                    onSubmit={async (newTitle) => {
                      await onRename(c.id, newTitle);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <ConversationRow
                    c={c}
                    active={c.id === activeId}
                    onSelect={() => onSelect(c.id)}
                    onEdit={() => setEditingId(c.id)}
                    onDelete={() => void onDelete(c.id)}
                  />
                )}
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}

function ConversationRow({
  c,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  c: Conversation;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={[
        'flex items-center gap-1 rounded-lg pr-1 transition-colors',
        active ? 'bg-accent/15 text-white' : 'text-muted-fg hover:bg-white/5 hover:text-white',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-accent flex-1 min-w-0 text-left rounded-l-lg px-3 py-2 text-sm"
      >
        <div className="truncate font-medium">{c.title || 'Conversazione'}</div>
        <div className="text-xs text-muted-fg/60 truncate">
          {c.model} · {c.messageCount} msg
        </div>
      </button>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Rinomina ${c.title}`}
          title="Rinomina"
          className="focus-accent w-7 h-7 rounded-md flex items-center justify-center text-muted-fg hover:text-white hover:bg-white/10"
        >
          <span aria-hidden className="text-xs">
            ✎
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Elimina ${c.title}`}
          title="Elimina"
          className="focus-accent w-7 h-7 rounded-md flex items-center justify-center text-muted-fg hover:text-red-300 hover:bg-red-950/40"
        >
          <span aria-hidden className="text-xs">
            🗑
          </span>
        </button>
      </div>
    </div>
  );
}

function ConversationEditor({
  initialTitle,
  onSubmit,
  onCancel,
}: {
  initialTitle: string;
  onSubmit: (newTitle: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialTitle);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    const v = value.trim();
    if (!v) {
      onCancel();
      return;
    }
    await onSubmit(v);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1 rounded-lg bg-accent/10 pr-1">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => void submit()}
        maxLength={120}
        className="flex-1 min-w-0 rounded-l-lg px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-accent/40"
        aria-label="Nuovo titolo"
      />
      <button
        type="submit"
        aria-label="Conferma"
        title="Salva (Invio)"
        className="focus-accent w-7 h-7 rounded-md flex items-center justify-center text-accent hover:bg-accent/20"
      >
        <span aria-hidden className="text-xs">
          ✓
        </span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Annulla"
        title="Annulla (Esc)"
        className="focus-accent w-7 h-7 rounded-md flex items-center justify-center text-muted-fg hover:text-white hover:bg-white/10"
      >
        <span aria-hidden className="text-xs">
          ×
        </span>
      </button>
    </form>
  );
}
