'use client';

import { useEffect, useRef } from 'react';
import { Bot, Loader2 } from 'lucide-react';
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

  //Auto-scroll as answer streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answer]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive font-medium">Error</p>
        <p className="text-sm text-destructive/80 mt-1">{error}</p>
      </div>
    );
  }

  if (!answer && !isStreaming) return null;

  return (
    <div className="space-y-4">
      {/* Answer box */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">Answer</span>
          {isStreaming && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>

        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {answer}
          {/* Blinking cursor while streaming */}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>

      {/* Sources — only show after streaming completes */}
      {!isStreaming && chunks.length > 0 && <SourceCitations chunks={chunks} />}

      <div ref={bottomRef} />
    </div>
  );
}
