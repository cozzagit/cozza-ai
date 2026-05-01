import { Hono } from 'hono';
import { TtsRequestSchema, type TtsRequest } from '@cozza/shared';
import type { AppEnv } from '@/types/env';
import { validateBody, getValidated } from '@/middleware/validate';
import { streamElevenLabs } from '@/lib/elevenlabs';

export const ttsRoutes = new Hono<AppEnv>();

ttsRoutes.post('/', validateBody(TtsRequestSchema), async (c) => {
  const cfg = c.get('config');
  const body = getValidated<TtsRequest>(c);

  if (!cfg.ELEVENLABS_API_KEY) {
    return c.json(
      { error: { code: 'MISCONFIGURED', message: 'missing elevenlabs api key' } },
      500,
    );
  }

  console.warn(
    JSON.stringify({ event: 'tts.start', voiceId: body.voiceId, textLen: body.text.length }),
  );

  const upstream = await streamElevenLabs({
    apiKey: cfg.ELEVENLABS_API_KEY,
    text: body.text,
    voiceId: body.voiceId,
    ...(body.modelId ? { modelId: body.modelId } : {}),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return c.json(
      {
        error: {
          code: 'PROVIDER_ERROR',
          message: `elevenlabs ${upstream.status}`,
          detail: detail.slice(0, 300),
        },
      },
      502,
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
});
