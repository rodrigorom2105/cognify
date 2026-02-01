import { inngest } from '@/lib/inngest/client';
import { createServiceClient } from '@/lib/supabase/service';
import { generateEmbeddingsInBatches } from '@/lib/openai/embeddings';
import { chunkText, getChunkingStats } from '@/lib/utils';
import { PDFParse } from 'pdf-parse';

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
      // Step 1: Get signed URL for PDF from Supabase Storage
      // Step 2: Extract text from PDF using URL
      const extractedData = await step.run(
        'download-and-extract-text',
        async () => {
          console.log(`[Step 1] Getting signed URL for PDF: ${storagePath}`);

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

          console.log(`[Step 1] Generated signed URL`);
          console.log(data.signedUrl);

          console.log('[Step 2] Extracting text from PDF');
          // Initialize PDFParse with URL (v2 API)
          const parser = new PDFParse({ url: data.signedUrl });

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

            const result = {
              text: textResult.text.trim(),
              pageCount: infoResult.total || 0,
              metadata: {
                info: infoResult.info,
                metadata: infoResult.metadata,
              },
            };

            console.log(
              `[Step 2] Extracted ${result.text.length} characters from ${result.pageCount} pages`
            );
            return result;
          } finally {
            // Always destroy parser to free memory (v2 requirement)
            await parser.destroy();
          }
        }
      );

      // Step 3: Chunk text into manageable pieces
      const chunks = await step.run('chunk-text', async () => {
        console.log('[Step 3] Chunking text');

        const textChunks = chunkText(extractedData.text as string, 1000, 200);

        // Get stats for logging
        const stats = getChunkingStats(textChunks);
        console.log(`[Step 3] Chunked completed:`, {
          totalChunks: stats.totalChunks,
          avgSize: stats.avgChunkSize,
          minSize: stats.minChunkSize,
          maxSize: stats.maxChunkSize,
          totalCharacters: stats.totalCharacters,
        });

        if (textChunks.length === 0) {
          throw new Error('Text chunking resulted in no chunks');
        }

        return textChunks;
      });

      // Step 4: Generate embeddings for each chunk
      const embeddings = await step.run('generate-embeddings', async () => {
        console.log(`[Step 4] Generate embeddings for ${chunks.length} chunks`);

        // Use batching to avoid rate limits (100 chunks per batch)
        const allEmbeddings = await generateEmbeddingsInBatches(chunks, 100);

        console.log(`[Step 4] Generated ${allEmbeddings.length} embeddings`);

        // Verify embeddings count matches chunks count
        if (allEmbeddings.length !== chunks.length) {
          throw new Error(
            `Embedding count mismatch: ${allEmbeddings.length} embeddings for ${chunks.length} chunks`
          );
        }

        return allEmbeddings;
      });

      // Step 5: Store chunks + embeddings in database
      const storedCount = await step.run('store-chunks', async () => {
        console.log('[Step 5] Storing chunks in database');

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

          const { error } = await supabase
            .from('document_chunks')
            .insert(batch);

          // If insert fails, try cleaning up previously inserted chunks
          if (error) {
            await supabase.from('documents').delete().eq('id', documentId);

            throw new Error(`Failed to insert chunks: ${error.message}`);
          }

          insertedCount += batch.length;
          console.log(
            `[Step 5] Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(chunksToInsert.length / BATCH_SIZE)} ` +
              `(${insertedCount}/${chunksToInsert.length} chunks total)`
          );
        }

        console.log(`[Step 5] Stored ${insertedCount} chunks`);
        return insertedCount;
      });

      // Step 6: Update document status to 'ready'
      await step.run('update-document-status', async () => {
        console.log('[Step 6] Updating document status to ready');

        const supabase = await createServiceClient();

        const { error } = await supabase
          .from('documents')
          .update({
            status: 'ready',
            page_count: extractedData.pageCount,
          })
          .eq('id', documentId);

        if (error) {
          throw new Error(`Failed to update document status: ${error.message}`);
        }

        console.log('[Step 6] Document status updated to ready');
      });

      // Send success event
      await step.sendEvent('send-success-event', {
        name: 'document.processed',
        data: {
          documentId,
          userId,
          chunkCount: chunks.length,
          pageCount: extractedData.pageCount,
        },
      });

      console.log(`[Inngest] Processing complete for document ${documentId}`);

      return {
        success: true,
        documentId,
        chunkCount: chunks.length,
        pageCount: extractedData.pageCount,
      };
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
