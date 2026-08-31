'use client';

import { useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Query } from '@/types';

interface QueryHistoryProps {
  queries: Query[];
  onReuse: (queryText: string) => void;
}

export function QueryHistory({ queries, onReuse }: QueryHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (queries.length === 0) return null;

  const visibleQueries = expanded ? queries : queries.slice(0, 3);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Query history
        </span>
        <Badge variant="secondary" className="text-xs">
          {queries.length}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {visibleQueries.map((query, i) => (
          <div
            key={query.id}
            className="rounded-lg border bg-muted/30 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {query.query_text}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(query.created_at)}
                  {(query.tokens_used ?? 0) > 0 && (
                    <span className="ml-2">{query.tokens_used} tokens</span>
                  )}
                </p>
              </div>
              {openIndex === i ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              )}
            </button>

            {openIndex === i && query.answer_text && (
              <div className="px-3 pb-3 space-y-2 border-t pt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {query.answer_text}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onReuse(query.query_text)}
                >
                  Ask again
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {queries.length > 3 && (
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
              <ChevronDown className="h-3 w-3 mr-1" /> Show {queries.length - 3}{' '}
              more
            </>
          )}
        </Button>
      )}
    </div>
  );
}
