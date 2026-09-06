'use client';

import { useState } from 'react';

export interface SourceChunk {
  chunk_index: number;
  similarity: number;
  preview: string;
}

interface SourceCitationsProps {
  chunks: SourceChunk[];
}

// Below this, a passage is close enough to be retrieved but not close enough
// to be worth reading. Flagging only those beats labelling all three states.
const WEAK_MATCH = 0.35;

export function SourceCitations({ chunks }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleChunks = expanded ? chunks : chunks.slice(0, 3);
  const closest = chunks.reduce(
    (best, chunk) => (chunk.similarity > best.similarity ? chunk : best),
    chunks[0]
  );

  return (
    <section className="space-y-4" aria-label="Passages used">
      <div className="border-b pb-2">
        <h2 className="heading text-sm">Passages used</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Numbered as the answer cites them. &para; marks where the passage sits
          in the document, and the decimal is how close it was to your question
          &mdash; 0.25 to 0.60 is a normal match. The closest is highlighted.
        </p>
      </div>

      <ol className="space-y-5">
        {visibleChunks.map((chunk, index) => (
          <li key={chunk.chunk_index} className="flex gap-4">
            <div className="rail w-20 pt-0.5 leading-5">
              <div className="text-foreground font-medium">{index + 1}</div>
              <div>&para;{chunk.chunk_index}</div>
              <div>{chunk.similarity.toFixed(3)}</div>
              {chunk.similarity < WEAK_MATCH && (
                <div className="mt-1">weak</div>
              )}
            </div>

            <p className="prose-doc-sm text-foreground min-w-0 flex-1">
              {chunk.chunk_index === closest.chunk_index ? (
                <span className="mark-span">{chunk.preview}</span>
              ) : (
                chunk.preview
              )}
            </p>
          </li>
        ))}
      </ol>

      {chunks.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-primary rounded-md text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {expanded
            ? 'Show fewer passages'
            : `Show ${chunks.length - 3} more passages`}
        </button>
      )}
    </section>
  );
}
