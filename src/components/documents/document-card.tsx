'use client';

import { Document } from '@/types';
import { Button } from '@/components/ui/button';
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
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
      <div className="flex flex-row min-w-0 items-center gap-4">
        <div>
          <p className="font-medium text-gray-900 truncate">
            {document.filename}
          </p>
          <p className="text-sm text-gray-500">
            Uploaded {new Date(document.created_at).toDateString()}
            {document.file_size_bytes &&
              ` • ${(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB`}
          </p>
        </div>
        <div>
          <StatusBadge status={document.status} />
        </div>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  );
}
