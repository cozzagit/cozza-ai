/**
 * Extracts visual artifacts from assistant message content.
 *
 * Supported types:
 *   - image  : markdown ![alt](url) and bare <img src=...>
 *   - mermaid: ```mermaid``` fenced blocks
 *   - svg    : ```svg``` blocks or inline <svg>...</svg>
 *   - html   : ```html``` blocks (rendered in sandboxed iframe)
 *   - chart  : ```chart``` JSON blocks (future, schema TBD)
 *   - link   : URL preview (top of message, optional)
 *
 * Used by the ArtifactsPanel to render a parallel visual track of the
 * conversation alongside the chat text.
 */

export type ArtifactKind = 'image' | 'image-prompt' | 'mermaid' | 'svg' | 'html' | 'chart' | 'link';

export interface Artifact {
  /** stable id derived from messageId + index */
  id: string;
  kind: ArtifactKind;
  /** original message that produced it */
  messageId: string;
  /** payload — URL for images, raw text for code blocks */
  payload: string;
  /** alt text for images, optional title for code */
  caption?: string;
  /** Position 0-based in the message */
  index: number;
}

const IMG_MD_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g;
const IMG_HTML_RE = /<img\s+[^>]*?src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["'][^>]*?>/gi;
const FENCE_RE = /```(\w+)\n([\s\S]*?)\n```/g;
const SVG_INLINE_RE = /<svg[\s\S]*?<\/svg>/gi;

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

  // Markdown images
  for (const m of content.matchAll(IMG_MD_RE)) {
    const [, alt, url] = m;
    if (url) push('image', url, alt || undefined);
  }
  // Bare HTML img
  for (const m of content.matchAll(IMG_HTML_RE)) {
    const [, src] = m;
    if (src) push('image', src);
  }
  // Fenced code blocks (mermaid / svg / html / chart)
  for (const m of content.matchAll(FENCE_RE)) {
    const [, lang, body] = m;
    if (!lang || !body) continue;
    const ll = lang.toLowerCase();
    if (ll === 'mermaid') push('mermaid', body);
    else if (ll === 'svg') push('svg', body);
    else if (ll === 'html') push('html', body);
    else if (ll === 'chart' || ll === 'chartjs') push('chart', body);
    else if (ll === 'image-prompt' || ll === 'imageprompt' || ll === 'image_prompt') {
      push('image-prompt', body);
    }
  }
  // Inline SVG outside of fences
  const codeFenced = new Set(
    [...content.matchAll(FENCE_RE)].map((m) => (m[2] ?? '').trim()).filter(Boolean),
  );
  for (const m of content.matchAll(SVG_INLINE_RE)) {
    const svg = m[0];
    // Skip if it's already inside a fenced code block we picked up
    if ([...codeFenced].some((c) => c.includes(svg.slice(0, 60)))) continue;
    push('svg', svg);
  }
  return out;
}

/** Strip the artifacts from the content so the bubble doesn't repeat them. */
export function stripFences(content: string, kinds: ArtifactKind[]): string {
  return content.replace(FENCE_RE, (whole, lang: string) => {
    const ll = (lang ?? '').toLowerCase();
    if (
      (ll === 'mermaid' && kinds.includes('mermaid')) ||
      (ll === 'svg' && kinds.includes('svg')) ||
      (ll === 'html' && kinds.includes('html')) ||
      ((ll === 'chart' || ll === 'chartjs') && kinds.includes('chart'))
    ) {
      return ''; // remove the block
    }
    return whole;
  });
}
