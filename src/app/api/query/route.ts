import { streamRAGAnswer } from '@/lib/openai/chat';
import { generateQueryEmbedding } from '@/lib/openai/embeddings';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
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
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Vector similarity search - top 8 most relevant chunks
    const { data: chunks, error: searchError } = await supabase.rpc(
      'match_document_chunks',
      {
        query_embedding: queryEmbedding,
        match_document_id: documentId,
        match_count: 8,
      }
    );

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

    // 3. Stream answer
    const { stream, tokenUsed } = await streamRAGAnswer(query, {
      chunks,
      documentName: document.filename,
    });

    // 4. Save query record and update usage in the background
    const saveQuery = async (answerText: string) => {
      await supabase.from('queries').insert({
        user_id: user.id,
        document_id: documentId,
        query_text: query,
        answer_text: answerText,
        tokens_used: tokenUsed,
      });

      await supabase.rpc('increment_queries_made', { user_id_input: user.id });
    };

    // Pipe stream + collect full answer for saving
    const [streamForClient, streamForSaving] = stream.tee();

    // Collect answer text for DB save
    (async () => {
      const reader = streamForSaving.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullAnswer += decoder.decode(value);
      }
      await saveQuery(fullAnswer);
    })();

    // Stream response to client with chunk metada in headers
    return new Response(streamForClient, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-chunks': JSON.stringify(
          chunks.map(
            (chunk: {
              content: string;
              chunk_index: number;
              similarity: number;
            }) => ({
              chunk_index: chunk.chunk_index,
              similarity: chunk.similarity,
              preview: chunk.content.slice(0, 150) + '...',
            })
          )
        ),
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
