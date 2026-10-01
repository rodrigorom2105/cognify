import { inngest } from '@/lib/inngest/client';
import { createServiceClient } from '@/lib/supabase/service';
import { generateEmbeddingsInBatches } from '@/lib/openai/embeddings';
import {
  chunkText,
  DEFAULT_CHUNKING_CONFIG,
  getChunkingStats,
  extractPDFText,
  normalizeExtractedText,
  insertChunksInBatches,
  updateDocumentStatus,
  storeTempData,
  getTempData,
  cleanupTempData,
  CHUNK_INSERT_BATCH_SIZE,
} from '@/lib/utils';
import { ChunkData, EmbeddingData } from '@/types';

const EMBEDDING_BATCH_SIZE = 100;

/**
 * Inngest background function for processing uploaded PDF documents
 *
 * Triggered by: 'document.uploaded' event
 *
 * Steps:
 * 1. Download PDF from Supabase Storage
 * 2. Extract text using unpdf
 * 3. Chunk text using tuned config (1500 size / 300 overlap / 350 min)
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
  async ({ event, step, attempt }) => {
    const { documentId, userId, storagePath } = event.data;

    console.log(
      `[Inngest] Starting processing document for document: ${documentId}`
    );

    try {
      // Step 1: Extract & Chunk (cheap, deterministic, fast)
      // Every timing below is taken inside its step and returned from it.
      // Inngest replays the function body from the top on each step, so a
      // Date.now() outside step.run would be re-read on every replay, while a
      // value returned from a step is memoized at the moment it ran.
      const extracted = await step.run('extract-and-chunk', async () => {
        const startedAt = Date.now();
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
        const extractedAt = Date.now();
        const cleanedText = normalizeExtractedText(text.data);
        const chunkingConfig = DEFAULT_CHUNKING_CONFIG;
        const textChunks = chunkText(cleanedText, chunkingConfig);

        // Get stats for logging
        const stats = getChunkingStats(textChunks);
        console.log(`[Step 1] Chunking completed:`, {
          sourceCharacters: text.data.length,
          normalizedCharacters: cleanedText.length,
          chunkingConfig,
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

        return {
          totalChunks: textChunks.length,
          pageCount: text.pages,
          startedAt,
          ms: Date.now() - startedAt,
          extractMs: extractedAt - startedAt,
          chunkMs: Date.now() - extractedAt,
          attempt,
          sourceCharacters: text.data.length,
          normalizedCharacters: cleanedText.length,
          avgChunkSize: stats.avgChunkSize,
          minChunkSize: stats.minChunkSize,
          maxChunkSize: stats.maxChunkSize,
        };
      });
      const { totalChunks, pageCount } = extracted;

      // Step 2: Generate Embeddings
      const embedded = await step.run('generate-embeddings', async () => {
        const startedAt = Date.now();
        console.log(`[Step 2] Generate embeddings for ${totalChunks} chunks`);
        const { chunks } = await getTempData<ChunkData>(documentId, 'chunks');
        const { embeddings, tokens } = await generateEmbeddingsInBatches(
          chunks,
          EMBEDDING_BATCH_SIZE
        );

        await storeTempData(documentId, 'embeddings', {
          embeddings,
        });

        console.log(
          `[Step 2] Embedded ${embeddings.length} chunks using ${tokens} tokens`
        );

        // Returned rather than written to processing_temp: it is a single
        // number, so it fits in the step payload that the temp table exists
        // to avoid, and step 4 needs it.
        return {
          embeddingCount: embeddings.length,
          embeddingTokens: tokens,
          batches: Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE),
          ms: Date.now() - startedAt,
          attempt,
        };
      });
      const { embeddingTokens } = embedded;

      // Step 3: Store in Database
      const stored = await step.run('store-chunks', async () => {
        const startedAt = Date.now();
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
        return { insertedCount, ms: Date.now() - startedAt, attempt };
      });
      const storedCount = stored.insertedCount;

      // Step 4: Update Status
      await step.run('finalize', async () => {
        console.log('[Step 4] Updating document status to ready');
        const completedAt = Date.now();
        await updateDocumentStatus(documentId, 'ready', pageCount, {
          embeddingTokens,
          chunkCount: storedCount,
          processingStartedAt: new Date(extracted.startedAt).toISOString(),
          processingCompletedAt: new Date(completedAt).toISOString(),
          processingMetrics: {
            // event.ts is when the upload action sent the event, so this is
            // time spent waiting in Inngest's queue before any work began.
            queueMs: event.ts ? extracted.startedAt - event.ts : null,
            pipelineMs: completedAt - extracted.startedAt,
            // `retries` is Inngest's zero-indexed attempt: 0 = first try.
            steps: {
              extractAndChunk: {
                ms: extracted.ms,
                extractMs: extracted.extractMs,
                chunkMs: extracted.chunkMs,
                retries: extracted.attempt,
              },
              generateEmbeddings: {
                ms: embedded.ms,
                batches: embedded.batches,
                retries: embedded.attempt,
              },
              storeChunks: {
                ms: stored.ms,
                batches: Math.ceil(storedCount / CHUNK_INSERT_BATCH_SIZE),
                retries: stored.attempt,
              },
            },
            text: {
              sourceCharacters: extracted.sourceCharacters,
              normalizedCharacters: extracted.normalizedCharacters,
            },
            chunks: {
              count: storedCount,
              avgSize: extracted.avgChunkSize,
              minSize: extracted.minChunkSize,
              maxSize: extracted.maxChunkSize,
            },
          },
        });
        console.log('[Step 4] Document status updated to ready');
        return { status: 'ready' };
      });

      // Step 4b: Meter the embedding cost against the user's quota.
      //
      // Its own step rather than part of 'finalize': Inngest memoizes a step
      // once it succeeds, so keeping the increment separate stops a failure
      // here from re-running the status update, and vice versa — a retry that
      // replayed both would double-count the tokens.
      await step.run('record-token-usage', async () => {
        console.log(`[Step 4b] Recording ${embeddingTokens} embedding tokens`);
        const supabase = await createServiceClient();

        const { error } = await supabase.rpc('increment_tokens_consumed', {
          user_id_input: userId,
          tokens_input: embeddingTokens,
        });

        if (error) {
          throw new Error(`Failed to record token usage: ${error.message}`);
        }

        return { embeddingTokens };
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

        const { error: updateError } = await supabase
          .from('documents')
          .update({
            status: 'failed',
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
            processing_completed_at: new Date().toISOString(),
          })
          .eq('id', documentId);

        if (updateError) {
          console.error(
            `[Inngest] Failed to mark document ${documentId} as failed: ${updateError.message}`
          );
        }
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
