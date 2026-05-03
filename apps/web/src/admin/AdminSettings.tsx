import { useEffect, useState } from 'react';
import { ChatModelSchema, type ChatModel, type VoiceSettingsOverride } from '@cozza/shared';
import { useSettingsStore } from '@/stores/settings';
import { fetchVoiceSettings } from '@/lib/admin-api';

const MODELS: { id: ChatModel; label: string; hint: string }[] = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'rapido + economico (Anthropic)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', hint: 'completo (Anthropic)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', hint: 'rapido + economico (OpenAI)' },
  { id: 'gpt-4o', label: 'GPT-4o', hint: 'top OpenAI' },
];

const STT_LANGS: { id: string; label: string }[] = [
  { id: 'it-IT', label: 'Italiano (Italia)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'es-ES', label: 'Español' },
  { id: 'fr-FR', label: 'Français' },
  { id: 'de-DE', label: 'Deutsch' },
];

export function AdminSettings() {
  const s = useSettingsStore();

  return (
    <div className="space-y-8">
      <Section
        title="Modello AI predefinito"
        hint="Quale modello usa cozza-ai all'avvio della chat."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODELS.map((m) => {
            const active = s.defaultModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => s.setDefaultModel(m.id)}
                className={[
                  'focus-accent text-left rounded-xl p-3 border transition-colors',
                  active ? 'bg-accent/15 border-accent/50' : 'glass-surface hover:bg-white/5',
                ].join(' ')}
              >
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-xs text-muted-fg/70 mt-0.5">{m.hint}</div>
                {active && (
                  <div className="mt-2 text-[10px] text-accent font-medium">✓ ATTUALE</div>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Persona / system prompt"
        hint="Iniettato come messaggio di sistema in ogni nuova conversazione."
      >
        <textarea
          rows={6}
          value={s.personaPrompt}
          onChange={(e) => s.setPersonaPrompt(e.target.value)}
          className="w-full glass-surface rounded-lg p-3 text-sm font-mono outline-none focus:border-accent/40 resize-y min-h-[120px]"
        />
        <p className="text-xs text-muted-fg/50 mt-1">
          Caratteri: <span className="font-mono">{s.personaPrompt.length}</span> · Lascia vuoto per
          nessun system prompt.
        </p>
      </Section>

      <Section title="Temperature" hint="0 = deterministico, 1 = bilanciato, 2 = creativo">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={s.temperature}
            onChange={(e) => s.setTemperature(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="font-mono text-sm w-12 text-right">{s.temperature.toFixed(1)}</span>
        </div>
      </Section>

      <Section
        title="Pannello visivi"
        hint="L'AI può sempre sbagliare a includere visivi. Quando attivo, dopo ogni risposta un secondo modello veloce (Claude Haiku) genera in background un image-prompt e/o un mermaid mancante. Costo trascurabile (~$0.001 per messaggio)."
      >
        <Toggle
          label="Auto-enrich: garantisci sempre almeno un visivo"
          checked={s.autoEnrichVisuals}
          onChange={s.setAutoEnrichVisuals}
        />
      </Section>

      <VoiceParamsSection />

      <Section title="Voice loop" hint="Controlli del riconoscimento vocale e della sintesi.">
        <div className="space-y-3">
          <Toggle
            label="Sintesi vocale (TTS) automatica"
            checked={s.ttsAutoplay}
            onChange={s.setTtsAutoplay}
          />
          <Toggle
            label="Barge-in (interrompi voce parlando)"
            checked={s.bargeIn}
            onChange={s.setBargeIn}
          />
          <Toggle
            label="Riconoscimento vocale abilitato"
            checked={s.voiceEnabled}
            onChange={s.setVoiceEnabled}
          />
          <Field label="Lingua riconoscimento (STT)">
            <select
              value={s.sttLang}
              onChange={(e) => s.setSttLang(e.target.value)}
              className="glass-surface rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/40 w-full"
            >
              {STT_LANGS.map((l) => (
                <option key={l.id} value={l.id} className="bg-oled-100">
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Voice ID ElevenLabs (vai in Voci per cambiarla)">
            <input
              readOnly
              value={s.voiceId || '— nessuna —'}
              className="glass-surface rounded-lg px-3 py-2 text-sm outline-none font-mono w-full opacity-70"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Reset"
        hint="Riporta tutte le impostazioni ai valori di default. Le conversazioni non vengono cancellate."
      >
        <button
          type="button"
          onClick={() => {
            if (!confirm('Reset di tutte le impostazioni ai valori di default?')) return;
            const def = MODELS[0]?.id ?? ('gpt-4o-mini' as ChatModel);
            s.setDefaultModel(
              ChatModelSchema.options.includes('gpt-4o-mini') ? 'gpt-4o-mini' : def,
            );
            s.setVoiceEnabled(true);
            s.setTtsAutoplay(true);
            s.setBargeIn(true);
            s.setSttLang('it-IT');
            s.setTemperature(0.7);
          }}
          className="rounded-lg px-3 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10"
        >
          Reset impostazioni
        </button>
      </Section>
    </div>
  );
}

function VoiceParamsSection() {
  const voiceId = useSettingsStore((s) => s.voiceId);
  const override = useSettingsStore((s) => s.voiceSettingsOverride);
  const setOverride = useSettingsStore((s) => s.setVoiceSettingsOverride);
  const resetOverride = useSettingsStore((s) => s.resetVoiceSettingsOverride);

  const [native, setNative] = useState<{
    stability: number | null;
    similarityBoost: number | null;
    style: number | null;
    useSpeakerBoost: boolean | null;
    speed: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voiceId) {
      setNative(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchVoiceSettings(voiceId)
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
  }, [voiceId]);

  const setKey = <K extends keyof VoiceSettingsOverride>(
    key: K,
    value: VoiceSettingsOverride[K] | undefined,
  ): void => {
    const next: VoiceSettingsOverride = { ...override };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setOverride(next);
  };

  const fmt = (n: number | null | undefined): string =>
    typeof n === 'number' ? n.toFixed(2) : '—';

  return (
    <Section
      title="Parametri voce"
      hint="Override locali del tuning ElevenLabs. Lascia un cursore al suo default ('—') per usare il valore salvato sulla voce. I valori live mostrati sono quelli che la voce ha attualmente su ElevenLabs."
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-fg/70">
          Voce attiva: <span className="font-mono text-accent">{voiceId || '— nessuna —'}</span>
          {loading && <span className="ml-2">· carico settings…</span>}
          {error && <span className="ml-2 text-red-300">· {error}</span>}
        </p>

        <SliderRow
          label="Stability"
          hint="0 = espressivo, 1 = stabile/monotono"
          min={0}
          max={1}
          step={0.05}
          override={override.stability}
          native={native?.stability ?? null}
          onChange={(v) => setKey('stability', v)}
        />
        <SliderRow
          label="Similarity boost"
          hint="Aderenza al sample originale della voce"
          min={0}
          max={1}
          step={0.05}
          override={override.similarityBoost}
          native={native?.similarityBoost ?? null}
          onChange={(v) => setKey('similarityBoost', v)}
        />
        <SliderRow
          label="Style"
          hint="Esagerazione dello stile del sample (solo Multilingual v2)"
          min={0}
          max={1}
          step={0.05}
          override={override.style}
          native={native?.style ?? null}
          onChange={(v) => setKey('style', v)}
        />
        <SliderRow
          label="Speed"
          hint="0.7 = lenta, 1.0 = naturale, 1.2 = veloce"
          min={0.7}
          max={1.2}
          step={0.01}
          override={override.speed}
          native={native?.speed ?? null}
          onChange={(v) => setKey('speed', v)}
        />

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={override.useSpeakerBoost === true}
              onChange={(e) => {
                if (e.target.checked) setKey('useSpeakerBoost', true);
                else if (override.useSpeakerBoost !== undefined) setKey('useSpeakerBoost', false);
                else setKey('useSpeakerBoost', undefined);
              }}
              className="accent-accent w-4 h-4"
            />
            <span>Speaker boost (chiarezza)</span>
            <span className="text-xs text-muted-fg/60">
              · default:{' '}
              {native?.useSpeakerBoost === true
                ? 'on'
                : native?.useSpeakerBoost === false
                  ? 'off'
                  : '—'}
            </span>
          </label>
          <button
            type="button"
            onClick={resetOverride}
            className="text-xs rounded-md px-3 py-1.5 bg-white/5 hover:bg-white/10"
          >
            Ripristina default voce
          </button>
        </div>

        {native && (
          <details className="text-xs text-muted-fg/60">
            <summary className="cursor-pointer">Valori salvati su ElevenLabs</summary>
            <pre className="mt-2 font-mono text-[10px] bg-oled-100/40 rounded p-2">
              {JSON.stringify(
                {
                  stability: fmt(native.stability),
                  similarity_boost: fmt(native.similarityBoost),
                  style: fmt(native.style),
                  speed: fmt(native.speed),
                  use_speaker_boost: native.useSpeakerBoost,
                },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </div>
    </Section>
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
            {isOverridden ? 'override locale' : `default ElevenLabs: ${native?.toFixed(2) ?? '—'}`}
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-fg/70">{hint}</p>}
      <div className="pt-1">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'focus-accent w-11 h-6 rounded-full transition-colors relative',
          checked ? 'bg-accent' : 'bg-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-fg/70 mb-1">{label}</label>
      {children}
    </div>
  );
}
