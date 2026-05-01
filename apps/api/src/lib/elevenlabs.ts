import type { TtsRequest } from '@cozza/shared';

interface ElevenStreamArgs extends TtsRequest {
  apiKey: string;
  signal?: AbortSignal;
}

/**
 * Calls ElevenLabs streaming TTS. Returns the raw fetch Response so the
 * Worker can pipe `body` straight back to the client (zero buffering).
 */
export async function streamElevenLabs(args: ElevenStreamArgs): Promise<Response> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(args.voiceId)}/stream?optimize_streaming_latency=4&output_format=mp3_44100_128`;
  const body = {
    text: args.text,
    model_id: args.modelId ?? 'eleven_flash_v2_5',
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.2,
      use_speaker_boost: true,
    },
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': args.apiKey,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
    ...(args.signal ? { signal: args.signal } : {}),
  });
}
