'use client';

import { useState } from 'react';
import { Document } from '@/types';
import DocumentCard from './document-card';
import { deleteDocument } from '@/lib/actions/documents';

export default function DocumentList({ documents }: { documents: Document[] }) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDelete = async (documentId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(documentId));
    await deleteDocument(documentId);
    setDeletingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(documentId);
      return newSet;
    });
  };

  return (
    <div className="w-full max-h-full overflow-y-auto border rounded-lg bg-white divide-y">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          isDeleting={deletingIds.has(doc.id)}
          onDelete={() => handleDelete(doc.id, doc.filename)}
        />
      ))}
    </div>
  );
}
