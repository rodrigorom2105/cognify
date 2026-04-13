'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface SourceChunk {
  chunk_index: number;
  similarity: number;
  preview: string;
}

interface SourceCitationsProps {
  chunks: SourceChunk[];
}

export function SourceCitations({ chunks }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleChunks = expanded ? chunks : chunks.slice(0, 2);

  const getSimilarityColor = (similarity: number) => {
    // Calibrated for cosine similarity in document RAG retrieval.
    if (similarity >= 0.55)
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    if (similarity >= 0.35)
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
    return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
  };

  const getSimilarityLabel = (similarity: number) => {
    if (similarity >= 0.55) return 'Strong';
    if (similarity >= 0.35) return 'Relevant';
    return 'Weak';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Quote className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Sources used
        </span>
        <Badge variant="secondary" className="text-xs">
          {chunks.length} chunk{chunks.length > 1 ? 's' : ''}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Typical useful range: 0.25 to 0.60
        </span>
      </div>

      <div className="space-y-2">
        {visibleChunks.map((chunk, i) => (
          <div
            key={chunk.chunk_index}
            className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Source {i + 1} · Chunk #{chunk.chunk_index}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getSimilarityColor(chunk.similarity)}`}
              >
                {getSimilarityLabel(chunk.similarity)} (
                {chunk.similarity.toFixed(3)})
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {chunk.preview}
            </p>
          </div>
        ))}
      </div>

      {chunks.length > 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 text-xs text-muted-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" /> Show {chunks.length - 2}{' '}
              more
            </>
          )}
        </Button>
      )}
    </div>
  );
}
