'use client';

import { format } from 'date-fns';
import { Document } from '@/types';
import StatusBadge from './document-status-badge';

interface DocumentCardProps {
  document: Document;
  isDeleting: boolean;
  onDelete: () => void;
}

export default function DocumentCard({
  document,
  isDeleting,
  onDelete,
}: DocumentCardProps) {
  const sizeMb = document.file_size_bytes / 1024 / 1024;

  const details = [
    document.page_count ? `${document.page_count} pages` : null,
    `${sizeMb.toFixed(1)} MB`,
    format(new Date(document.created_at), 'd MMM yyyy'),
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-4 py-4">
      <div className="rail w-24 pt-0.5 text-left">
        <StatusBadge status={document.status} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{document.filename}</p>
        <p className="text-muted-foreground tabular mt-0.5 flex flex-wrap gap-x-4 text-xs">
          {details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </p>

        {document.status === 'processing' && (
          <p className="text-muted-foreground mt-2 text-xs">
            Reading and embedding the text. This usually takes under a minute.
          </p>
        )}

        {document.status === 'failed' && (
          <p className="text-destructive mt-2 max-w-prose text-xs">
            Processing failed. The usual cause is a scanned PDF with no text
            layer, which Cognify cannot read.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="text-muted-foreground hover:text-destructive focus-visible:ring-ring shrink-0 rounded-md text-xs underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      >
        {isDeleting ? 'Removing' : 'Remove'}
      </button>
    </div>
  );
}
