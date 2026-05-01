import { z } from 'zod';

export const IntentSchema = z.enum([
  'START_CHAT',
  'SWITCH_WORKSPACE',
  'OPEN_APP',
  'STOP',
  'READ_LAST',
  'OPEN_TERMINAL',
]);
export type Intent = z.infer<typeof IntentSchema>;

export const WorkspaceIdSchema = z.enum([
  'casual',
  'lavoriamo',
  'cinema',
  'studio',
  'ambient',
]);
export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;

export const IntentParamsSchema = z
  .object({
    text: z.string().optional(),
    app: z.string().optional(),
    workspace: WorkspaceIdSchema.optional(),
  })
  .partial();
export type IntentParams = z.infer<typeof IntentParamsSchema>;

export type IntentResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_implemented' | 'invalid_params' | 'failed';
      detail?: string;
    };
