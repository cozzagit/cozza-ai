import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v7 as uuidv7 } from 'uuid';
import { db, type AppTile } from '@/lib/db';
import { resetBuiltins } from '@/lib/seed';

const CATEGORIES: AppTile['category'][] = [
  'streaming',
  'ai',
  'work',
  'study',
  'music',
  'social',
  'other',
];

const CATEGORY_LABELS: Record<AppTile['category'], string> = {
  streaming: '📺 Streaming',
  ai: '🤖 AI',
  work: '💻 Lavoro',
  study: '📚 Studio',
  music: '🎧 Musica',
  social: '🌐 Social',
  other: '📦 Altro',
};

const EMPTY: Omit<AppTile, 'id' | 'createdAt'> = {
  name: '',
  url: '',
  icon: 'emoji:📦',
  category: 'other',
  sortOrder: 999,
  pinned: false,
  builtin: false,
};

export function AdminApps() {
  const apps = useLiveQuery(() => db.apps.orderBy('sortOrder').toArray()) ?? [];
  const [editing, setEditing] = useState<AppTile | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | AppTile['category']>('all');

  const visibleApps = filter === 'all' ? apps : apps.filter((a) => a.category === filter);
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: apps.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  const togglePin = async (a: AppTile): Promise<void> => {
    await db.apps.update(a.id, { pinned: !a.pinned });
  };

  const removeApp = async (a: AppTile): Promise<void> => {
    if (!confirm(`Rimuovere "${a.name}"?`)) return;
    await db.apps.delete(a.id);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-fg/80">
        App tile per il launcher. Le tile <span className="font-mono">pinned</span> appaiono nella
        home; le altre sono richiamabili dal menu app.
        <br />
        Le card con la stella verde sono pre-incluse, puoi modificarle ma il <em>Reset</em> in fondo
        le riporta agli originali.
      </p>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div
          role="radiogroup"
          className="inline-flex glass-surface rounded-full p-1 gap-1 text-xs flex-wrap"
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={[
              'rounded-full px-3 py-1.5',
              filter === 'all'
                ? 'bg-accent text-black font-medium'
                : 'text-muted-fg hover:text-white',
            ].join(' ')}
          >
            Tutte ({apps.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = apps.filter((a) => a.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={[
                  'rounded-full px-3 py-1.5',
                  filter === cat
                    ? 'bg-accent text-black font-medium'
                    : 'text-muted-fg hover:text-white',
                ].join(' ')}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="focus-accent rounded-full px-4 py-2 bg-accent text-black font-medium text-sm"
        >
          + Aggiungi app
        </button>
      </div>

      {filter === 'all' ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.cat}>
              <h3 className="text-sm font-semibold mb-2 text-muted-fg/80">
                {CATEGORY_LABELS[g.cat]}
              </h3>
              <Grid apps={g.items} onEdit={setEditing} onPin={togglePin} onRemove={removeApp} />
            </section>
          ))}
        </div>
      ) : (
        <Grid apps={visibleApps} onEdit={setEditing} onPin={togglePin} onRemove={removeApp} />
      )}

      <div className="pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={async () => {
            if (
              !confirm(
                'Reset di tutte le app pre-incluse ai valori di fabbrica? Le tile create da te non vengono toccate.',
              )
            )
              return;
            await resetBuiltins();
          }}
          className="text-sm rounded-lg px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10"
        >
          Reset built-in alle voci di fabbrica
        </button>
      </div>

      {(editing || creating) && (
        <AppEditor
          initial={editing ?? { ...EMPTY, id: '', createdAt: 0 }}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={async (a) => {
            if (creating) {
              const id = uuidv7();
              await db.apps.add({ ...a, id, createdAt: Date.now() });
            } else {
              await db.apps.put(a);
            }
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function Grid({
  apps,
  onEdit,
  onPin,
  onRemove,
}: {
  apps: AppTile[];
  onEdit: (a: AppTile) => void;
  onPin: (a: AppTile) => void;
  onRemove: (a: AppTile) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {apps.map((a) => (
        <article key={a.id} className="rounded-xl glass-surface p-3 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <span className="text-3xl leading-none" aria-hidden>
              {iconRender(a.icon)}
            </span>
            {a.builtin && (
              <span title="Pre-inclusa" className="text-[10px] text-emerald-400" aria-hidden>
                ★
              </span>
            )}
          </div>
          <h4 className="font-medium text-sm leading-tight truncate">{a.name}</h4>
          <p className="text-[11px] text-muted-fg/60 truncate font-mono">
            {new URL(a.url).hostname}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-accent text-[11px] rounded-md px-2 py-1 bg-accent/15 text-accent hover:bg-accent/25"
            >
              Apri
            </a>
            <button
              type="button"
              onClick={() => onPin(a)}
              className="text-[11px] rounded-md px-2 py-1 bg-white/5 hover:bg-white/10"
              title={a.pinned ? 'Unpin' : 'Pin'}
            >
              {a.pinned ? '📌' : '📍'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(a)}
              className="text-[11px] rounded-md px-2 py-1 bg-white/5 hover:bg-white/10"
              title="Modifica"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => onRemove(a)}
              className="text-[11px] rounded-md px-2 py-1 bg-white/5 hover:bg-red-950/40 hover:text-red-300"
              title="Elimina"
            >
              ✕
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function iconRender(icon: string): string {
  if (icon.startsWith('emoji:')) return icon.slice(6);
  return '📦';
}

function AppEditor({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: AppTile;
  isNew: boolean;
  onClose: () => void;
  onSave: (a: AppTile) => Promise<void>;
}) {
  const [a, setA] = useState<AppTile>(initial);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!a.name.trim() || !a.url.trim()) return;
    try {
      // Validate URL
      new URL(a.url);
    } catch {
      alert('URL non valido');
      return;
    }
    await onSave(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor app"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl bg-oled-200 border border-white/10 p-5 space-y-3"
      >
        <h3 className="font-semibold">{isNew ? 'Nuova app' : `Modifica: ${initial.name}`}</h3>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block">
            <span className="text-xs text-muted-fg/70">Nome</span>
            <input
              ref={(el) => el?.focus()}
              value={a.name}
              onChange={(e) => setA({ ...a, name: e.target.value })}
              className="w-full glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-fg/70">Icona (emoji:X)</span>
            <input
              value={a.icon}
              onChange={(e) => setA({ ...a, icon: e.target.value })}
              placeholder="emoji:🎬"
              className="w-full glass-surface rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent/40"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted-fg/70">URL</span>
          <input
            value={a.url}
            onChange={(e) => setA({ ...a, url: e.target.value })}
            placeholder="https://"
            className="w-full glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-fg/70">Categoria</span>
          <select
            value={a.category}
            onChange={(e) => setA({ ...a, category: e.target.value as AppTile['category'] })}
            className="w-full glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-oled-100">
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted-fg/70">Android intent (opzionale, per Pixel)</span>
          <input
            value={a.androidIntent ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                setA({ ...a, androidIntent: v });
              } else {
                const { androidIntent: _drop, ...rest } = a;
                setA(rest as AppTile);
              }
            }}
            placeholder="intent://…#Intent;…;end"
            className="w-full glass-surface rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent/40"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted-fg/70">Ordine (asc)</span>
            <input
              type="number"
              value={a.sortOrder}
              onChange={(e) => setA({ ...a, sortOrder: Number(e.target.value) })}
              className="w-full glass-surface rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent/40"
            />
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={a.pinned}
              onChange={(e) => setA({ ...a, pinned: e.target.checked })}
              className="accent-accent w-4 h-4"
            />
            <span className="text-sm">Pinned in home</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted-fg hover:text-white"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm bg-accent text-black font-medium"
          >
            {isNew ? 'Crea' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  );
}
