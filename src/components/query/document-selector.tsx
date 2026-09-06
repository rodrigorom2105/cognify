'use client';

import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Document } from '@/types/index';

interface DocumentSelectorProps {
  documents: Document[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DocumentSelector({
  documents,
  selectedId,
  onSelect,
}: DocumentSelectorProps) {
  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const processingCount = documents.filter(
    (d) => d.status === 'processing'
  ).length;

  if (readyDocuments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-5">
        <p className="text-sm">
          {processingCount > 0
            ? 'Your document is still being processed. This usually takes under a minute.'
            : 'There are no documents to ask about yet.'}
        </p>
        <Link
          href="/dashboard/documents"
          className="text-primary mt-2 inline-block text-sm underline-offset-4 hover:underline"
        >
          Go to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="document" className="heading block text-sm">
        Document
      </label>
      <Select value={selectedId ?? ''} onValueChange={onSelect}>
        <SelectTrigger id="document" className="w-full max-w-lg">
          <SelectValue placeholder="Choose a document" />
        </SelectTrigger>
        <SelectContent>
          {readyDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              {doc.filename}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
