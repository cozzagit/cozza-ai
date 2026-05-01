import { z } from 'zod';

export const TtsModelSchema = z.enum(['eleven_flash_v2_5', 'eleven_multilingual_v2']);
export type TtsModel = z.infer<typeof TtsModelSchema>;

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(64),
  modelId: TtsModelSchema.optional(),
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
