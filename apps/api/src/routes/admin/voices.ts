import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/types/env';
import { requireAdmin } from '@/middleware/admin-auth';
import { validateBody, getValidated } from '@/middleware/validate';
import { streamElevenLabs } from '@/lib/elevenlabs';

export const adminVoicesRoutes = new Hono<AppEnv>();

adminVoicesRoutes.use('*', requireAdmin);

interface ElevenVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  category?: string;
}
interface ElevenVoicesResponse {
  voices: ElevenVoice[];
}

interface VoiceDto {
  id: string;
  name: string;
  gender: string | null;
  age: string | null;
  accent: string | null;
  useCase: string | null;
  descriptive: string | null;
  description: string | null;
  isItalianNative: boolean;
  previewUrl: string | null;
  category: string | null;
}

function shapeVoice(v: ElevenVoice): VoiceDto {
  const labels = v.labels ?? {};
  const lower = (s: string | null | undefined): string => (s ?? '').toLowerCase();
  const text = Object.values(labels).join(' ') + ' ' + (v.description ?? '') + ' ' + v.name;
  const isItalianNative = lower(text).includes('italian') || lower(text).includes('italiano');
  return {
    id: v.voice_id,
    name: v.name,
    gender: labels.gender ?? null,
    age: labels.age ?? null,
    accent: labels.accent ?? null,
    useCase: labels.use_case ?? labels['use case'] ?? null,
    descriptive: labels.descriptive ?? labels.description ?? null,
    description: v.description ?? null,
    isItalianNative,
    previewUrl: v.preview_url ?? null,
    category: v.category ?? null,
  };
}

adminVoicesRoutes.get('/', async (c) => {
  const cfg = c.get('config');
  if (!cfg.ELEVENLABS_API_KEY) {
    return c.json({ error: { code: 'MISCONFIGURED', message: 'missing elevenlabs api key' } }, 500);
  }
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': cfg.ELEVENLABS_API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return c.json(
      {
        error: {
          code: 'PROVIDER_ERROR',
          message: `elevenlabs ${res.status}`,
          detail: detail.slice(0, 300),
        },
      },
      502,
    );
  }
  const data = (await res.json()) as ElevenVoicesResponse;
  const voices = (data.voices ?? []).map(shapeVoice);
  return c.json({ voices });
});

const PreviewSchema = z.object({
  voiceId: z.string().min(1).max(64),
  text: z.string().min(1).max(500).optional(),
});
type PreviewPayload = z.infer<typeof PreviewSchema>;

const DEFAULT_PREVIEW_TEXT = 'Ciao Cozza, sono la tua voce per cozza-ai. Pronti a partire?';

adminVoicesRoutes.post('/preview', validateBody(PreviewSchema), async (c) => {
  const cfg = c.get('config');
  const body = getValidated<PreviewPayload>(c);
  if (!cfg.ELEVENLABS_API_KEY) {
    return c.json({ error: { code: 'MISCONFIGURED', message: 'missing elevenlabs api key' } }, 500);
  }
  const upstream = await streamElevenLabs({
    apiKey: cfg.ELEVENLABS_API_KEY,
    text: body.text ?? DEFAULT_PREVIEW_TEXT,
    voiceId: body.voiceId,
    modelId: 'eleven_flash_v2_5',
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
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
