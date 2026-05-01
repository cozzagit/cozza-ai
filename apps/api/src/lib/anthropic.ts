import type { ChatMessage, ChatModel, ChatStreamEvent } from '@cozza/shared';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicStreamArgs {
  apiKey: string;
  model: ChatModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Streams Claude messages via SSE. Yields normalized ChatStreamEvent objects.
 * Internally the call uses Anthropic's `messages.stream` SSE format.
 */
export async function* streamAnthropic(
  args: AnthropicStreamArgs,
): AsyncGenerator<ChatStreamEvent, void, void> {
  // Pull out system messages — Anthropic wants them in a top-level `system` field
  const systemContent = args.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversationMessages = args.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body = {
    model: args.model,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature,
    messages: conversationMessages,
    stream: true,
    ...(systemContent ? { system: systemContent } : {}),
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    ...(args.signal ? { signal: args.signal } : {}),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    yield {
      type: 'error',
      code: 'PROVIDER_ERROR',
      message: `anthropic ${res.status}: ${detail.slice(0, 200)}`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = parseAnthropicSse(block);
        if (!evt) continue;
        if (evt.type === 'content_block_delta') {
          const text = evt.delta?.text ?? '';
          if (text) yield { type: 'delta', text };
        } else if (evt.type === 'message_delta') {
          const usage = evt.usage;
          if (usage) {
            outputTokens = usage.output_tokens ?? outputTokens;
          }
        } else if (evt.type === 'message_start') {
          const usage = evt.message?.usage;
          if (usage) inputTokens = usage.input_tokens ?? 0;
        } else if (evt.type === 'message_stop') {
          // Will emit done after loop ends.
        } else if (evt.type === 'error') {
          yield {
            type: 'error',
            code: 'PROVIDER_ERROR',
            message: evt.error?.message ?? 'unknown anthropic error',
          };
          return;
        }
      }
    }
    yield { type: 'done', usage: { inputTokens, outputTokens } };
  } finally {
    reader.releaseLock();
  }
}

interface AnthropicEvent {
  type: string;
  delta?: { text?: string };
  usage?: { output_tokens?: number };
  message?: { usage?: { input_tokens?: number } };
  error?: { message?: string };
}

function parseAnthropicSse(block: string): AnthropicEvent | null {
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) dataLine = line.slice(5).trim();
  }
  if (!dataLine || dataLine === '[DONE]') return null;
  try {
    return JSON.parse(dataLine) as AnthropicEvent;
  } catch {
    return null;
  }
}
