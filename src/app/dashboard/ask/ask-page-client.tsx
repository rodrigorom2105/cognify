'use client';

import { useRef, useState } from 'react';
import { DocumentSelector } from '@/components/query/document-selector';
import { QueryInput } from '@/components/query/query-input';
import { AnswerDisplay } from '@/components/query/answer-display';
import { QueryHistory } from '@/components/query/query-history';
import { SourceChunk } from '@/components/query/source-citations';
import { Document, Query } from '@/types';
import { Separator } from '@/components/ui/separator';

interface AskPageClientProps {
  documents: Document[];
  initialQueries: Query[];
}

export function AskPageClient({
  documents,
  initialQueries,
}: AskPageClientProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chunks, setChunks] = useState<SourceChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>(initialQueries);
  const requestIdRef = useRef(0);

  const filteredQueries = selectedDocId
    ? queries.filter((query) => query.document_id === selectedDocId)
    : [];

  const handleDocumentSelect = (documentId: string) => {
    requestIdRef.current += 1;
    setSelectedDocId(documentId);
    setAnswer('');
    setChunks([]);
    setError(null);
    setIsStreaming(false);
  };

  const handleQuery = async (queryText: string) => {
    if (!selectedDocId) return;

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    const queryDocumentId = selectedDocId;

    // Reset state for new query
    setAnswer('');
    setChunks([]);
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, documentId: queryDocumentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Something went wrong');
      }

      // Extract chunk metadata from headers
      const chunksHeader = response.headers.get('X-chunks');
      if (chunksHeader) {
        if (requestIdRef.current !== currentRequestId) return;
        setChunks(JSON.parse(chunksHeader));
      }

      // Stream the response body
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      let fullAnswer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        fullAnswer += text;
        if (requestIdRef.current !== currentRequestId) {
          reader.cancel();
          return;
        }
        setAnswer(fullAnswer);
      }

      if (requestIdRef.current !== currentRequestId) return;

      // Add to local query history (optimistic update)
      const newQuery: Query = {
        id: crypto.randomUUID(),
        user_id: '',
        document_id: queryDocumentId,
        query_text: queryText,
        answer_text: fullAnswer,
        tokens_used: null,
        prompt_tokens: null,
        completion_tokens: null,
        embedding_tokens: null,
        created_at: new Date().toISOString(),
      };
      setQueries((prev) => [newQuery, ...prev]);
    } catch (err) {
      if (requestIdRef.current !== currentRequestId) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsStreaming(false);
      }
    }
  };

  const handleReuse = (queryText: string) => {
    // Scroll to top and pre-fill — handled by QueryInput via parent state
    // For now just re-trigger the query
    handleQuery(queryText);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Ask your documents
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select a document and ask any question — answers are generated from
          the document content.
        </p>
      </div>

      {/* Document selector */}
      <DocumentSelector
        documents={documents}
        selectedId={selectedDocId}
        onSelect={handleDocumentSelect}
      />

      {/* Query input */}
      <QueryInput
        onSubmit={handleQuery}
        isLoading={isStreaming}
        disabled={!selectedDocId}
      />

      {/* Answer + citations */}
      <AnswerDisplay
        answer={answer}
        isStreaming={isStreaming}
        chunks={chunks}
        error={error}
      />

      {/* Query history */}
      {filteredQueries.length > 0 && (
        <>
          <Separator />
          <QueryHistory queries={filteredQueries} onReuse={handleReuse} />
        </>
      )}
    </div>
  );
}
