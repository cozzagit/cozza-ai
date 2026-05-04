import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'unsupported';

interface UseVoiceInputOptions {
  lang?: string;
  onFinalResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: (() => void) | null;
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
      setState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
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
      setState('listening');
      lastFinal = '';
      lastInterim = '';
      alreadyEmitted = false;
    };
    rec.onend = () => {
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
          onFinalResult?.(fallback);
          return;
        }
      }
      setState((s) => (s === 'listening' ? 'idle' : s));
    };
    rec.onerror = () => {
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
    if (!rec) return;
    try {
      setInterim('');
      rec.start();
    } catch {
      // already started
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  return { state, interim, start, stop };
}
