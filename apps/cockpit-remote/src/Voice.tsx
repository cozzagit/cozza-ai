import { useEffect, useRef, useState } from 'react';

interface VoiceProps {
  onCommand: (cmd: { target: string; command: string; args?: Record<string, unknown> }) => void;
}

const WAKE_WORD_PATTERN = /\b(?:hey|ehi|ehy|ok|okay|ciao)?\s*cozza\b/i;

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

/**
 * Voice command — uses the platform Web Speech API (Pixel 4+ supports it
 * out of the box on Chrome/Vivaldi). Maps a small set of italian phrases
 * to cockpit commands; everything else is shown as transcript only.
 *
 * Recognized intents:
 *   "vitals" / "stato" / "salute"        → hud.setMode { mode: 'vitals' }
 *   "stream"                              → hud.setMode { mode: 'stream' }
 *   "log" / "logs"                        → hud.setMode { mode: 'logs' }
 *   "metriche"                            → hud.setMode { mode: 'metrics' }
 *   "diff" / "git"                        → hud.setMode { mode: 'diff' }
 *   "ambient" / "pausa"                   → hud.setMode { mode: 'ambient' }
 *   "pomodoro"                            → hud.setMode { mode: 'pomodoro' }
 *   "spesa" / "budget"                    → hud.setMode { mode: 'spend' }
 *   "tema" / "cambia tema"                → hud.toggleTheme
 *   "cyber" / "cyberpunk"                 → hud.setTheme { theme: 'cyberpunk' }
 *   "bauhaus"                             → hud.setTheme { theme: 'bauhaus' }
 *   "deploy"                              → desktop.deploy:vps
 *   "stop" / "kill"                       → desktop.killswitch
 */
export function Voice({ onCommand }: VoiceProps) {
  const [listening, setListening] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [armed, setArmed] = useState(false); // wake-word triggered, awaiting command
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const alwaysOnRef = useRef(alwaysOn);
  const armedRef = useRef(armed);
  alwaysOnRef.current = alwaysOn;
  armedRef.current = armed;
  // Mirror handleTranscript in a ref so the recognition `onresult`
  // closure (set up once) always invokes the latest version without
  // re-binding when callbacks change.
  const handleTranscriptRef = useRef<(t: string) => void>(() => undefined);

  useEffect(() => {
    const Ctor: { new (): SpeechRecognitionLike } | undefined =
      (window as unknown as { SpeechRecognition?: { new (): SpeechRecognitionLike } })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognitionLike } })
        .webkitSpeechRecognition;
    if (!Ctor) {
      setError('SpeechRecognition non supportato in questo browser');
      return;
    }
    const r = new Ctor();
    // continuous=true is the wake-word always-on mode; switched per session
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'it-IT';
    r.onresult = (e: SpeechRecognitionEventLike) => {
      const idx = e.resultIndex;
      const result = e.results[idx];
      if (!result) return;
      const text = result[0].transcript.trim().toLowerCase();
      setTranscript(text);
      handleTranscriptRef.current(text);
    };
    r.onerror = () => {
      // In always-on mode browser may emit `no-speech` when silence — ignore
      if (!alwaysOnRef.current) setError('errore di riconoscimento');
    };
    r.onend = () => {
      setListening(false);
      setArmed(false);
      // Always-on: restart automatically after natural end (browser may
      // close the recognition after ~60s of silence on Chrome)
      if (alwaysOnRef.current) {
        setTimeout(() => {
          try {
            r.start();
            setListening(true);
          } catch {
            // already started
          }
        }, 400);
      }
    };
    recRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        // noop
      }
    };
  }, [onCommand]);

  // Update the ref each render so the closure inside onresult sees the
  // latest onCommand handler. eslint-disable-next-line so the function
  // can capture closures freely without forcing useCallback churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    handleTranscriptRef.current = handleTranscript;
  });

  const handleTranscript = (text: string): void => {
    // Always-on flow: split on wake-word boundary
    if (alwaysOnRef.current) {
      const wakeMatch = WAKE_WORD_PATTERN.exec(text);
      if (!wakeMatch) {
        // No wake word — ignore unless we were armed for a follow-up
        if (armedRef.current) {
          const cmd = interpret(text);
          if (cmd) {
            haptic();
            onCommand(cmd);
          }
          setArmed(false);
        }
        return;
      }
      // Wake detected → take everything AFTER the wake word as the command
      const after = text.slice(wakeMatch.index + wakeMatch[0].length).trim();
      if (after) {
        haptic();
        const cmd = interpret(after);
        if (cmd) onCommand(cmd);
        setArmed(false);
      } else {
        // Just "ehi cozza" with no follow-up → arm for next utterance
        setArmed(true);
        haptic();
      }
      return;
    }
    // Push-to-talk legacy: any utterance is a command attempt
    const cmd = interpret(text);
    if (cmd) onCommand(cmd);
  };

  const haptic = (): void => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(15);
  };

  const startOnce = (): void => {
    setError(null);
    setTranscript('');
    setListening(true);
    try {
      recRef.current?.start();
    } catch {
      setListening(false);
    }
  };

  const toggleAlwaysOn = (): void => {
    setError(null);
    if (alwaysOn) {
      setAlwaysOn(false);
      try {
        recRef.current?.stop();
      } catch {
        // noop
      }
      setListening(false);
      setArmed(false);
    } else {
      setAlwaysOn(true);
      try {
        recRef.current?.start();
        setListening(true);
      } catch {
        // already running
      }
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider">Voice command</h2>

      <button
        type="button"
        onClick={toggleAlwaysOn}
        disabled={!!error}
        className={[
          'w-full rounded-xl py-4 text-sm font-mono uppercase tracking-wider',
          alwaysOn ? 'bg-accent text-black font-semibold' : 'surface',
          error ? 'opacity-50' : '',
        ].join(' ')}
      >
        {alwaysOn ? '👂 always-on attivo · "ehi cozza"' : '👂 attiva always-on'}
      </button>

      <button
        type="button"
        onClick={startOnce}
        disabled={listening || !!error || alwaysOn}
        className={[
          'w-full rounded-xl py-10 text-2xl text-center surface',
          listening && !alwaysOn ? 'animate-pulse' : '',
          error || alwaysOn ? 'opacity-40' : '',
        ].join(' ')}
      >
        {alwaysOn
          ? armed
            ? '🎙 ascolto comando…'
            : '👂 in attesa di "ehi cozza"'
          : listening
            ? '🎙 ascolto…'
            : '🎤 push-to-talk'}
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}
      {transcript && (
        <article className="surface rounded-xl p-3 font-mono text-xs space-y-1">
          <div className="opacity-60">trascrizione:</div>
          <div>{transcript}</div>
        </article>
      )}
      <div className="text-[11px] opacity-50 leading-relaxed">
        <strong>Cockpit:</strong> vitals, stream, logs, diff, metriche, pausa, pomodoro, budget,
        cambia tema, cyber, bauhaus, deploy, stop.
        <br />
        <strong>Apps:</strong> <em>metti netflix</em>, <em>apri dazn</em>,{' '}
        <em>guardiamo youtube</em>, <em>lancia spotify</em>, <em>torna al cockpit</em>,{' '}
        <em>chiudi</em>.
      </div>
    </div>
  );
}

