interface ImageGenArgs {
  apiKey: string;
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  signal?: AbortSignal;
}

interface OpenAiImageResponse {
  data: { b64_json?: string; url?: string; revised_prompt?: string }[];
}

/**
 * Calls OpenAI Images API with `gpt-image-1` (the successor of DALL-E 3,
 * 2025-onwards). Returns base64-encoded PNG so we can stream it back to
 * the client without exposing the OpenAI URL or its short TTL.
 */
export async function generateImage(
  args: ImageGenArgs,
): Promise<{ b64: string; revisedPrompt?: string }> {
  const body = {
    model: 'gpt-image-1',
    prompt: args.prompt,
    n: 1,
    size: args.size ?? '1024x1024',
    quality: args.quality ?? 'medium',
  };

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
    ...(args.signal ? { signal: args.signal } : {}),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`openai images ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as OpenAiImageResponse;
  const first = data.data?.[0];
  if (!first?.b64_json) {
    throw new Error('openai images: no b64_json in response');
  }
  return {
    b64: first.b64_json,
    ...(first.revised_prompt ? { revisedPrompt: first.revised_prompt } : {}),
  };
}
