import { useEffect, useRef } from 'react';
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
 * `stop()` (called on barge-in / user voice start) clears the queue
 * AND aborts the current playback, as expected.
 */
export function useTts({ voiceId, enabled }: UseTtsOptions) {
  const playerRef = useRef<StreamingAudioPlayer | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const voiceIdRef = useRef(voiceId);
  const enabledRef = useRef(enabled);

  voiceIdRef.current = voiceId;
  enabledRef.current = enabled;

  useEffect(() => {
    const player = new StreamingAudioPlayer();
    playerRef.current = player;

    const drain = async (): Promise<void> => {
      if (playingRef.current) return;
      const next = queueRef.current.shift();
      if (!next) return;
      const vid = voiceIdRef.current;
      if (!enabledRef.current || !vid) {
        // Drop the queue if user disabled TTS while we had pending sentences
        queueRef.current = [];
        return;
      }
      playingRef.current = true;
      log.info('tts.speak', 'fetch', { voiceId: vid.slice(0, 8), len: next.length });
      try {
        const res = await fetchTts({ text: next, voiceId: vid, modelId: 'eleven_flash_v2_5' });
        // playStream resolves WHEN PLAYBACK STARTS, not when it ends.
        // We rely on the `ended` event (via onEnded below) to call drain again.
        await player.playStream(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        log.error('tts.speak', 'failed (skip)', { msg });
        playingRef.current = false;
        // try the next one immediately
        void drain();
      }
    };

    player.onEnded(() => {
      playingRef.current = false;
      void drain();
    });

    // expose drain for the speak closure below
    (player as unknown as { _drain: () => Promise<void> })._drain = drain;

    return () => {
      player.dispose();
      playerRef.current = null;
      queueRef.current = [];
      playingRef.current = false;
    };
  }, []);

  const speak = async (text: string): Promise<void> => {
    if (!enabledRef.current || !voiceIdRef.current || !text.trim()) return;
    queueRef.current.push(text.trim());
    const player = playerRef.current as
      | (StreamingAudioPlayer & { _drain?: () => Promise<void> })
      | null;
    await player?._drain?.();
  };

  const stop = (): void => {
    queueRef.current = [];
    playingRef.current = false;
    playerRef.current?.abort();
  };

  return { speak, stop };
}