interface InterpretedCmd {
  target: string;
  command: string;
  args?: Record<string, unknown>;
}

/**
 * Map of voice phrase → app preset, ordered by specificity (longer
 * phrases first so "prime video" matches before "prime").
 */
const APP_INTENT_MAP: Array<{ pattern: RegExp; preset: string }> = [
  { pattern: /\b(prime\s*video|amazon\s*prime)\b/, preset: 'prime' },
  { pattern: /\bnetflix\b/, preset: 'netflix' },
  { pattern: /\b(dazn|sport)\b/, preset: 'dazn' },
  { pattern: /\b(disney\+?|disney\s*plus)\b/, preset: 'disney' },
  { pattern: /\b(spotify|musica)\b/, preset: 'spotify' },
  { pattern: /\byou\s*tube\b/, preset: 'youtube' },
  { pattern: /\btwitch\b/, preset: 'twitch' },
];

/**
 * Match phrases like "metti netflix", "guardiamo dazn", "apri youtube",
 * "metti su prime", "lancia spotify". Returns the matched preset or null.
 */
function matchAppOpen(t: string): string | null {
  if (!/\b(metti|apri|avvia|lancia|guardiamo|guarda|fai\s*partire|metti\s*su|vai\s*su)\b/.test(t)) {
    // Allow bare "netflix" too if surrounding cue absent — user might
    // just say the app name. Only triggers if no other intent matched.
    for (const it of APP_INTENT_MAP) if (it.pattern.test(t)) return it.preset;
    return null;
  }
  for (const it of APP_INTENT_MAP) if (it.pattern.test(t)) return it.preset;
  return null;
}

function interpret(text: string): InterpretedCmd | null {
  const t = text.toLowerCase();
  const setHudMode = (mode: string): InterpretedCmd => ({
    target: 'hud',
    command: 'hud.setMode',
    args: { mode },
  });

  // Close / back-to-cockpit (must come before "stream" etc. to win)
  if (/\b(torna\s*al?\s*cockpit|chiudi\s*app|chiudi|esci|back|fine)\b/.test(t)) {
    // First, tell HUD to leave the app, then put the Pixel back to home.
    // We can only return one command at a time from this layer; the
    // caller already broadcasts; we add a follow-up via setTimeout in
    // App.tsx. Keep it simple: emit `app.close` and have HUD also
    // broadcast remote.setMode home (TODO).
    return { target: 'hud', command: 'app.close' };
  }

  // Apps: most specific cue wins
  const preset = matchAppOpen(t);
  if (preset) {
    return { target: 'all', command: 'app.open', args: { preset } };
  }

  if (/\b(vitals|stato|salute|health)\b/.test(t)) return setHudMode('vitals');
  if (/\bstream\b/.test(t)) return setHudMode('stream');
  if (/\blog\b/.test(t)) return setHudMode('logs');
  if (/\b(metric|metriche)\b/.test(t)) return setHudMode('metrics');
  if (/\b(diff|git)\b/.test(t)) return setHudMode('diff');
  if (/\b(ambient|pausa|relax)\b/.test(t)) return setHudMode('ambient');
  if (/\b(pomodoro|pomo)\b/.test(t)) return setHudMode('pomodoro');
  if (/\b(spesa|budget|spend|costo)\b/.test(t)) return setHudMode('spend');
  if (/\b(devstation|stazione|lavoro)\b/.test(t)) return setHudMode('devstation');
  if (/\b(tema|cambia\s*tema|toggle\s*theme)\b/.test(t))
    return { target: 'hud', command: 'hud.toggleTheme' };
  if (/\b(cyber|punk)\b/.test(t))
    return { target: 'hud', command: 'hud.setTheme', args: { theme: 'cyberpunk' } };
  if (/\b(bauhaus|mono)\b/.test(t))
    return { target: 'hud', command: 'hud.setTheme', args: { theme: 'bauhaus' } };
  if (/\bdeploy\b/.test(t)) return { target: 'desktop', command: 'desktop.deploy' };
  if (/\b(stop|kill)\b/.test(t)) return { target: 'all', command: 'killswitch' };
  return null;
}
