'use client';

import { useEffect, useRef } from 'react';
import { SourceCitations, SourceChunk } from './source-citations';

interface AnswerDisplayProps {
  answer: string;
  isStreaming: boolean;
  chunks: SourceChunk[];
  error: string | null;
}

export function AnswerDisplay({
  answer,
  isStreaming,
  chunks,
  error,
}: AnswerDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Follow the answer as it streams.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [answer]);

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-4">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  if (!answer && !isStreaming) return null;

  return (
    <div className="space-y-8">
      <div aria-live="polite" aria-busy={isStreaming}>
        <p className="prose-doc text-foreground whitespace-pre-wrap">
          {answer}
          {isStreaming && (
            <span
              className="bg-primary ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse align-text-bottom"
              aria-hidden="true"
            />
          )}
        </p>
      </div>

      {/* Passages are only meaningful once the answer that used them is whole. */}
      {!isStreaming && chunks.length > 0 && <SourceCitations chunks={chunks} />}

      <div ref={bottomRef} />
    </div>
  );
}
