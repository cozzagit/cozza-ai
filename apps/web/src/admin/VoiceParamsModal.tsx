import { useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceSettingsOverride } from '@cozza/shared';
import {
  fetchVoicePreview,
  fetchVoiceSettings,
  type AdminVoice,
  type AdminVoiceSettings,
} from '@/lib/admin-api';
import { useSettingsStore } from '@/stores/settings';

interface VoiceParamsModalProps {
  voice: AdminVoice;
  onClose: () => void;
}

interface Preset {
  id: string;
  label: string;
  hint: string;
  values: VoiceSettingsOverride;
}

/**
 * Per-voice parameter editor. Reads the current ElevenLabs saved tuning
 * (used as the slider's "default") and lets the user override any subset
 * of stability / similarity / style / speed / speaker boost. Overrides
 * are stored locally in `voiceSettingsByVoice[voice.id]` and apply only
 * to that voice — switching to another voice gets its own override slot.
 *
 * "Anteprima con questi parametri" calls the admin preview endpoint with
 * the pending override so the user can A/B before saving.
 */
export function VoiceParamsModal({ voice, onClose }: VoiceParamsModalProps) {
  const stored = useSettingsStore((s) => s.voiceSettingsByVoice[voice.id]);
  const setVoiceSettings = useSettingsStore((s) => s.setVoiceSettings);
  const resetVoiceSettings = useSettingsStore((s) => s.resetVoiceSettings);

  // Local "draft" the user is editing. Initialized from the stored override
  // for this voice (or empty). Only persisted to the global store on Save.
  const [draft, setDraft] = useState<VoiceSettingsOverride>(stored ?? {});
  const [native, setNative] = useState<AdminVoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Reset draft if the voice prop changes (e.g. modal reopened on another voice).
  useEffect(() => {
    setDraft(stored ?? {});
    // intentionally not depending on `stored` so user edits survive
    // upstream re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.id]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchVoiceSettings(voice.id)
      .then((s) => {
        if (mounted) setNative(s);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : 'errore');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [voice.id]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const setKey = <K extends keyof VoiceSettingsOverride>(
    key: K,
    value: VoiceSettingsOverride[K] | undefined,
  ): void => {
    setDraft((prev) => {
      const next: VoiceSettingsOverride = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const playPreview = async (): Promise<void> => {
    audioRef.current?.pause();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPreviewing(true);
    try {
      const blob = await fetchVoicePreview(voice.id, { settings: draft });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'preview failed');
      setPreviewing(false);
    }
  };

  const save = (): void => {
    setVoiceSettings(voice.id, draft);
    onClose();
  };

  const resetAll = (): void => {
    setDraft({});
  };

  const removeStored = (): void => {
    resetVoiceSettings(voice.id);
    setDraft({});
  };

  const presets = useMemo<Preset[]>(
    () => [
      {
        id: 'native',
        label: 'Native',
        hint: 'usa i valori salvati su ElevenLabs',
        values: {},
      },
      {
        id: 'conversational',
        label: 'Conversational',
        hint: 'espressiva, parlata naturale',
        values: { stability: 0.4, similarityBoost: 0.75, style: 0.35, speed: 1.05 },
      },
      {
        id: 'narration',
        label: 'Narrazione',
        hint: 'stabile, lenta, neutra',
        values: { stability: 0.7, similarityBoost: 0.85, style: 0.0, speed: 0.95 },
      },
    ],
    [],
  );

  const draftKeys = Object.keys(draft).length;
  const isEdited = draftKeys > 0;
  const hasStored = Boolean(stored && Object.keys(stored).length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Parametri voce ${voice.name}`}
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-oled-200 border border-white/10 shadow-2xl">
        <header className="sticky top-0 z-10 bg-oled-200/95 backdrop-blur px-5 py-4 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-base truncate">⚙ {voice.name}</h2>
            <p className="text-xs text-muted-fg/70 truncate">
              {[voice.gender, voice.accent].filter(Boolean).join(' · ') || 'parametri ElevenLabs'}
              {hasStored && (
                <span className="ml-2 text-accent text-[10px] font-medium">● override attivo</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="text-muted-fg hover:text-white text-2xl leading-none px-2 -mt-1"
          >
            ×
          </button>
        </header>

        <div className="p-5 space-y-5">
          {loading && <p className="text-sm text-muted-fg">Carico parametri salvati…</p>}
          {error && (
            <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <p className="text-xs text-muted-fg/70 mb-2">Preset rapidi</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft(p.values)}
                  title={p.hint}
                  className="text-xs rounded-full px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <SliderRow
            label="Stability"
            hint="0 = espressivo, 1 = stabile/monotono"
            min={0}
            max={1}
            step={0.05}
            override={draft.stability}
            native={native?.stability ?? null}
            onChange={(v) => setKey('stability', v)}
          />
          <SliderRow
            label="Similarity boost"
            hint="aderenza al sample originale della voce"
            min={0}
            max={1}
            step={0.05}
            override={draft.similarityBoost}
            native={native?.similarityBoost ?? null}
            onChange={(v) => setKey('similarityBoost', v)}
          />
          <SliderRow
            label="Style"
            hint="esagerazione dello stile (solo Multilingual v2)"
            min={0}
            max={1}
            step={0.05}
            override={draft.style}
            native={native?.style ?? null}
            onChange={(v) => setKey('style', v)}
          />
          <SliderRow
            label="Speed"
            hint="0.7 lenta · 1.0 naturale · 1.2 veloce"
            min={0.7}
            max={1.2}
            step={0.01}
            override={draft.speed}
            native={native?.speed ?? null}
            onChange={(v) => setKey('speed', v)}
          />

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-white/5 cursor-pointer">
            <span className="text-sm">
              Speaker boost <span className="text-muted-fg/60">(chiarezza)</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-fg/60">
                default:{' '}
                {native?.useSpeakerBoost === true
                  ? 'on'
                  : native?.useSpeakerBoost === false
                    ? 'off'
                    : '—'}
              </span>
              <input
                type="checkbox"
                checked={draft.useSpeakerBoost === true}
                onChange={(e) => {
                  if (e.target.checked) setKey('useSpeakerBoost', true);
                  else if (draft.useSpeakerBoost !== undefined) setKey('useSpeakerBoost', false);
                  else setKey('useSpeakerBoost', undefined);
                }}
                className="accent-accent w-4 h-4"
              />
            </div>
          </label>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resetAll}
              disabled={!isEdited}
              className="text-xs rounded-md px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40"
            >
              Azzera draft
            </button>
            {hasStored && (
              <button
                type="button"
                onClick={removeStored}
                className="text-xs rounded-md px-3 py-1.5 bg-red-950/40 hover:bg-red-950/60 text-red-200 border border-red-900/40"
              >
                Rimuovi override salvato
              </button>
            )}
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 bg-oled-200/95 backdrop-blur px-5 py-3 border-t border-white/5 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => void playPreview()}
            disabled={previewing || loading}
            className="focus-accent rounded-lg px-4 py-2 text-sm bg-white/10 hover:bg-white/15 disabled:opacity-50"
          >
            {previewing ? '▶ in riproduzione…' : '▶ Anteprima con questi parametri'}
          </button>
          <button
            type="button"
            onClick={save}
            className="focus-accent rounded-lg px-4 py-2 text-sm bg-accent text-black font-medium"
          >
            {isEdited ? 'Salva' : 'Salva (nessun override)'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  hint,
  min,
  max,
  step,
  override,
  native,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  override: number | undefined;
  native: number | null;
  onChange: (v: number | undefined) => void;
}) {
  const effective = override ?? native ?? (min + max) / 2;
  const isOverridden = override !== undefined;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-fg/60">{hint}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">
            {effective.toFixed(2)}
            {isOverridden && <span className="text-accent ml-1">●</span>}
          </div>
          <div className="text-[10px] text-muted-fg/50">
            {isOverridden ? 'override' : `default: ${native?.toFixed(2) ?? '—'}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={effective}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        {isOverridden && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            title="Rimuovi override per questo parametro"
            className="text-xs text-muted-fg/70 hover:text-white px-2"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
