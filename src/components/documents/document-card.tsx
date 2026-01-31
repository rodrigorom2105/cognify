'use client';

import { useState } from 'react';
import { Document } from '@/types';
import { Button } from '@/components/ui/button';
import { deleteDocument } from '@/lib/actions/documents';

interface DocumentCardProps {
  document: Document;
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteButtonClick = async () => {
    setDeleting(true);
    await deleteDocument(document.id);
    setDeleting(false);
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {document.filename}
        </p>
        <p className="text-sm text-gray-500">
          Uploaded {new Date(document.created_at).toDateString()}
          {document.file_size_bytes &&
            ` • ${(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB`}
        </p>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={handleDeleteButtonClick}
        disabled={deleting}
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  );
}
