import { streamRAGAnswer } from '@/lib/openai/chat';
import { generateQueryEmbedding } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import { after, NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Every latency recorded for this query is measured from here, so ttft_ms
  // and total_ms include auth and the ownership check, as a user would feel.
  const requestStartedAt = Date.now();

  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, documentId } = await request.json();

    if (!query?.trim() || !documentId) {
      return NextResponse.json(
        { error: 'Missing query or documentId' },
        { status: 400 }
      );
    }

    // Verify document belongs to user and is ready
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, filename, status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'ready') {
      return NextResponse.json(
        { error: 'Document is still processing' },
        { status: 400 }
      );
    }

    // 1. Embed the query
    const embedStartedAt = Date.now();
    const { embedding: queryEmbedding, tokens: embeddingTokens } =
      await generateQueryEmbedding(query);
    const embedMs = Date.now() - embedStartedAt;

    // 2. Vector similarity search - top 8 most relevant chunks
    const retrievalStartedAt = Date.now();
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_document_chunks',
      {
        query_embedding: JSON.stringify(queryEmbedding),
        match_document_id: documentId,
        match_count: 8,
      }
    );
    const retrievalMs = Date.now() - retrievalStartedAt;

    if (searchError) {
      console.error('Vector Search Error:', searchError);
      return NextResponse.json(
        { error: 'Failed to perform vector search' },
        { status: 500 }
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No relevant content found' },
        { status: 404 }
      );
    }

    const similarities = chunks.map((chunk) => chunk.similarity);

    // Header values must be ByteStrings (Latin-1). Chunk text is arbitrary
    // Unicode — math symbols, accents, CJK — and a single character above
    // U+00FF made the Response constructor throw, failing the whole request.
    // Built before streaming starts so a failure here cannot leave a query
    // recorded for an answer that was never sent.
    const chunksHeader = encodeURIComponent(
      JSON.stringify(
        chunks.map((chunk) => ({
          chunk_index: chunk.chunk_index,
          similarity: chunk.similarity,
          preview: chunk.content.slice(0, 150) + '...',
        }))
      )
    );

    // 3. Stream answer
    const { stream, usage, timing } = await streamRAGAnswer(query, {
      chunks,
      documentName: document.filename,
    });

    // Pipe stream + collect full answer for saving
    const [streamForClient, streamForSaving] = stream.tee();

    // 4. Record the query once the answer has finished streaming.
    //
    // This has to run through `after()`. The work depends on the stream being
    // fully drained, which happens after the response is returned, and a
    // serverless function is free to freeze the moment the response completes
    // — a bare floating promise here gets killed mid-insert and the row is
    // lost with no error anywhere.
    after(async () => {
      try {
        const reader = streamForSaving.getReader();
        const decoder = new TextDecoder();
        let fullAnswer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullAnswer += decoder.decode(value, { stream: true });
        }
        fullAnswer += decoder.decode();

        // Safe to await only now that the stream is drained.
        const { promptTokens, completionTokens, totalTokens } = await usage;
        const { startedAt, firstTokenAt, completedAt } = await timing;

        if (totalTokens === 0) {
          console.warn(
            `No token usage reported for query on document ${documentId}`
          );
        }

        const { error: insertError } = await supabase.from('queries').insert({
          user_id: user.id,
          document_id: documentId,
          query_text: query,
          answer_text: fullAnswer,
          tokens_used: totalTokens,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          embedding_tokens: embeddingTokens,
          embed_ms: embedMs,
          retrieval_ms: retrievalMs,
          ttft_ms:
            firstTokenAt === null ? null : firstTokenAt - requestStartedAt,
          generation_ms: completedAt - startedAt,
          total_ms: completedAt - requestStartedAt,
          chunks_returned: chunks.length,
          top_similarity: Math.max(...similarities),
          avg_similarity:
            similarities.reduce((sum, value) => sum + value, 0) /
            similarities.length,
        });

        if (insertError) {
          console.error('Failed to record query:', insertError);
        }

        const { error: usageError } = await supabase.rpc(
          'increment_queries_made',
          { user_id_input: user.id }
        );

        if (usageError) {
          console.error('Failed to increment query usage:', usageError);
        }

        // Roll the per-query cost into the user_usage total. The query costs
        // both chat tokens and the embedding tokens spent turning the question
        // into a vector, so both are billed here.
        const { error: tokenUsageError } = await supabase.rpc(
          'increment_tokens_consumed',
          {
            user_id_input: user.id,
            tokens_input: totalTokens + embeddingTokens,
          }
        );

        if (tokenUsageError) {
          console.error('Failed to increment token usage:', tokenUsageError);
        }

        console.log(
          `Query recorded: document=${documentId} prompt=${promptTokens} completion=${completionTokens} total=${totalTokens} embedding=${embeddingTokens}`
        );
      } catch (error) {
        console.error('Failed to record query:', error);
      }
    });

    // Stream response to client with chunk metada in headers
    return new Response(streamForClient, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-chunks': chunksHeader,
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Query API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
