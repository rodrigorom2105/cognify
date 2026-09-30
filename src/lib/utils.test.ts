import { describe, expect, it, vi } from 'vitest';

import { chunkText, getChunkingStats, normalizeExtractedText } from './utils';

// chunkText logs progress on every call.
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('normalizeExtractedText', () => {
  it('re-joins words hyphenated across line breaks', () => {
    expect(normalizeExtractedText('retrie-\nval')).toBe('retrieval');
  });

  it('replaces ligatures and typographic punctuation', () => {
    expect(normalizeExtractedText('ﬁle “quoted” — done…')).toBe(
      'file "quoted" - done...'
    );
  });

  it('drops page-number lines and repeated headers on longer documents', () => {
    const pages = Array.from({ length: 5 }, (_, i) => [
      'ACME Corp Confidential',
      `Body sentence ${i}.`,
      `Another sentence ${i}.`,
      `Page ${i + 1}`,
    ]).flat();

    const result = normalizeExtractedText(pages.join('\n'));

    expect(result).not.toContain('ACME Corp Confidential');
    expect(result).not.toMatch(/^Page \d+$/m);
    expect(result).toContain('Body sentence 3.');
  });
});

describe('chunkText', () => {
  it('returns no chunks for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    expect(chunkText('hello world', 100, 10)).toEqual(['hello world']);
  });

  it('splits long text into chunks no larger than the chunk size plus overlap', () => {
    const paragraph = 'This is a sentence about retrieval. '.repeat(10).trim();
    const text = Array.from({ length: 20 }, () => paragraph).join('\n\n');

    const chunks = chunkText(text, {
      chunkSize: 800,
      overlap: 100,
      minChunkSize: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(800 + 100 + 2);
    }
  });
});

describe('getChunkingStats', () => {
  it('reports zeros for no chunks', () => {
    expect(getChunkingStats([]).totalChunks).toBe(0);
  });

  it('summarises chunk sizes', () => {
    expect(getChunkingStats(['ab', 'abcd'])).toEqual({
      totalChunks: 2,
      avgChunkSize: 3,
      minChunkSize: 2,
      maxChunkSize: 4,
      totalCharacters: 6,
    });
  });
});
