'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Document } from '@/types';
import DocumentCard from './document-card';
import { deleteDocument } from '@/lib/actions/documents';

export default function DocumentList({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const subscriptionRef = useRef<{
    channel: any;
  } | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced refresh to prevent multiple rapid refreshes
  const debouncedRefresh = useCallback(() => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    // Small delay to batch multiple rapid events
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
      // Reset after a short cooldown
      cooldownTimeoutRef.current = setTimeout(() => {
        isRefreshingRef.current = false;
      }, 1000);
    }, 100);
  }, [router]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUserId(null);
      });

    return () => {
      active = false;
    };
  }, []);

  // Subscribe to real-time document changes for all documents (INSERT, UPDATE, DELETE)
  useEffect(() => {
    // Skip if subscription already exists
    if (subscriptionRef.current) {
      return;
    }

    if (!userId) {
      return;
    }

    const supabase = createClient();
    let mounted = true;

    const channelName = `document-changes-${crypto.randomUUID()}`;

    // Subscribe to all document changes for the current user
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return;
          console.log('New document inserted:', payload.new);
          debouncedRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return;
          const updatedDoc = payload.new as Document;
          const oldDoc = payload.old as Partial<Document>;

          console.log(
            'Document updated:',
            updatedDoc.id,
            'status:',
            updatedDoc.status
          );

          // Refresh when status changes (especially from processing to ready/failed)
          if (oldDoc.status !== updatedDoc.status) {
            console.log(
              `Document ${updatedDoc.id} status changed: ${oldDoc.status} → ${updatedDoc.status}`
            );
            debouncedRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return;
          console.log('Document deleted:', payload.old);
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (!mounted) return;

        if (status === 'SUBSCRIBED') {
          console.log('Connected to real-time document updates');
        } else if (status === 'CLOSED') {
          console.log('Disconnected from real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - connection failed');
        }
      });

    subscriptionRef.current = { channel };

    return () => {
      console.log('Component unmounting - cleaning up subscription');
      mounted = false;

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }

      if (subscriptionRef.current?.channel) {
        const ch = subscriptionRef.current.channel;
        ch.unsubscribe()
          .then(() => supabase.removeChannel(ch))
          .catch((error: Error) => {
            console.error('Error during cleanup:', error);
            supabase.removeChannel(ch);
          });
        subscriptionRef.current = null;
      }
    };
  }, [debouncedRefresh, userId]);

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

    // Server action calls revalidatePath() - no need for router.refresh()
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
