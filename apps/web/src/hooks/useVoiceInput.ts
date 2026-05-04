import { useCallback, useEffect, useRef, useState } from 'react';
import { log } from '@/lib/debug-log';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'unsupported';

interface UseVoiceInputOptions {
  lang?: string;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onnomatch?: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function useVoiceInput(opts: UseVoiceInputOptions = {}) {
  const { lang = 'it-IT', onFinalResult, onInterimResult } = opts;
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      log.warn('voice', 'SpeechRecognition not supported in this browser');
      setState('unsupported');
      return;
    }
    const rec = new Ctor();
    // Push-to-talk: true so the recognition stays open until WE call
    // stop(). With `false` Chrome auto-closes the session on the first
    // pause (sometimes within a fraction of a second on PC, before any
    // audio is captured), which manifests as `recognition ended` with
    // 0/0 lengths immediately after `recognition started`.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;

    // Accumulators that survive across `onresult` invocations within a
    // single recognition session. Cleared on `start()`. Used by `onend`
    // to fall back to the latest interim text if the browser closes the
    // session before flagging `isFinal=true` (common on Android Chrome
    // when the user releases the mic button quickly).
    let lastFinal = '';
    let lastInterim = '';
    let alreadyEmitted = false;

    rec.onstart = () => {
      log.info('voice', 'recognition started', { lang });
      setState('listening');
      lastFinal = '';
      lastInterim = '';
      alreadyEmitted = false;
    };
    // Diagnostic: log every audio-pipeline phase so we can see exactly
    // where the recognition stops getting input.
    rec.onaudiostart = () => log.info('voice', 'audio capture started');
    rec.onsoundstart = () => log.info('voice', 'sound detected');
    rec.onspeechstart = () => log.info('voice', 'speech detected');
    rec.onspeechend = () => log.info('voice', 'speech ended');
    rec.onsoundend = () => log.info('voice', 'sound ended');
    rec.onaudioend = () => log.info('voice', 'audio capture ended');
    rec.onnomatch = () => log.warn('voice', 'no match (recognition heard but cannot transcribe)');
    rec.onend = () => {
      log.info('voice', 'recognition ended', {
        emitted: alreadyEmitted,
        finalLen: lastFinal.length,
        interimLen: lastInterim.length,
      });
      // If the browser closed the session before emitting a final
      // transcript, treat the most recent interim as final so the
      // message actually gets sent. Without this, short utterances
      // disappear because `rec.stop()` outraces `isFinal=true`.
      if (!alreadyEmitted) {
        const fallback = (lastFinal || lastInterim).trim();
        if (fallback) {
          alreadyEmitted = true;
          setInterim('');
          setState('processing');
          log.info('voice', 'flushing interim as final', { len: fallback.length });
          onFinalResult?.(fallback);
          return;
        }
      }
      setState((s) => (s === 'listening' ? 'idle' : s));
    };
    rec.onerror = (event: Event) => {
      // SpeechRecognitionError carries `error` ('no-speech', 'audio-capture',
      // 'not-allowed', 'network', 'aborted', 'language-not-supported', …)
      const err = (event as Event & { error?: string; message?: string }).error;
      const msg = (event as Event & { error?: string; message?: string }).message;
      log.error('voice', `recognition error: ${err ?? 'unknown'}`, {
        error: err,
        message: msg,
      });
      setState('idle');
    };
    rec.onresult = (event: Event) => {
      // SpeechRecognitionEvent
      const ev = event as Event & {
        resultIndex: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
        >;
      };
      let interimText = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (!res) continue;
        const alt = res[0];
        if (!alt) continue;
        if (res.isFinal) finalText += alt.transcript;
        else interimText += alt.transcript;
      }
      if (interimText) {
        lastInterim = interimText;
        setInterim(interimText);
        onInterimResult?.(interimText);
      }
      if (finalText) {
        lastFinal = finalText;
        alreadyEmitted = true;
        setInterim('');
        setState('processing');
        onFinalResult?.(finalText.trim());
      }
    };

    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
      recRef.current = null;
    };
  }, [lang, onFinalResult, onInterimResult]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) {
      log.warn('voice', 'start ignored: recognition not initialised');
      return;
    }
    log.info('voice', 'start requested');
    // Pre-warm microphone permission. Web Speech on Android Chrome
    // sometimes silently no-ops the very first start() until
    // getUserMedia has been resolved at least once in the session.
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // We don't need the audio stream — Web Speech opens its own —
          // but we keep the permission warmed. Release immediately.
          stream.getTracks().forEach((t) => t.stop());
        })
        .catch((err: unknown) => {
          log.error('voice', 'getUserMedia denied', {
            err: err instanceof Error ? err.message : String(err),
          });
        });
    }
    try {
      setInterim('');
      rec.start();
    } catch (e) {
      log.warn('voice', 'rec.start() threw (probably already running)', {
        err: e instanceof Error ? e.message : 'unknown',
      });
    }
  }, []);

  const stop = useCallback(() => {
    log.info('voice', 'stop requested');
    recRef.current?.stop();
  }, []);

  return { state, interim, start, stop };
}
