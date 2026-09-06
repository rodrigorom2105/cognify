'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Query } from '@/types';

interface QueryHistoryProps {
  queries: Query[];
  onReuse: (queryText: string) => void;
}

export function QueryHistory({ queries, onReuse }: QueryHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (queries.length === 0) return null;

  const visibleQueries = expanded ? queries : queries.slice(0, 4);

  return (
    <section className="space-y-3" aria-label="Earlier questions">
      <h2 className="heading border-b pb-2 text-sm">Earlier questions</h2>

      <ul className="divide-y border-b">
        {visibleQueries.map((query) => {
          const isOpen = openId === query.id;

          return (
            <li key={query.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : query.id)}
                aria-expanded={isOpen}
                className="hover:bg-accent/50 focus-visible:ring-ring flex w-full items-baseline gap-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="rail self-stretch">
                  {format(new Date(query.created_at), 'd MMM')}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {query.query_text}
                </span>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>

              {isOpen && query.answer_text && (
                <div className="flex gap-4 pb-4">
                  <span className="rail self-stretch" aria-hidden="true" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="prose-doc-sm text-muted-foreground">
                      {query.answer_text}
                    </p>
                    <button
                      type="button"
                      onClick={() => onReuse(query.query_text)}
                      className="text-primary focus-visible:ring-ring rounded-md text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Ask again
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {queries.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-primary focus-visible:ring-ring rounded-md text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {expanded
            ? 'Show fewer questions'
            : `Show ${queries.length - 4} more questions`}
        </button>
      )}
    </section>
  );
}
