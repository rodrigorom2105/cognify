import { clsx, type ClassValue } from 'clsx';
import { PDFParse } from 'pdf-parse';
import { twMerge } from 'tailwind-merge';
import { createServiceClient } from '@/lib/supabase/service';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * @param chunkSize - Target size for each chunk in characters (default: 1000)
 * @param overlap - Number of overlapping characters between chunks (default: 200)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

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

  return chunks.filter((chunk) => chunk.trim().length > 0);
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
  // Initialize PDFParse with URL (v2 API)
  const parser = new PDFParse({ url: signedUrl });
  try {
    // Use getText() method to extract text and getInfo() for metadata
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo(),
    ]);

    if (!textResult.text || textResult.text.trim().length === 0) {
      throw new Error(
        'No text found in PDF. Document may be scanned or image-based.'
      );
    }

    console.log(
      `[Step 1] Extracted ${textResult.text.length} characters from ${infoResult.total} pages`
    );
    return { data: textResult.text.trim(), pages: infoResult.total };
  } finally {
    // Always destroy parser to free memory (v2 requirement)
    await parser.destroy();
  }
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
    embedding: embeddings[index],
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
  status: 'ready' | 'failed',
  pageCount?: number
): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('documents')
    .update({
      status,
      page_count: pageCount,
    })
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
  data: any
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
