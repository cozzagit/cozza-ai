import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamChat } from './api';
import type { ChatStreamEvent } from '@cozza/shared';

const enc = new TextEncoder();

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('streamChat (SSE parser)', () => {
  it('yields delta + done events from a well-formed SSE stream', async () => {
    const stream = sseStream([
      'event: delta\ndata: {"type":"delta","text":"Ciao"}\n\n',
      'event: delta\ndata: {"type":"delta","text":", come"}\n\n',
      'event: done\ndata: {"type":"done","usage":{"inputTokens":3,"outputTokens":5}}\n\n',
    ]);
    const fakeRes = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeRes));

    const out: ChatStreamEvent[] = [];
    for await (const ev of streamChat({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      out.push(ev);
    }
    expect(out).toEqual([
      { type: 'delta', text: 'Ciao' },
      { type: 'delta', text: ', come' },
      { type: 'done', usage: { inputTokens: 3, outputTokens: 5 } },
    ]);
  });

  it('handles chunks split across SSE message boundaries', async () => {
    // Split a single SSE message across two enqueues
    const stream = sseStream([
      'event: delta\ndata: {"type":"',
      'delta","text":"hi"}\n\n',
      'event: done\ndata: {"type":"done"}\n\n',
    ]);
    const fakeRes = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeRes));

    const out: ChatStreamEvent[] = [];
    for await (const ev of streamChat({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      out.push(ev);
    }
    expect(out).toEqual([
      { type: 'delta', text: 'hi' },
      { type: 'done' },
    ]);
  });

  it('throws ApiError on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('rate limited', { status: 429, headers: {} }),
      ),
    );
    await expect(async () => {
      for await (const _ of streamChat({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        // no-op
      }
    }).rejects.toThrow();
  });
});
