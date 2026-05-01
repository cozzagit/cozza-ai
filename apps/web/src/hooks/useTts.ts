import { useEffect, useRef } from 'react';
import { fetchTts } from '@/lib/api';
import { StreamingAudioPlayer } from '@/lib/audio';

interface UseTtsOptions {
  voiceId: string;
  enabled: boolean;
}

export function useTts({ voiceId, enabled }: UseTtsOptions) {
  const playerRef = useRef<StreamingAudioPlayer | null>(null);

  useEffect(() => {
    playerRef.current = new StreamingAudioPlayer();
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const speak = async (text: string): Promise<void> => {
    if (!enabled || !voiceId || !text.trim() || !playerRef.current) return;
    try {
      const res = await fetchTts({ text, voiceId, modelId: 'eleven_flash_v2_5' });
      await playerRef.current.playStream(res);
    } catch (e) {
      // graceful: log and continue, never break chat for TTS failures
      console.warn('[tts] failed', e);
    }
  };

  const stop = (): void => {
    playerRef.current?.abort();
  };

  return { speak, stop };
}
