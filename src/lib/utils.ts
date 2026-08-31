import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createServiceClient } from '@/lib/supabase/service';
import type { Json, TablesUpdate } from '@/lib/supabase/database.types';
import type { DocumentStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
  minChunkSize?: number;
}

export const DEFAULT_CHUNKING_CONFIG: Required<ChunkingOptions> = {
  chunkSize: 1500,
  overlap: 300,
  minChunkSize: 350,
};

/**
 * Normalize extracted PDF text to reduce embedding noise.
 */
export function normalizeExtractedText(text: string): string {
  if (!text) return '';

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Re-join hyphenated words split by line breaks.
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1$2')
    .replace(/[\uFB00]/g, 'ff')
    .replace(/[\uFB01]/g, 'fi')
    .replace(/[\uFB02]/g, 'fl')
    .replace(/[\uFB03]/g, 'ffi')
    .replace(/[\uFB04]/g, 'ffl')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return stripLikelyPdfBoilerplate(normalized);
}

function stripLikelyPdfBoilerplate(text: string): string {
  const lines = text.split('\n');
  if (lines.length < 20) {
    return text;
  }

  const lineFrequency = new Map<string, number>();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    lineFrequency.set(line, (lineFrequency.get(line) ?? 0) + 1);
  }

  const shouldDropRepeatedLine = (line: string) => {
    const count = lineFrequency.get(line) ?? 0;
    if (count < 3) return false;
    if (line.length > 80) return false;
    // Keep likely section titles and list content.
    if (/[:;,.!?]$/.test(line)) return false;
    if (/^\d+[.)]\s+/.test(line)) return false;
    return true;
  };

  const shouldDropPageNumberLine = (line: string) => {
    // Common page markers: "Page 2", "2/10", "- 2 -", or standalone short digits.
    return (
      /^(page\s+)?\d+$/i.test(line) ||
      /^\d+\s*\/\s*\d+$/i.test(line) ||
      /^[-–—]?\s*\d+\s*[-–—]?$/.test(line)
    );
  };

  const filtered = lines.filter((rawLine) => {
    const line = rawLine.trim();
    if (!line) return false;
    if (shouldDropPageNumberLine(line)) return false;
    if (shouldDropRepeatedLine(line)) return false;
    return true;
  });

  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Split text into chunks with overlap for better context preservation
 *
 * Strategy:
 * 1. Split by paragraphs (double newlines) first
 * 2. Combine paragraphs until chunk size is reached
 * 3. Add overlap from previous chunk for context
 *
 * @param text - Full text to chunk
 * @param chunkSize - Target size for each chunk in characters (default: 1500)
 * @param overlap - Number of overlapping characters between chunks (default: 300)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  optionsOrChunkSize: ChunkingOptions | number = DEFAULT_CHUNKING_CONFIG.chunkSize,
  overlapArg: number = DEFAULT_CHUNKING_CONFIG.overlap
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const options: Required<ChunkingOptions> =
    typeof optionsOrChunkSize === 'number'
      ? {
          chunkSize: optionsOrChunkSize,
          overlap: overlapArg,
          minChunkSize: DEFAULT_CHUNKING_CONFIG.minChunkSize,
        }
      : {
          chunkSize:
            optionsOrChunkSize.chunkSize ?? DEFAULT_CHUNKING_CONFIG.chunkSize,
          overlap: optionsOrChunkSize.overlap ?? DEFAULT_CHUNKING_CONFIG.overlap,
          minChunkSize:
            optionsOrChunkSize.minChunkSize ??
            DEFAULT_CHUNKING_CONFIG.minChunkSize,
        };

  const { chunkSize, overlap, minChunkSize } = options;

  console.log('[Step 1] Chunking text');

  // Normalize whitespace and line breaks
  const normalizedText = text
    .replace(/\r\n/g, '\n') // Windows line endings
    .replace(/\r/g, '\n') // Old Mac line endings
    .trim();

  // If text is shorter than chunk size, return as single chunk
  if (normalizedText.length <= chunkSize) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  const paragraphs = normalizedText.split(/\n\n+/); // Split by double+ newlines

  let currentChunk = '';
  let previousChunk = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();

    if (!paragraph) continue;

    // Check if adding this paragraph would exceed chunk size
    const potentialChunk = currentChunk
      ? currentChunk + '\n\n' + paragraph
      : paragraph;

    if (potentialChunk.length <= chunkSize) {
      // Paragraph fits in current chunk
      currentChunk = potentialChunk;
    } else {
      // Current chunk is full, save it
      if (currentChunk) {
        chunks.push(currentChunk);
        previousChunk = currentChunk;

        // Start new chunk with overlap from previous chunk
        const overlapText = getOverlapText(previousChunk, overlap);
        currentChunk = overlapText
          ? overlapText + '\n\n' + paragraph
          : paragraph;
      } else {
        // Single paragraph is longer than chunk size, need to split it
        const splitParagraphs = splitLongParagraph(
          paragraph,
          chunkSize,
          overlap
        );
        chunks.push(...splitParagraphs.slice(0, -1));
        currentChunk = splitParagraphs[splitParagraphs.length - 1];
        previousChunk = currentChunk;
      }
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  const cleanedChunks = chunks.filter((chunk) => chunk.trim().length > 0);

  if (minChunkSize <= 0) {
    return cleanedChunks;
  }

  return mergeSmallChunks(cleanedChunks, minChunkSize);
}

