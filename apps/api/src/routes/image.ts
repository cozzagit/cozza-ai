import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/types/env';
import { validateBody, getValidated } from '@/middleware/validate';
import { generateImage } from '@/lib/openai-images';

const ImageGenRequestSchema = z.object({
  prompt: z.string().min(3).max(4000),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
});
type ImageGenRequest = z.infer<typeof ImageGenRequestSchema>;

export const imageRoutes = new Hono<AppEnv>();

imageRoutes.post('/generate', validateBody(ImageGenRequestSchema), async (c) => {
  const cfg = c.get('config');
  const body = getValidated<ImageGenRequest>(c);

  if (!cfg.OPENAI_API_KEY) {
    return c.json({ error: { code: 'MISCONFIGURED', message: 'missing openai api key' } }, 500);
  }

  console.warn(
    JSON.stringify({
      event: 'image.generate',
      promptLen: body.prompt.length,
      size: body.size ?? '1024x1024',
      quality: body.quality ?? 'medium',
    }),
  );

  try {
    const result = await generateImage({
      apiKey: cfg.OPENAI_API_KEY,
      prompt: body.prompt,
      ...(body.size ? { size: body.size } : {}),
      ...(body.quality ? { quality: body.quality } : {}),
    });
    // Convert base64 → bytes; serve as image/png with private cache.
    const bytes = Buffer.from(result.b64, 'base64');
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=86400',
        ...(result.revisedPrompt
          ? { 'X-Revised-Prompt': encodeURIComponent(result.revisedPrompt).slice(0, 500) }
          : {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'image generation failed';
    return c.json({ error: { code: 'PROVIDER_ERROR', message: msg.slice(0, 400) } }, 502);
  }
});
