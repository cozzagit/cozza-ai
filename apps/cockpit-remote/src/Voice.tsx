import { useEffect, useRef, useState } from 'react';

interface VoiceProps {
  onCommand: (cmd: { target: string; command: string; args?: Record<string, unknown> }) => void;
}

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
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

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
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'it-IT';
    r.onresult = (e: SpeechRecognitionEventLike) => {
      const idx = e.resultIndex;
      const result = e.results[idx];
      if (!result) return;
      const text = result[0].transcript.trim().toLowerCase();
      setTranscript(text);
      const cmd = interpret(text);
      if (cmd) onCommand(cmd);
    };
    r.onerror = () => setError('errore di riconoscimento');
    r.onend = () => setListening(false);
    recRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        // noop
      }
    };
  }, [onCommand]);

  const start = (): void => {
    setError(null);
    setTranscript('');
    setListening(true);
    try {
      recRef.current?.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="display text-sm opacity-70 uppercase tracking-wider">Voice command</h2>
      <button
        type="button"
        onClick={start}
        disabled={listening || !!error}
        className={[
          'w-full rounded-xl py-12 text-3xl text-center surface',
          listening ? 'animate-pulse' : '',
          error ? 'opacity-50' : '',
        ].join(' ')}
      >
        {listening ? '🎙 ascolto…' : '🎤 parla'}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {transcript && (
        <article className="surface rounded-xl p-3 font-mono text-xs space-y-1">
          <div className="opacity-60">trascrizione:</div>
          <div>{transcript}</div>
        </article>
      )}
      <div className="text-[11px] opacity-50 leading-relaxed">
        Esempi: <em>vitals</em>, <em>stream</em>, <em>logs</em>, <em>metriche</em>, <em>diff</em>,{' '}
        <em>pausa</em>, <em>pomodoro</em>, <em>budget</em>, <em>cambia tema</em>, <em>cyber</em>,{' '}
        <em>bauhaus</em>, <em>deploy</em>, <em>stop</em>.
      </div>
    </div>
  );
}

interface InterpretedCmd {
  target: string;
  command: string;
  args?: Record<string, unknown>;
}

function interpret(text: string): InterpretedCmd | null {
  const t = text.toLowerCase();
  const setHudMode = (mode: string): InterpretedCmd => ({
    target: 'hud',
    command: 'hud.setMode',
    args: { mode },
  });
  if (/(vitals|stato|salute|health)/.test(t)) return setHudMode('vitals');
  if (/(stream)/.test(t)) return setHudMode('stream');
  if (/(log)/.test(t)) return setHudMode('logs');
  if (/(metric|metriche)/.test(t)) return setHudMode('metrics');
  if (/(diff|git)/.test(t)) return setHudMode('diff');
  if (/(ambient|pausa|relax)/.test(t)) return setHudMode('ambient');
  if (/(pomodoro|pomo)/.test(t)) return setHudMode('pomodoro');
  if (/(spesa|budget|spend|costo)/.test(t)) return setHudMode('spend');
  if (/(tema|cambia tema|toggle theme)/.test(t))
    return { target: 'hud', command: 'hud.toggleTheme' };
  if (/(cyber|punk)/.test(t))
    return { target: 'hud', command: 'hud.setTheme', args: { theme: 'cyberpunk' } };
  if (/(bauhaus|mono)/.test(t))
    return { target: 'hud', command: 'hud.setTheme', args: { theme: 'bauhaus' } };
  if (/(deploy)/.test(t)) return { target: 'desktop', command: 'desktop.deploy' };
  if (/(stop|kill)/.test(t)) return { target: 'all', command: 'killswitch' };
  return null;
}
