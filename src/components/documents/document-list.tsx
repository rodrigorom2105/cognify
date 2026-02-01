'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Document } from '@/types';
import DocumentCard from './document-card';
import { deleteDocument } from '@/lib/actions/documents';

export default function DocumentList({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Subscribe to real-time document changes ONLY for processing documents
  useEffect(() => {
    // Get currently processing documents
    const processingDocs = documents.filter(
      (doc) => doc.status === 'processing'
    );

    // Don't create subscription if no documents are processing
    if (processingDocs.length === 0) {
      console.log('No processing documents - skipping real-time subscription');
      return;
    }

    const processingIds = processingDocs.map((doc) => doc.id);
    console.log(
      `Creating real-time subscription for ${processingIds.length} processing documents:`,
      processingIds
    );

    const supabase = createClient();

    // Subscribe to document table changes with filters
    const channel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          // Filter to only documents we care about
          filter: `id=in.(${processingIds.join(',')})`,
        },
        (payload) => {
          console.log('Processing document status changed:', payload);
          const updatedDoc = payload.new as Document;

          // Only refresh if status changed to ready or failed
          if (updatedDoc.status === 'ready' || updatedDoc.status === 'failed') {
            console.log(
              `Document ${updatedDoc.id} processing completed with status: ${updatedDoc.status}`
            );
            router.refresh();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(
            'Connected to real-time updates for processing documents'
          );
        } else if (status === 'CLOSED') {
          console.log('Disconnected from real-time updates');
        }
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [documents]);

  const handleDelete = async (documentId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(documentId));

    const result = await deleteDocument(documentId);

    setDeletingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(documentId);
      return newSet;
    });

    // Refresh the page to show updated list
    if (result?.success) {
      router.refresh();
    }
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
