import type { TtsRequest, VoiceSettingsOverride } from '@cozza/shared';

interface ElevenStreamArgs extends TtsRequest {
  apiKey: string;
  signal?: AbortSignal;
}

/**
 * Calls ElevenLabs streaming TTS. Returns the raw fetch Response so the
 * Worker can pipe `body` straight back to the client (zero buffering).
 *
 * IMPORTANT: we DO NOT send a hard-coded `voice_settings` block when
 * none is supplied, otherwise ElevenLabs would override the user's
 * custom-saved tuning per voice (stability / similarity_boost / style /
 * speed). When the client passes `settings`, only the fields it actually
 * provides are forwarded — partial override.
 */
export async function streamElevenLabs(args: ElevenStreamArgs): Promise<Response> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(args.voiceId)}/stream?optimize_streaming_latency=4&output_format=mp3_44100_128`;

  const body: Record<string, unknown> = {
    text: args.text,
    model_id: args.modelId ?? 'eleven_flash_v2_5',
  };
  if (args.settings) body.voice_settings = mapSettings(args.settings);

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

function mapSettings(s: VoiceSettingsOverride): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.stability !== undefined) out.stability = s.stability;
  if (s.similarityBoost !== undefined) out.similarity_boost = s.similarityBoost;
  if (s.style !== undefined) out.style = s.style;
  if (s.useSpeakerBoost !== undefined) out.use_speaker_boost = s.useSpeakerBoost;
  if (s.speed !== undefined) out.speed = s.speed;
  return out;
}
