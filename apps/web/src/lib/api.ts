import type { ChatRequest, ChatStreamEvent, TtsRequest } from '@cozza/shared';

// Empty string = same-origin (relative `/api/...`). In dev, vite proxies /api → :3025.
// In prod (nginx subdomain) same-origin works directly.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Stream chat from the Workers backend.
 * Yields ChatStreamEvent objects until 'done' or 'error'.
 */
export async function* streamChat(
  req: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const endpoint = req.provider === 'anthropic' ? '/api/chat/anthropic' : '/api/chat/openai';
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages separated by \n\n
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = parseSseBlock(block);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) {
      dataLine = line.slice(5).trim();
    }
  }
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine) as ChatStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Fetch TTS audio as a streaming Response.
 * Caller is responsible for piping `body` into MediaSource / Audio.
 */
export async function fetchTts(req: TtsRequest, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }
  return res;
}

export async function healthz(): Promise<{ status: string; commit?: string }> {
  const res = await fetch(`${API_BASE}/api/healthz`);
  if (!res.ok) throw new ApiError('healthz failed', res.status);
  return (await res.json()) as { status: string; commit?: string };
}
