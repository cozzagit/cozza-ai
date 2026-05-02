import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminVoices, fetchVoicePreview, type AdminVoice } from '@/lib/admin-api';
import { useSettingsStore } from '@/stores/settings';

type Filter = 'all' | 'italian' | 'female' | 'male' | 'narrative';

export function AdminVoices() {
  const [voices, setVoices] = useState<AdminVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const currentVoiceId = useSettingsStore((s) => s.voiceId);
  const setVoiceId = useSettingsStore((s) => s.setVoiceId);

  useEffect(() => {
    let mounted = true;
    fetchAdminVoices()
      .then((v) => {
        if (mounted) setVoices(v);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : 'errore');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return voices.filter((v) => {
      if (
        s &&
        !v.name.toLowerCase().includes(s) &&
        !(v.descriptive ?? '').toLowerCase().includes(s)
      ) {
        return false;
      }
      switch (filter) {
        case 'italian':
          return v.isItalianNative;
        case 'female':
          return v.gender === 'female';
        case 'male':
          return v.gender === 'male';
        case 'narrative':
          return v.useCase === 'narrative_story';
        default:
          return true;
      }
    });
  }, [voices, filter, search]);

  const playPreview = async (v: AdminVoice): Promise<void> => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPreviewing(v.id);
    try {
      const blob = await fetchVoicePreview(v.id);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(null);
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'preview failed');
      setPreviewing(null);
    }
  };

  const setAsDefault = (v: AdminVoice): void => {
    setVoiceId(v.id);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-fg/80">
        Voce attuale:{' '}
        <span className="font-mono text-accent">
          {voices.find((v) => v.id === currentVoiceId)?.name ?? currentVoiceId ?? '— nessuna —'}
        </span>
        . Clicca <strong>Anteprima</strong> per ascoltare e <strong>Imposta</strong> per usarla in
        cozza-ai.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome o descrizione…"
          className="flex-1 min-w-[220px] glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
        />
        <div role="radiogroup" className="inline-flex glass-surface rounded-full p-1 gap-1 text-xs">
          {(
            [
              ['all', 'Tutte'],
              ['italian', '🇮🇹 Native'],
              ['female', '♀'],
              ['male', '♂'],
              ['narrative', 'Narrativa'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full px-3 py-1.5',
                filter === f
                  ? 'bg-accent text-black font-medium'
                  : 'text-muted-fg hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-fg">Carico voci…</p>}
      {error && (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((v) => {
          const active = v.id === currentVoiceId;
          const playing = previewing === v.id;
          return (
            <article
              key={v.id}
              className={[
                'rounded-xl glass-surface p-4 flex flex-col gap-3 transition-colors',
                active ? 'border-accent/60 bg-accent/5' : '',
              ].join(' ')}
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{v.name}</h3>
                  <p className="text-xs text-muted-fg/70 truncate">
                    {[v.gender, v.age, v.accent].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {v.isItalianNative && (
                  <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-700/40 text-emerald-300">
                    🇮🇹 Native
                  </span>
                )}
              </header>
              {v.descriptive && (
                <p className="text-xs text-muted-fg/60 line-clamp-2">
                  {v.descriptive} · {v.useCase ?? ''}
                </p>
              )}
              <div className="flex items-center gap-2 mt-auto pt-2">
                <button
                  type="button"
                  onClick={() => void playPreview(v)}
                  disabled={playing}
                  className="focus-accent flex-1 rounded-lg px-3 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50"
                >
                  {playing ? '▶ in riproduzione…' : '▶ Anteprima'}
                </button>
                <button
                  type="button"
                  onClick={() => setAsDefault(v)}
                  disabled={active}
                  className="focus-accent rounded-lg px-3 py-2 text-sm bg-accent text-black font-medium disabled:opacity-50"
                  aria-label={`Imposta ${v.name} come voce predefinita`}
                >
                  {active ? 'In uso' : 'Imposta'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-fg/60 text-center py-12">
          Nessuna voce corrisponde ai filtri.
        </p>
      )}
    </div>
  );
}
