import { describe, it, expect } from 'vitest';
import {
  ChatRequestSchema,
  ChatModelSchema,
  PROVIDER_BY_MODEL,
  TtsRequestSchema,
  IntentSchema,
} from './index';

describe('ChatRequestSchema', () => {
  it('accepts valid Anthropic request', () => {
    const r = ChatRequestSchema.safeParse({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown model', () => {
    const r = ChatRequestSchema.safeParse({
      provider: 'anthropic',
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty messages array', () => {
    const r = ChatRequestSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [],
    });
    expect(r.success).toBe(false);
  });

  it('rejects message content over 50k chars', () => {
    const r = ChatRequestSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'a'.repeat(50_001) }],
    });
    expect(r.success).toBe(false);
  });

  it('caps maxTokens at 8192', () => {
    const r = ChatRequestSchema.safeParse({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 100_000,
    });
    expect(r.success).toBe(false);
  });
});

describe('PROVIDER_BY_MODEL', () => {
  it('maps every model to a provider', () => {
    for (const m of ChatModelSchema.options) {
      expect(['anthropic', 'openai']).toContain(PROVIDER_BY_MODEL[m]);
    }
  });
});

describe('TtsRequestSchema', () => {
  it('accepts valid request', () => {
    const r = TtsRequestSchema.safeParse({
      text: 'Ciao',
      voiceId: 'XbcM2vJC2cFhB1u8z3vR',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty text', () => {
    const r = TtsRequestSchema.safeParse({ text: '', voiceId: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects text over 5k chars', () => {
    const r = TtsRequestSchema.safeParse({
      text: 'a'.repeat(5001),
      voiceId: 'x',
    });
    expect(r.success).toBe(false);
  });
});

describe('IntentSchema', () => {
  it('contains all 6 V1 intents', () => {
    expect(IntentSchema.options).toEqual([
      'START_CHAT',
      'SWITCH_WORKSPACE',
      'OPEN_APP',
      'STOP',
      'READ_LAST',
      'OPEN_TERMINAL',
    ]);
  });
});
