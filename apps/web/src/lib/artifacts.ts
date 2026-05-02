/**
 * Extracts visual artifacts from assistant message content.
 *
 * Supported types:
 *   - image        : markdown ![alt](url) and bare <img src=...>
 *   - image-prompt : ```image-prompt``` blocks (or aliases) → AI image gen
 *   - mermaid      : ```mermaid``` fenced blocks
 *   - svg          : ```svg``` blocks or inline <svg>…</svg>
 *   - html         : ```html``` blocks (rendered in sandboxed iframe)
 *   - chart        : ```chart``` JSON blocks (preview WIP)
 */

export type ArtifactKind = 'image' | 'image-prompt' | 'mermaid' | 'svg' | 'html' | 'chart' | 'link';

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  messageId: string;
  payload: string;
  caption?: string;
  index: number;
}

const IMG_MD_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g;
const IMG_HTML_RE = /<img\s+[^>]*?src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["'][^>]*?>/gi;

// Tolerant fence regex:
// - lang token allows letters / digits / dash / underscore (image-prompt, image_prompt, etc.)
// - optional spaces around lang
// - optional newline after closing ``` (some models forget the trailing \n)
const FENCE_RE = /```[ \t]*([a-zA-Z][a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g;

const SVG_INLINE_RE = /<svg[\s\S]*?<\/svg>/gi;

// Recognized aliases for AI image generation block.
const IMAGE_PROMPT_ALIASES = new Set([
  'image-prompt',
  'imageprompt',
  'image_prompt',
  'image-gen',
  'imagegen',
  'image_gen',
  'gen-image',
  'generate-image',
  'dalle',
  'dall-e',
  'sora',
  'cozza-image',
]);

export function extractArtifacts(messageId: string, content: string): Artifact[] {
  const out: Artifact[] = [];
  let idx = 0;
  const seen = new Set<string>();
  const push = (kind: ArtifactKind, payload: string, caption?: string): void => {
    const trimmed = payload.trim();
    if (!trimmed) return;
    const dedupKey = `${kind}::${trimmed.slice(0, 200)}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    out.push({
      id: `${messageId}-${idx}`,
      kind,
      messageId,
      payload: trimmed,
      ...(caption ? { caption } : {}),
      index: idx,
    });
    idx += 1;
  };

  // Markdown images (real URLs only — synthetic placeholders skipped)
  for (const m of content.matchAll(IMG_MD_RE)) {
    const [, alt, url] = m;
    if (!url) continue;
    if (/example\.com|placeholder|your-image|YOUR_URL/i.test(url)) continue;
    push('image', url, alt || undefined);
  }
  // Bare HTML <img>
  for (const m of content.matchAll(IMG_HTML_RE)) {
    const [, src] = m;
    if (src) push('image', src);
  }
  // Fenced code blocks
  for (const m of content.matchAll(FENCE_RE)) {
    const [, lang, body] = m;
    if (!lang || !body) continue;
    const ll = lang.toLowerCase();
    if (ll === 'mermaid') push('mermaid', body);
    else if (ll === 'svg') push('svg', body);
    else if (ll === 'html') push('html', body);
    else if (ll === 'chart' || ll === 'chartjs') push('chart', body);
    else if (IMAGE_PROMPT_ALIASES.has(ll)) push('image-prompt', body);
  }
  // Inline SVG outside of fences
  const codeFenced = new Set(
    [...content.matchAll(FENCE_RE)].map((m) => (m[2] ?? '').trim()).filter(Boolean),
  );
  for (const m of content.matchAll(SVG_INLINE_RE)) {
    const svg = m[0];
    if ([...codeFenced].some((c) => c.includes(svg.slice(0, 60)))) continue;
    push('svg', svg);
  }
  return out;
}

/** Strip handled fences from the content so the chat bubble doesn't repeat them. */
export function stripFences(content: string, kinds: ArtifactKind[]): string {
  return content.replace(FENCE_RE, (whole, lang: string) => {
    const ll = (lang ?? '').toLowerCase();
    if (
      (ll === 'mermaid' && kinds.includes('mermaid')) ||
      (ll === 'svg' && kinds.includes('svg')) ||
      (ll === 'html' && kinds.includes('html')) ||
      ((ll === 'chart' || ll === 'chartjs') && kinds.includes('chart')) ||
      (IMAGE_PROMPT_ALIASES.has(ll) && kinds.includes('image-prompt'))
    ) {
      return ''; // remove the block from the chat text
    }
    return whole;
  });
}
