import { getDocumentUrl } from '@/lib/actions/documents';
import { Document } from '@/types';
import Link from 'next/link';
import { Button } from '../ui/button';

export default async function DocumentList({
  documents,
}: {
  documents: Document[];
}) {
  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      url: await getDocumentUrl(doc.storage_path),
    }))
  );

  return (
    <div className="h-full overflow-y-auto border rounded-lg bg-white divide-y">
      {documentsWithUrls.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
        >
          {/* Left */}
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
            <p className="text-sm text-gray-500">
              Uploaded {new Date(doc.created_at).toLocaleDateString()}
              {doc.file_size_bytes &&
                ` • ${(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB`}
            </p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={doc.url || '#'}
              target="_blank"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View
            </Link>

            <Button
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              Download
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
