import { createClient } from '@/lib/supabase/server';
import UploadZone from '@/components/documents/upload-zone';
import DocumentList from '@/components/documents/document-list';
import { file } from 'zod';

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>; // Shouldn't happen (middleware protects)
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div>Error loading documents: {error.message}</div>;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
        <p className="text-gray-600 mt-1">
          Upload and manage your PDF documents
        </p>
      </div>

      <div className="shrink-0">
        <UploadZone />
      </div>

      {documents && documents.length > 0 ? (
        <div className="flex-1 min-h-0">
          <DocumentList documents={documents} />
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-lg">No documents yet</p>
          <p className="text-gray-400 text-sm mt-2">
            Upload your first PDF to get started
          </p>
        </div>
      )}
    </div>
  );
}
