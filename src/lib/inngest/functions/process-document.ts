import { inngest } from '@/lib/inngest/client';
import { createServiceClient } from '@/lib/supabase/service';
import { generateEmbeddingsInBatches } from '@/lib/openai/embeddings';
import {
  chunkText,
  getChunkingStats,
  extractPDFText,
  insertChunksInBatches,
  updateDocumentStatus,
  storeTempData,
  getTempData,
  cleanupTempData,
} from '@/lib/utils';
import { PDFParse } from 'pdf-parse';

interface ChunkData {
  chunks: string[];
}

interface EmbeddingData {
  embeddings: number[][];
}

/**
 * Inngest background function for processing uploaded PDF documents
 *
 * Triggered by: 'document.uploaded' event
 *
 * Steps:
 * 1. Download PDF from Supabase Storage
 * 2. Extract text using pdf-parse
 * 3. Chunk text into ~1000 character pieces with overlap
 * 4. Generate embeddings for each chunk (OpenAI)
 * 5. Store chunks + embeddings in pgvector
 * 6. Update document status to 'ready'
 *
 * Each step uses step.run() for automatic retries and observability
 */
export const processDocument = inngest.createFunction(
  {
    id: 'process-document',
    name: 'Process Uploaded Document',
    retries: 3,
  },
  { event: 'document.uploaded' },
  async ({ event, step }) => {
    const { documentId, userId, storagePath, filename } = event.data;

    console.log(
      `[Inngest] Starting processing document for document: ${documentId}`
    );

    try {
      // Step 1: Extract & Chunk (cheap, deterministic, fast)
      const { totalChunks, pageCount } = await step.run(
        'extract-and-chunk',
        async () => {
          console.log(`[Step 1] Getting signed URL for PDF`);
          const supabase = await createServiceClient();

          const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

          if (error) {
            throw new Error(`Failed to create signed URL: ${error.message}`);
          }

          if (!data || !data.signedUrl) {
            throw new Error('No signed URL received from storage');
          }
          const text = await extractPDFText(data.signedUrl);
          const textChunks = chunkText(text.data, 1000, 200);

          // Get stats for logging
          const stats = getChunkingStats(textChunks);
          console.log(`[Step 1] Chunking completed:`, {
            totalChunks: stats.totalChunks,
            avgSize: stats.avgChunkSize,
            minSize: stats.minChunkSize,
            maxSize: stats.maxChunkSize,
            totalCharacters: stats.totalCharacters,
          });

          if (textChunks.length === 0) {
            throw new Error('Text chunking resulted in no chunks');
          }

          await storeTempData(documentId, 'chunks', {
            chunks: textChunks,
          });

          return { totalChunks: textChunks.length, pageCount: text.pages };
        }
      );

      // Step 2: Generate Embeddings
      await step.run('generate-embeddings', async () => {
        console.log(`[Step 2] Generate embeddings for ${totalChunks} chunks`);
        const { chunks } = await getTempData<ChunkData>(documentId, 'chunks');
        const embeddingResults = await generateEmbeddingsInBatches(chunks, 100);

        await storeTempData(documentId, 'embeddings', {
          embeddings: embeddingResults,
        });

        return { embeddingCount: embeddingResults.length };
      });

      // Step 3: Store in Database
      const storedCount = await step.run('store-chunks', async () => {
        console.log('[Step 3] Storing chunks in database');
        const { chunks } = await getTempData<ChunkData>(documentId, 'chunks');
        const { embeddings: embeddingData } = await getTempData<EmbeddingData>(
          documentId,
          'embeddings'
        );

        const insertedCount = await insertChunksInBatches(
          documentId,
          chunks,
          embeddingData
        );
        return insertedCount;
      });

      // Step 4: Update Status
      await step.run('finalize', async () => {
        console.log('[Step 4] Updating document status to ready');
        await updateDocumentStatus(documentId, 'ready', pageCount);
        console.log('[Step 4] Document status updated to ready');
        return { status: 'ready' };
      });

      // Step 5: Cleanup Temporary Data
      await step.run('cleanup-temp-data', async () => {
        console.log('[Cleanup] Removing temporary data');
        await cleanupTempData(documentId);
      });

      // Send success event
      await step.sendEvent('send-success-event', {
        name: 'document.processed',
        data: {
          documentId,
          userId,
          chunkCount: storedCount,
          pageCount: pageCount,
        },
      });

      console.log(`[Inngest] Processing complete for document ${documentId}`);

      return { success: true };
    } catch (error) {
      // If any step fails, mark document as failed
      console.error(
        `[Inngest] Processing failed for document ${documentId}:`,
        error
      );

      await step.run('mark-as-failed', async () => {
        const supabase = await createServiceClient();

        await supabase
          .from('documents')
          .update({ status: 'failed' })
          .eq('id', documentId);
      });

      // Send failure event
      await step.sendEvent('send-failure-event', {
        name: 'document.failed',
        data: {
          documentId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }
);
