import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/types/env';
import { validateBody, getValidated } from '@/middleware/validate';

/**
 * "Art director" enrichment endpoint.
 *
 * Given the final assistant text of a chat turn, asks a fast cheap model
 * (Claude Haiku by default, GPT-4o-mini as fallback) to produce visual
 * artifacts that complete the response — typically an `image-prompt`
 * block, sometimes a `mermaid` diagram.
 *
 * The endpoint returns plain text containing the fenced blocks ready to
 * be appended to the assistant message in Dexie. No model output other
 * than the blocks themselves.
 */

const EnrichRequestSchema = z.object({
  assistantText: z.string().min(20).max(20_000),
  userPrompt: z.string().max(2_000).optional(),
  /** Which provider to ask. Defaults to whichever is configured. */
  provider: z.enum(['anthropic', 'openai']).optional(),
  /** Whether the assistant already produced an image-prompt block. */
  hasImagePrompt: z.boolean().optional(),
  hasMermaid: z.boolean().optional(),
});
type EnrichRequest = z.infer<typeof EnrichRequestSchema>;

export const enrichRoutes = new Hono<AppEnv>();

const ART_DIRECTOR_SYSTEM = `You are the visual art director for cozza-ai. Given an assistant
response (in any language), produce ONE OR MORE fenced visual blocks that ENRICH the
response. Output ONLY the fenced blocks, NOTHING else (no preamble, no commentary).

Block types you can use:
- \`\`\`image-prompt
  An English-language gpt-image-1 prompt (cinematic photo / vector art / isometric 3D
  / watercolor / neon cyberpunk style, ultra-detailed, 8k, no text in image, no real
  people, no logos). The prompt should evoke or illustrate the response — pick the
  most striking visual angle.
  \`\`\`
- \`\`\`mermaid
  flowchart TD / sequenceDiagram / classDiagram / mindmap, etc., max 12 nodes,
  ASCII arrows ONLY ("-->"), label accented words in quotes ("Università").
  \`\`\`

Output rules:
- ALWAYS produce the image-prompt unless the user already has one (hasImagePrompt=true).
- Add a mermaid diagram only when the content is structurally technical
  (process, workflow, hierarchy, system) and one isn't already present.
- 1 image, optionally 1 diagram — never more.
- ZERO text outside the fences.`;

interface AnthropicResp {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}
interface OpenAiResp {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: ART_DIRECTOR_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as AnthropicResp;
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  return text;
}

async function callOpenAi(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: ART_DIRECTOR_SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as OpenAiResp;
  return data.choices?.[0]?.message?.content ?? '';
}

enrichRoutes.post('/', validateBody(EnrichRequestSchema), async (c) => {
  const cfg = c.get('config');
  const body = getValidated<EnrichRequest>(c);

  // Skip if both blocks are already present
  if (body.hasImagePrompt === true && body.hasMermaid === true) {
    return c.json({ blocks: '' });
  }

  const userPrompt = `User asked: ${body.userPrompt ?? '(unknown)'}

Assistant replied:
"""
${body.assistantText}
"""

Already present visual blocks: ${
    [
      body.hasImagePrompt === true ? 'image-prompt' : null,
      body.hasMermaid === true ? 'mermaid' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'none'
  }

Produce the missing fenced visual blocks, nothing else.`;

  // Prefer Anthropic Haiku (cheap, follows instructions tightly).
  // Fall back to OpenAI 4o-mini if Anthropic fails.
  const wantedProvider = body.provider ?? 'anthropic';
  let blocks = '';
  let usedProvider = wantedProvider;

  try {
    if (wantedProvider === 'anthropic' && cfg.ANTHROPIC_API_KEY) {
      blocks = await callAnthropic(cfg.ANTHROPIC_API_KEY, userPrompt);
    } else if (cfg.OPENAI_API_KEY) {
      blocks = await callOpenAi(cfg.OPENAI_API_KEY, userPrompt);
      usedProvider = 'openai';
    }
  } catch (e) {
    // Fallback to the other provider
    try {
      if (wantedProvider === 'anthropic' && cfg.OPENAI_API_KEY) {
        blocks = await callOpenAi(cfg.OPENAI_API_KEY, userPrompt);
        usedProvider = 'openai';
      } else if (cfg.ANTHROPIC_API_KEY) {
        blocks = await callAnthropic(cfg.ANTHROPIC_API_KEY, userPrompt);
        usedProvider = 'anthropic';
      } else {
        throw e;
      }
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : 'enrich failed';
      console.error(JSON.stringify({ event: 'enrich.failed', msg }));
      return c.json({ error: { code: 'PROVIDER_ERROR', message: msg.slice(0, 300) } }, 502);
    }
  }

  // Sanitize: keep only fenced blocks (image-prompt / mermaid / svg) — drop any
  // commentary the model may have added despite instructions.
  const FENCE = /```(image[-_]?prompt|mermaid|svg)\s*\n[\s\S]*?```/gi;
  const onlyBlocks = (blocks.match(FENCE) ?? []).join('\n\n');

  console.warn(
    JSON.stringify({
      event: 'enrich.done',
      provider: usedProvider,
      inputLen: body.assistantText.length,
      blocksLen: onlyBlocks.length,
    }),
  );

  return c.json({ blocks: onlyBlocks, provider: usedProvider });
});