function mergeSmallChunks(chunks: string[], minChunkSize: number): string[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const merged: string[] = [];

  for (const chunk of chunks) {
    if (merged.length === 0) {
      merged.push(chunk);
      continue;
    }

    if (chunk.length < minChunkSize) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${chunk}`;
      continue;
    }

    merged.push(chunk);
  }

  if (merged.length > 1 && merged[merged.length - 1].length < minChunkSize) {
    const tail = merged.pop();
    if (tail) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${tail}`;
    }
  }

  return merged;
}

/**
 * Get the last N characters from text for overlap
 * Tries to break at sentence boundary
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) {
    return text;
  }

  const overlapText = text.slice(-overlapSize);

  // Try to find a sentence boundary (. ! ?)
  const sentenceMatch = overlapText.match(/[.!?]\s+/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    return overlapText.slice(sentenceMatch.index + sentenceMatch[0].length);
  }

  // No sentence boundary, return full overlap
  return overlapText;
}

/**
 * Split a single long paragraph into smaller chunks
 * Used when a paragraph exceeds the chunk size
 */
function splitLongParagraph(
  paragraph: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const sentences = paragraph.split(/(?<=[.!?])\s+/); // Split by sentences

  let currentChunk = '';
  let previousChunk = '';

  for (const sentence of sentences) {
    const potentialChunk = currentChunk
      ? currentChunk + ' ' + sentence
      : sentence;

    if (potentialChunk.length <= chunkSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        previousChunk = currentChunk;

        const overlapText = getOverlapText(previousChunk, overlap);
        currentChunk = overlapText ? overlapText + ' ' + sentence : sentence;
      } else {
        // Single sentence longer than chunk size, force split
        const words = sentence.split(/\s+/);
        let wordChunk = '';

        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= chunkSize) {
            wordChunk = wordChunk ? wordChunk + ' ' + word : word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }

        if (wordChunk) currentChunk = wordChunk;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Get statistics about chunked text
 * Useful for debugging and monitoring
 */
export function getChunkingStats(chunks: string[]): {
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  totalCharacters: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
      totalCharacters: 0,
    };
  }

  const sizes = chunks.map((chunk) => chunk.length);
  const totalCharacters = sizes.reduce((sum, size) => sum + size, 0);

  return {
    totalChunks: chunks.length,
    avgChunkSize: Math.round(totalCharacters / chunks.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
    totalCharacters,
  };
}

type PDFTextResult = { data: string; pages: number };

export async function extractPDFText(
  signedUrl: string
): Promise<PDFTextResult> {
  console.log('[Step 1] Extracting text from PDF');
  // Lazy-load parser to keep PDF runtime dependencies out of unrelated routes.
  // unpdf ships a serverless build of pdf.js with no native dependencies and
  // no separate worker file, both of which broke under Next's serverless
  // bundling: pdf.js' Node path pulled in @napi-rs/canvas purely to define
  // globalThis.DOMMatrix for rendering code that text extraction never runs.
  const { extractText, getDocumentProxy } = await import('unpdf');

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download PDF: ${response.status} ${response.statusText}`
    );
  }
  const buffer = await response.arrayBuffer();

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  if (!text || text.trim().length === 0) {
    throw new Error(
      'No text found in PDF. Document may be scanned or image-based.'
    );
  }

  console.log(
    `[Step 1] Extracted ${text.length} characters from ${totalPages} pages`
  );
  return { data: text.trim(), pages: totalPages };
}

export async function insertChunksInBatches(
  documentId: string,
  chunks: string[],
  embeddings: number[][]
): Promise<number> {
  const supabase = await createServiceClient();

  // Prepare chunks for insertion
  const chunksToInsert = chunks.map((chunk, index) => ({
    document_id: documentId,
    content: chunk,
    // `vector` is exposed as text by PostgREST; a JSON array literal is
    // what Postgres parses back into a vector.
    embedding: JSON.stringify(embeddings[index]),
    chunk_index: index,
    metadata: {
      length: chunk.length,
      position: index,
      totalChunks: chunks.length,
    },
  }));

  // Insert in batches to avoid payload size limits
  const BATCH_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
    const batch = chunksToInsert.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from('document_chunks').insert(batch);

    // If insert fails, try cleaning up previously inserted chunks
    if (error) {
      await supabase.from('documents').delete().eq('id', documentId);

      throw new Error(`Failed to insert chunks: ${error.message}`);
    }

    insertedCount += batch.length;
    console.log(
      `[Step 3] Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(chunksToInsert.length / BATCH_SIZE)} ` +
        `(${insertedCount}/${chunksToInsert.length} chunks total)`
    );
  }
  return insertedCount;
}

export async function updateDocumentStatus(
  documentId: string,
  status: Extract<DocumentStatus, 'ready' | 'failed'>,
  pageCount?: number,
  metrics?: { embeddingTokens?: number }
): Promise<void> {
  const supabase = await createServiceClient();

  // Only send fields that were actually supplied, so a partial update cannot
  // null out a column an earlier step already wrote. Every caller currently
  // passes a page count, but the metrics are genuinely optional.
  const update: TablesUpdate<'documents'> = { status };

  if (pageCount !== undefined) {
    update.page_count = pageCount;
  }

  if (metrics?.embeddingTokens !== undefined) {
    update.embedding_tokens = metrics.embeddingTokens;
  }

  const { error } = await supabase
    .from('documents')
    .update(update)
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

/**
 * Store temporary processing data in database
 * Used for passing large data between Inngest steps
 */
export async function storeTempData(
  documentId: string,
  stepName: string,
  data: Json
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from('processing_temp').upsert(
    {
      document_id: documentId,
      step_name: stepName,
      data: data,
    },
    {
      onConflict: 'document_id,step_name',
    }
  );

  if (error) {
    throw new Error(`Failed to store temp data: ${error.message}`);
  }

  console.log(`[TempStorage] Stored ${stepName} for document ${documentId}`);
}

/**
 * Retrieve temporary processing data from database
 */
export async function getTempData<T = any>(
  documentId: string,
  stepName: string
): Promise<T> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('processing_temp')
    .select('data')
    .eq('document_id', documentId)
    .eq('step_name', stepName)
    .single();

  if (error) {
    throw new Error(`Failed to retrieve temp data: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No temp data found for ${stepName}`);
  }

  console.log(`[TempStorage] Retrieved ${stepName} for document ${documentId}`);

  return data.data as T;
}

/**
 * Clean up temporary data for a document
 * Call this after successful processing or on failure
 */
export async function cleanupTempData(documentId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('processing_temp')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    console.error(`Failed to cleanup temp data: ${error.message}`);
    // Don't throw - cleanup is non-critical
  } else {
    console.log(
      `[TempStorage] Cleaned up temp data for document ${documentId}`
    );
  }
}
