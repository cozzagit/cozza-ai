/**
 * Streaming sentence chunker.
 * Pushes text fragments and yields complete sentences as soon as a
 * sentence-ending punctuation (`.`, `!`, `?`) is followed by whitespace
 * or end-of-stream. Used by voice pipeline to pre-fetch TTS as soon as
 * the first sentence is ready.
 *
 * Currently used client-side in `useChat.ts`; kept also here for V1 when
 * the Worker may want to fan-out audio synthesis itself.
 */
export class SentenceChunker {
  private buf = '';
  private cursor = 0;

  push(text: string): string[] {
    this.buf += text;
    const out: string[] = [];
    const slice = this.buf.slice(this.cursor);
    let lastBoundary = 0;
    for (let i = 0; i < slice.length - 1; i++) {
      const ch = slice[i];
      const next = slice[i + 1];
      if ((ch === '.' || ch === '!' || ch === '?') && next && /\s/.test(next)) {
        const sentence = slice.slice(lastBoundary, i + 1).trim();
        if (sentence.length > 0) out.push(sentence);
        lastBoundary = i + 2;
      }
    }
    this.cursor += lastBoundary;
    return out;
  }

  flush(): string | null {
    const tail = this.buf.slice(this.cursor).trim();
    this.buf = '';
    this.cursor = 0;
    return tail.length > 0 ? tail : null;
  }
}
