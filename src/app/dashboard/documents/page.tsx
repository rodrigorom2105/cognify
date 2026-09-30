import UploadZone from '@/components/documents/upload-zone';
import DocumentList from '@/components/documents/document-list';
import { getUserDocuments } from '@/lib/actions/documents';
import { getUserUsage } from '@/lib/actions/usage';
import { FREE_TIER_LIMITS } from '@/lib/constants';

export default async function DocumentsPage() {
  const [{ documents, error }, usage] = await Promise.all([
    getUserDocuments(),
    getUserUsage(),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="display-2 text-3xl">Documents</h1>
        <p role="alert" className="text-destructive mt-4 text-sm">
          {error}
        </p>
      </div>
    );
  }

  const used = usage?.documents_uploaded ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-3">
        <h1 className="display-2 text-3xl">Documents</h1>
        <p className="tabular text-muted-foreground text-sm">
          {used} of {FREE_TIER_LIMITS.documents} used
        </p>
      </header>

      <UploadZone />

      {documents && documents.length > 0 ? (
        <DocumentList documents={documents} />
      ) : (
        <p className="text-muted-foreground text-sm">
          No documents yet. Upload a PDF above and it will be ready to ask about
          in about a minute.
        </p>
      )}
    </div>
  );
}
