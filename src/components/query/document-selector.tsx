'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText } from 'lucide-react';
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

  if (readyDocuments.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <FileText className="h-4 w-4 shrink-0" />
        <span>No documents ready. Upload and process a PDF first.</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        Select a document to query
      </label>
      <Select value={selectedId ?? ''} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a document..." />
        </SelectTrigger>
        <SelectContent>
          {readyDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.filename}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
