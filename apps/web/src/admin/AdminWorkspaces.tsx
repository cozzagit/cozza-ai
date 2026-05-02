import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  type WorkspaceConfig,
  type WorkspaceLayout,
  type PaneConfig,
  type PaneSourceType,
  type AppTile,
} from '@/lib/db';

const LAYOUT_OPTIONS: { id: WorkspaceLayout; label: string; slots: string[]; preview: string }[] = [
  { id: 'single', label: 'Singolo', slots: ['full'], preview: '⬛' },
  { id: 'split-2-h', label: '2 colonne', slots: ['left', 'right'], preview: '⬛⬛' },
  { id: 'split-2-v', label: '2 righe', slots: ['top', 'bottom'], preview: '🟰' },
  { id: 'cols-3', label: '3 colonne', slots: ['left', 'center', 'right'], preview: '⬛⬛⬛' },
  { id: 'grid-2x2', label: 'Griglia 2×2', slots: ['tl', 'tr', 'bl', 'br'], preview: '▦' },
];

const SOURCE_TYPES: { id: PaneSourceType; label: string; hint: string }[] = [
  { id: 'cozza-chat', label: '🗣️ Chat cozza-ai', hint: "L'interfaccia di chat principale" },
  { id: 'app', label: '📱 App tile', hint: 'Una delle app dal launcher' },
  { id: 'iframe', label: '🔗 URL custom', hint: 'Pagina web in iframe (alcune bloccano frame)' },
  { id: 'note', label: '📝 Nota / launcher', hint: 'Placeholder o categoria launcher' },
];

