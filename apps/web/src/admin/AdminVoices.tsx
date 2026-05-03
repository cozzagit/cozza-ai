import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminVoices, fetchVoicePreview, type AdminVoice } from '@/lib/admin-api';
import { useSettingsStore } from '@/stores/settings';
import { VoiceParamsModal } from './VoiceParamsModal';

type Tab = 'curated' | 'custom' | 'all';

/**
 * Curated allowlist: 3 native Italian + 3 female premade + 3 male premade.
 * Picked for warmth/clarity at long-form. The user's own custom voices are
 * always shown alongside on the Curated tab.
 */
const CURATED_VOICE_IDS = new Set<string>([
  // Native IT
  'fQmr8dTaOQq116mo2X7F', // Samanta — F, IT native
  'W71zT1VwIFFx3mMGH2uZ', // MarcoTrox — M, IT native
  // Female premade (multilingual)
  'EXAVITQu4vr4xnSDxMaL', // Sarah
  'pFZP5JQG7iQjIQuC4Bku', // Lily
  'XrExE9yKIg1WjnnlVkGX', // Matilda
  // Male premade (multilingual)
  'JBFqnCBsd6RMkjVDRZzb', // George
  'nPczCjzI2devNBz1zQrb', // Brian
  'cjVigY5qzO86Huf0OWal', // Eric
]);

export function AdminVoices() {
  const [voices, setVoices] = useState<AdminVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const currentVoiceId = useSettingsStore((s) => s.voiceId);
  const setVoiceId = useSettingsStore((s) => s.setVoiceId);
  const curatedOnly = useSettingsStore((s) => s.voicesCuratedOnly);
  const setCuratedOnly = useSettingsStore((s) => s.setVoicesCuratedOnly);
  const overrideMap = useSettingsStore((s) => s.voiceSettingsByVoice);
  const [tab, setTab] = useState<Tab>(curatedOnly ? 'curated' : 'all');
  const [paramsFor, setParamsFor] = useState<AdminVoice | null>(null);

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
      switch (tab) {
        case 'curated':
          return CURATED_VOICE_IDS.has(v.id) || v.isCustom;
        case 'custom':
          return v.isCustom;
        case 'all':
        default:
          return true;
      }
    });
  }, [voices, tab, search]);

  // Group: Custom first (highlighted), then Curated/Other
  const grouped = useMemo(() => {
    const customs = filtered.filter((v) => v.isCustom);
    const others = filtered.filter((v) => !v.isCustom);
    return { customs, others };
  }, [filtered]);

  const playPreview = async (v: AdminVoice): Promise<void> => {
    if (audioRef.current) audioRef.current.pause();
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

  const counts = {
    curated: voices.filter((v) => CURATED_VOICE_IDS.has(v.id) || v.isCustom).length,
    custom: voices.filter((v) => v.isCustom).length,
    all: voices.length,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-fg/80">
        Voce attuale:{' '}
        <span className="font-mono text-accent">
          {voices.find((v) => v.id === currentVoiceId)?.name ?? currentVoiceId ?? '— nessuna —'}
        </span>
        . Click su <span className="font-mono">⚙</span> in ogni card per personalizzare i parametri{' '}
        <em>per quella voce</em> (stability, similarity, style, speed, speaker boost). Le modifiche
        sono locali e si applicano solo quando quella voce è in uso.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca…"
          className="flex-1 min-w-[200px] glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40"
        />
        <div role="radiogroup" className="inline-flex glass-surface rounded-full p-1 gap-1 text-xs">
          {(
            [
              ['curated', `⭐ Selezione (${counts.curated})`],
              ['custom', `🪪 Custom (${counts.custom})`],
              ['all', `Tutte (${counts.all})`],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setCuratedOnly(t === 'curated');
              }}
              className={[
                'rounded-full px-3 py-1.5',
                tab === t ? 'bg-accent text-black font-medium' : 'text-muted-fg hover:text-white',
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

      {grouped.customs.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-fg/70 mb-2 uppercase tracking-wider">
            🪪 Le tue voci custom
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.customs.map((v) => (
              <VoiceCard
                key={v.id}
                voice={v}
                active={v.id === currentVoiceId}
                playing={previewing === v.id}
                hasOverride={Object.keys(overrideMap[v.id] ?? {}).length > 0}
                onPreview={() => void playPreview(v)}
                onSet={() => setAsDefault(v)}
                onOpenParams={() => setParamsFor(v)}
              />
            ))}
          </div>
        </section>
      )}

      {grouped.others.length > 0 && (
        <section>
          {grouped.customs.length > 0 && (
            <h3 className="text-xs font-semibold text-muted-fg/70 mb-2 uppercase tracking-wider">
              {tab === 'curated' ? '⭐ Selezione cozza-ai' : 'Altre voci'}
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.others.map((v) => (
              <VoiceCard
                key={v.id}
                voice={v}
                active={v.id === currentVoiceId}
                playing={previewing === v.id}
                hasOverride={Object.keys(overrideMap[v.id] ?? {}).length > 0}
                onPreview={() => void playPreview(v)}
                onSet={() => setAsDefault(v)}
                onOpenParams={() => setParamsFor(v)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-fg/60 text-center py-12">
          Nessuna voce corrisponde ai filtri.
        </p>
      )}

      {paramsFor && <VoiceParamsModal voice={paramsFor} onClose={() => setParamsFor(null)} />}
    </div>
  );
}

function VoiceCard({
  voice: v,
  active,
  playing,
  hasOverride,
  onPreview,
  onSet,
  onOpenParams,
}: {
  voice: AdminVoice;
  active: boolean;
  playing: boolean;
  hasOverride: boolean;
  onPreview: () => void;
  onSet: () => void;
  onOpenParams: () => void;
}) {
  return (
    <article
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          {v.isCustom && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent">
              🪪 Custom
            </span>
          )}
          {v.isItalianNative && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-700/40 text-emerald-300">
              🇮🇹 Native
            </span>
          )}
          {hasOverride && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-fuchsia-950/50 border border-fuchsia-700/40 text-fuchsia-200"
              title="Override parametri attivo per questa voce"
            >
              ● tuned
            </span>
          )}
        </div>
      </header>
      {v.descriptive && (
        <p className="text-xs text-muted-fg/60 line-clamp-2">
          {v.descriptive} {v.useCase ? `· ${v.useCase}` : ''}
        </p>
      )}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={playing}
          className="focus-accent flex-1 rounded-lg px-3 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50"
        >
          {playing ? '▶ in riproduzione…' : '▶ Anteprima'}
        </button>
        <button
          type="button"
          onClick={onOpenParams}
          aria-label={`Personalizza parametri di ${v.name}`}
          title="Parametri voce"
          className={[
            'focus-accent rounded-lg px-3 py-2 text-sm border',
            hasOverride
              ? 'bg-fuchsia-950/40 border-fuchsia-700/40 text-fuchsia-200 hover:bg-fuchsia-950/60'
              : 'bg-white/5 hover:bg-white/10 border-white/10',
          ].join(' ')}
        >
          ⚙
        </button>
        <button
          type="button"
          onClick={onSet}
          disabled={active}
          className="focus-accent rounded-lg px-3 py-2 text-sm bg-accent text-black font-medium disabled:opacity-50"
          aria-label={`Imposta ${v.name} come voce predefinita`}
        >
          {active ? 'In uso' : 'Imposta'}
        </button>
      </div>
    </article>
  );
}
