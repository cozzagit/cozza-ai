import { Hono, type Context } from 'hono';
import {
  ChatRequestSchema,
  PROVIDER_BY_MODEL,
  type ChatProvider,
  type ChatRequest,
  type ChatStreamEvent,
} from '@cozza/shared';
import type { AppEnv } from '@/types/env';
import { validateBody, getValidated } from '@/middleware/validate';
import { streamAnthropic } from '@/lib/anthropic';
import { streamOpenAi } from '@/lib/openai';

export const chatRoutes = new Hono<AppEnv>();

async function handleStream(c: Context<AppEnv>, expected: ChatProvider): Promise<Response> {
  const cfg = c.get('config');
  const body = getValidated<ChatRequest>(c);

  if (PROVIDER_BY_MODEL[body.model] !== expected) {
    return c.json(
      {
        error: {
          code: 'MODEL_PROVIDER_MISMATCH',
          message: `model ${body.model} does not match endpoint provider ${expected}`,
        },
      },
      400,
    );
  }
  if (body.provider !== expected) {
    return c.json(
      { error: { code: 'PROVIDER_MISMATCH', message: `expected provider ${expected}` } },
      400,
    );
  }

  const apiKey = expected === 'anthropic' ? cfg.ANTHROPIC_API_KEY : cfg.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: { code: 'MISCONFIGURED', message: `missing ${expected} api key` } },
      500,
    );
  }

  console.warn(
    JSON.stringify({
      event: 'chat.stream.start',
      provider: expected,
      model: body.model,
      msgCount: body.messages.length,
    }),
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (evt: ChatStreamEvent, name = evt.type): void => {
        controller.enqueue(enc.encode(`event: ${name}\ndata: ${JSON.stringify(evt)}\n\n`));
      };
      try {
        const iter =
          expected === 'anthropic'
            ? streamAnthropic({
                apiKey,
                model: body.model,
                messages: body.messages,
                ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
                ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
              })
            : streamOpenAi({
                apiKey,
                model: body.model,
                messages: body.messages,
                ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
                ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
              });
        for await (const evt of iter) {
          send(evt);
          if (evt.type === 'error' || evt.type === 'done') break;
        }
      } catch (e) {
        send(
          {
            type: 'error',
            code: 'INTERNAL',
            message: e instanceof Error ? e.message : 'unknown error',
          },
          'error',
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

chatRoutes.post('/anthropic', validateBody(ChatRequestSchema), (c) => handleStream(c, 'anthropic'));
chatRoutes.post('/openai', validateBody(ChatRequestSchema), (c) => handleStream(c, 'openai'));
