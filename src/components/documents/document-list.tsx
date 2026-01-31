'use client';

import { Document } from '@/types';
import DocumentCard from './document-card';

export default function DocumentList({ documents }: { documents: Document[] }) {
  return (
    <div className="h-full overflow-y-auto border rounded-lg bg-white divide-y">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}
