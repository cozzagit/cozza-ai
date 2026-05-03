import { z } from 'zod';

export const TtsModelSchema = z.enum(['eleven_flash_v2_5', 'eleven_multilingual_v2']);
export type TtsModel = z.infer<typeof TtsModelSchema>;

/**
 * Optional override of the voice's defaults stored on ElevenLabs side.
 * If a field is omitted we DO NOT include it in the upstream request,
 * so ElevenLabs uses the voice's saved value (preserving Cozza's custom
 * stability / similarity / style / speed tuning per voice).
 */
export const VoiceSettingsOverrideSchema = z.object({
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
});
export type VoiceSettingsOverride = z.infer<typeof VoiceSettingsOverrideSchema>;

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(64),
  modelId: TtsModelSchema.optional(),
  settings: VoiceSettingsOverrideSchema.optional(),
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
