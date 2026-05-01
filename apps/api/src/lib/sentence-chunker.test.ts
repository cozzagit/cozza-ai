import { describe, it, expect } from 'vitest';
import { SentenceChunker } from './sentence-chunker';

describe('SentenceChunker', () => {
  it('emits a sentence as soon as a terminator + whitespace arrives', () => {
    const c = new SentenceChunker();
    expect(c.push('Ciao Cozza')).toEqual([]);
    expect(c.push(', come stai? ')).toEqual(['Ciao Cozza, come stai?']);
    expect(c.flush()).toBeNull();
  });

  it('handles multiple sentences in a single push', () => {
    const c = new SentenceChunker();
    expect(c.push('Uno. Due! Tre? ')).toEqual(['Uno.', 'Due!', 'Tre?']);
  });

  it('keeps trailing partial sentence in buffer', () => {
    const c = new SentenceChunker();
    expect(c.push('Prima frase. Seconda parz')).toEqual(['Prima frase.']);
    expect(c.flush()).toBe('Seconda parz');
  });

  it('does not split on dot inside numbers', () => {
    const c = new SentenceChunker();
    // "3.14" has no whitespace after the dot → does not trigger boundary
    expect(c.push('Pi vale 3.14 e basta. ')).toEqual(['Pi vale 3.14 e basta.']);
  });

  it('flush returns null when buffer is empty', () => {
    const c = new SentenceChunker();
    expect(c.flush()).toBeNull();
  });

  it('progressive streaming pushes', () => {
    const c = new SentenceChunker();
    const out: string[] = [];
    for (const piece of ['Eco', 'lo. ', 'Test', '. ', 'Done']) {
      out.push(...c.push(piece));
    }
    expect(out).toEqual(['Ecolo.', 'Test.']);
    expect(c.flush()).toBe('Done');
  });
});