export function AdminWorkspaces() {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy('sortOrder').toArray()) ?? [];
  const apps = useLiveQuery(() => db.apps.orderBy('name').toArray()) ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;

  const updateActive = async (patch: Partial<WorkspaceConfig>): Promise<void> => {
    if (!active) return;
    await db.workspaces.update(active.id, patch);
  };

  const updatePane = async (paneId: string, patch: Partial<PaneConfig>): Promise<void> => {
    if (!active) return;
    const panes = active.panes.map((p) => (p.id === paneId ? { ...p, ...patch } : p));
    await db.workspaces.update(active.id, { panes });
  };

  const setLayout = async (layout: WorkspaceLayout): Promise<void> => {
    if (!active) return;
    const def = LAYOUT_OPTIONS.find((l) => l.id === layout);
    if (!def) return;
    // Conserve as many existing panes as we can; create new ones for new slots.
    const existing = active.panes;
    const panes: PaneConfig[] = def.slots.map((slot, i) => {
      const reused = existing[i];
      return {
        id: reused?.id ?? `pane-${slot}`,
        slot,
        type: reused?.type ?? 'cozza-chat',
        ref: reused?.ref ?? '',
        ...(reused?.title ? { title: reused.title } : {}),
      };
    });
    await db.workspaces.update(active.id, { layout, panes });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-fg/80">
        I workspaces riorganizzano la PWA con layout multipane. Ogni pannello può ospitare la chat
        cozza-ai, un&apos;app del launcher, un URL custom o una nota. Saranno attivati nella V1
        (wake word).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setActiveId(w.id)}
            className={[
              'focus-accent rounded-xl glass-surface p-3 text-left transition-colors',
              active?.id === w.id ? 'border-accent/60 bg-accent/5' : 'hover:bg-white/5',
            ].join(' ')}
          >
            <div className="text-2xl leading-none mb-1" aria-hidden>
              {w.icon.startsWith('emoji:') ? w.icon.slice(6) : '🪟'}
            </div>
            <div className="font-medium text-sm">{w.name}</div>
            <div className="text-[10px] text-muted-fg/60 capitalize">{w.layout}</div>
          </button>
        ))}
      </div>

      {active && (
        <article className="rounded-2xl glass-surface p-5 space-y-5">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">
                {active.icon.startsWith('emoji:') ? active.icon.slice(6) : '🪟'} {active.name}
              </h3>
              <p className="text-xs text-muted-fg/70">{active.description}</p>
            </div>
          </header>

          <section>
            <h4 className="text-sm font-medium mb-2">Layout</h4>
            <div className="flex flex-wrap gap-2">
              {LAYOUT_OPTIONS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => void setLayout(l.id)}
                  className={[
                    'rounded-lg px-3 py-2 text-sm border transition-colors',
                    active.layout === l.id
                      ? 'bg-accent/15 border-accent/50'
                      : 'glass-surface hover:bg-white/5',
                  ].join(' ')}
                >
                  <span className="mr-1.5" aria-hidden>
                    {l.preview}
                  </span>
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-sm font-medium mb-2">Pannelli</h4>
            <LayoutPreview layout={active.layout} panes={active.panes} apps={apps} />
            <div className="mt-4 space-y-3">
              {active.panes.map((p) => (
                <PaneEditor
                  key={p.id}
                  pane={p}
                  apps={apps}
                  onChange={(patch) => void updatePane(p.id, patch)}
                />
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-sm font-medium mb-2">Metadati</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted-fg/70">Nome</span>
                <input
                  value={active.name}
                  onChange={(e) => void updateActive({ name: e.target.value })}
                  className="w-full glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-fg/70">Icona (emoji:X)</span>
                <input
                  value={active.icon}
                  onChange={(e) => void updateActive({ icon: e.target.value })}
                  className="w-full glass-surface rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent/40"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-muted-fg/70">Descrizione</span>
                <input
                  value={active.description ?? ''}
                  onChange={(e) => void updateActive({ description: e.target.value })}
                  className="w-full glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
                />
              </label>
            </div>
          </section>
        </article>
      )}
    </div>
  );
}

function LayoutPreview({
  layout,
  panes,
  apps,
}: {
  layout: WorkspaceLayout;
  panes: PaneConfig[];
  apps: AppTile[];
}) {
  const grid =
    layout === 'single'
      ? 'grid-cols-1 grid-rows-1'
      : layout === 'split-2-h'
        ? 'grid-cols-2 grid-rows-1'
        : layout === 'split-2-v'
          ? 'grid-cols-1 grid-rows-2'
          : layout === 'cols-3'
            ? 'grid-cols-3 grid-rows-1'
            : 'grid-cols-2 grid-rows-2';
  return (
    <div className={`grid gap-1 h-32 rounded-lg overflow-hidden border border-white/5 ${grid}`}>
      {panes.map((p) => (
        <div
          key={p.id}
          className="bg-oled-100 flex flex-col items-center justify-center text-xs text-muted-fg/70 p-2 text-center"
          title={paneSummary(p, apps)}
        >
          <div className="text-base" aria-hidden>
            {paneEmoji(p.type)}
          </div>
          <div className="truncate w-full font-medium text-white text-[11px]">
            {p.title ?? p.slot}
          </div>
          <div className="truncate w-full">{paneSummary(p, apps)}</div>
        </div>
      ))}
    </div>
  );
}

function paneSummary(p: PaneConfig, apps: AppTile[]): string {
  switch (p.type) {
    case 'cozza-chat':
      return 'Chat cozza-ai';
    case 'app': {
      const a = apps.find((x) => x.id === p.ref);
      return a ? a.name : '(app non selezionata)';
    }
    case 'iframe':
      try {
        return new URL(p.ref).hostname;
      } catch {
        return p.ref || '(url)';
      }
    case 'note':
      return p.ref || '(nota)';
    default:
      return '';
  }
}

function paneEmoji(t: PaneSourceType): string {
  return t === 'cozza-chat' ? '🗣️' : t === 'app' ? '📱' : t === 'iframe' ? '🔗' : '📝';
}

function PaneEditor({
  pane,
  apps,
  onChange,
}: {
  pane: PaneConfig;
  apps: AppTile[];
  onChange: (patch: Partial<PaneConfig>) => void;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-oled-100/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-fg/70 bg-white/5 rounded px-2 py-0.5">
          {pane.slot}
        </span>
        <input
          value={pane.title ?? ''}
          placeholder="Titolo (opz.)"
          onChange={(e) => onChange(e.target.value ? { title: e.target.value } : { title: '' })}
          className="flex-1 glass-surface rounded-md px-2 py-1 text-xs outline-none focus:border-accent/40"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {SOURCE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange({ type: t.id, ref: t.id === 'cozza-chat' ? '' : pane.ref })}
            className={[
              'text-[11px] rounded-md px-2 py-1 transition-colors',
              pane.type === t.id
                ? 'bg-accent text-black font-medium'
                : 'bg-white/5 hover:bg-white/10',
            ].join(' ')}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pane.type === 'app' && (
        <select
          value={pane.ref}
          onChange={(e) => onChange({ ref: e.target.value })}
          className="w-full glass-surface rounded-md px-2 py-1 text-xs outline-none focus:border-accent/40"
        >
          <option value="" className="bg-oled-100">
            — scegli un&apos;app —
          </option>
          {apps.map((a) => (
            <option key={a.id} value={a.id} className="bg-oled-100">
              {a.name}
            </option>
          ))}
        </select>
      )}
      {pane.type === 'iframe' && (
        <input
          value={pane.ref}
          onChange={(e) => onChange({ ref: e.target.value })}
          placeholder="https://example.com"
          className="w-full glass-surface rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-accent/40"
        />
      )}
      {pane.type === 'note' && (
        <input
          value={pane.ref}
          onChange={(e) => onChange({ ref: e.target.value })}
          placeholder="Testo o slug categoria (es. cinema-launcher)"
          className="w-full glass-surface rounded-md px-2 py-1 text-xs outline-none focus:border-accent/40"
        />
      )}
    </div>
  );
}
