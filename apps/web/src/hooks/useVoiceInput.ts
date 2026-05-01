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

    rec.onstart = () => setState('listening');
    rec.onend = () => {
      setState((s) => (s === 'listening' ? 'idle' : s));
    };
    rec.onerror = () => {
      setState('idle');
    };
    rec.onresult = (event: Event) => {
      // SpeechRecognitionEvent
      const ev = event as Event & {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
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
        setInterim(interimText);
        onInterimResult?.(interimText);
      }
      if (finalText) {
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
