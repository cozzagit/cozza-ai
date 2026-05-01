import type { ChatMessage, ChatModel, ChatStreamEvent } from '@cozza/shared';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAiStreamArgs {
  apiKey: string;
  model: ChatModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Streams OpenAI Chat Completions via SSE. Yields normalized ChatStreamEvent.
 */
export async function* streamOpenAi(
  args: OpenAiStreamArgs,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const body = {
    model: args.model,
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: args.temperature,
    max_tokens: args.maxTokens ?? 1024,
    stream: true,
    stream_options: { include_usage: true },
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    yield {
      type: 'error',
      code: 'PROVIDER_ERROR',
      message: `openai ${res.status}: ${detail.slice(0, 200)}`,
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
        const evt = parseOpenAiSse(block);
        if (!evt) continue;
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) yield { type: 'delta', text: delta };
        if (evt.usage) {
          inputTokens = evt.usage.prompt_tokens ?? 0;
          outputTokens = evt.usage.completion_tokens ?? 0;
        }
      }
    }
    yield { type: 'done', usage: { inputTokens, outputTokens } };
  } finally {
    reader.releaseLock();
  }
}

interface OpenAiEvent {
  choices?: { delta?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function parseOpenAiSse(block: string): OpenAiEvent | null {
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) dataLine = line.slice(5).trim();
  }
  if (!dataLine || dataLine === '[DONE]') return null;
  try {
    return JSON.parse(dataLine) as OpenAiEvent;
  } catch {
    return null;
  }
}
