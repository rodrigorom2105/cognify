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

describe('normalizeExtractedText control characters', () => {
  it('strips NUL and other control characters but keeps newlines', () => {
    expect(normalizeExtractedText('a\u0000b\u0007c\nd')).toBe('abc\nd');
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

describe('chunkText long paragraphs', () => {
  const sentence = 'Retrieval quality depends on chunk size. ';

  it('splits a long paragraph that follows a full chunk', () => {
    const intro = sentence.repeat(30).trim(); // ~1,200 chars, fits one chunk
    const long = sentence.repeat(400).trim(); // ~16,000 chars, no breaks
    const chunks = chunkText(`${intro}\n\n${long}`, {
      chunkSize: 1500,
      overlap: 300,
      minChunkSize: 0,
    });

    expect(chunks.length).toBeGreaterThan(10);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1500 + 300 + 2);
    }
  });

  it('splits a long sentence that follows a full chunk', () => {
    // No sentence punctuation, so splitLongParagraph sees one giant sentence.
    const words = 'translated target text '.repeat(700).trim();
    const chunks = chunkText(`${sentence.repeat(30)}${words}`, {
      chunkSize: 1500,
      overlap: 300,
      minChunkSize: 0,
    });

    expect(chunks.length).toBeGreaterThan(10);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1500 + 300 + 2);
    }
  });

  it('splits text with no whitespace at all', () => {
    const chunks = chunkText(`intro\n\n${'x'.repeat(5000)}`, {
      chunkSize: 1000,
      overlap: 100,
      minChunkSize: 0,
    });

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000 + 100 + 2);
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
