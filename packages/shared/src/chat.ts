import { z } from 'zod';

export const ChatProviderSchema = z.enum(['anthropic', 'openai']);
export type ChatProvider = z.infer<typeof ChatProviderSchema>;

export const ChatModelSchema = z.enum([
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'gpt-4o-mini',
  'gpt-4o',
]);
export type ChatModel = z.infer<typeof ChatModelSchema>;

export const ChatRoleSchema = z.enum(['user', 'assistant', 'system']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1).max(50_000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  provider: ChatProviderSchema,
  model: ChatModelSchema,
  messages: z.array(ChatMessageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; code: string; message: string };

export const PROVIDER_BY_MODEL: Record<ChatModel, ChatProvider> = {
  'claude-haiku-4-5': 'anthropic',
  'claude-sonnet-4-6': 'anthropic',
  'gpt-4o-mini': 'openai',
  'gpt-4o': 'openai',
};
