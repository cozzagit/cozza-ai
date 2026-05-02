import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTts } from '@/lib/api';
import { StreamingAudioPlayer } from '@/lib/audio';
import { log } from '@/lib/debug-log';

interface UseTtsOptions {
  voiceId: string;
  enabled: boolean;
}

/**
 * Voice playback with a sentence queue.
 *
 * The chat hook calls `speak()` once per sentence as soon as the
 * sentence chunker emits one (within ~300ms of the first delta).
 * We MUST NOT abort the in-flight sentence when a new one arrives,
 * otherwise only the last sentence is fully audible. Instead we
 * queue and play sequentially, draining on each `ended` event.
 *
 * `stop()` (barge-in / user voice start / explicit user click)
 * clears the queue AND aborts the current playback.
 *
 * `isPlaying` is reactive and reflects "queue not empty OR audio
 * currently playing", so the UI can show stop/play toggles.
 */
export function useTts({ voiceId, enabled }: UseTtsOptions) {
  const playerRef = useRef<StreamingAudioPlayer | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const voiceIdRef = useRef(voiceId);
  const enabledRef = useRef(enabled);
  const [isPlaying, setIsPlaying] = useState(false);

  voiceIdRef.current = voiceId;
  enabledRef.current = enabled;

  const setPlaying = useCallback((v: boolean) => {
    playingRef.current = v;
    setIsPlaying(v);
  }, []);

  useEffect(() => {
    const player = new StreamingAudioPlayer();
    playerRef.current = player;

    const drain = async (): Promise<void> => {
      if (playingRef.current) return;
      const next = queueRef.current.shift();
      if (!next) {
        setIsPlaying(false);
        return;
      }
      const vid = voiceIdRef.current;
      if (!enabledRef.current || !vid) {
        // Drop the queue if user disabled TTS while we had pending sentences
        queueRef.current = [];
        setIsPlaying(false);
        return;
      }
      setPlaying(true);
      log.info('tts.speak', 'fetch', { voiceId: vid.slice(0, 8), len: next.length });
      try {
        const res = await fetchTts({ text: next, voiceId: vid, modelId: 'eleven_flash_v2_5' });
        await player.playStream(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        log.error('tts.speak', 'failed (skip)', { msg });
        setPlaying(false);
        void drain();
      }
    };

    player.onEnded(() => {
      setPlaying(false);
      void drain();
    });

    (player as unknown as { _drain: () => Promise<void> })._drain = drain;

    return () => {
      player.dispose();
      playerRef.current = null;
      queueRef.current = [];
      playingRef.current = false;
      setIsPlaying(false);
    };
  }, [setPlaying]);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!enabledRef.current || !voiceIdRef.current || !text.trim()) return;
    queueRef.current.push(text.trim());
    setIsPlaying(true);
    const player = playerRef.current as
      | (StreamingAudioPlayer & { _drain?: () => Promise<void> })
      | null;
    await player?._drain?.();
  }, []);

  const stop = useCallback((): void => {
    queueRef.current = [];
    playerRef.current?.abort();
    setPlaying(false);
    log.info('tts.stop', 'user');
  }, [setPlaying]);

  return { speak, stop, isPlaying };
}
