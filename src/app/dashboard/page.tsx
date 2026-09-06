import Link from 'next/link';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserDocuments } from '@/lib/actions/documents';
import { getUserUsage } from '@/lib/actions/usage';
import { FREE_TIER_LIMITS } from '@/lib/constants';
import StatusBadge from '@/components/documents/document-status-badge';
import { Button } from '@/components/ui/button';
import type { Query } from '@/types';

// The one genuine sequence in the product, so it is the one place numbering
// earns its keep — and it only appears while there is nothing else to show.
const gettingStarted = [
  'Upload a PDF. It has to have a text layer; scanned pages cannot be read.',
  'Wait about a minute while the text is extracted, split and embedded.',
  'Ask a question about it in your own words.',
  'Read the answer, then check the passages it was built from.',
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [user, usage, { documents }] = await Promise.all([
    getCurrentUser(),
    getUserUsage(),
    getUserDocuments(),
  ]);

  // Filtered explicitly rather than leaning on RLS alone, matching the ask page.
  const { data: recentQueries } = user
    ? await supabase
        .from('queries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4)
    : { data: [] };

  const docs = documents ?? [];
  const queries: Query[] = recentQueries ?? [];
  const firstName = user?.name?.trim();

  if (docs.length === 0) {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="display-2 text-3xl">
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Cognify answers questions about a PDF using only what that document
            says, and shows you the passages it used.
          </p>
        </header>

        <ol className="divide-y border-t border-b">
          {gettingStarted.map((step, index) => (
            <li key={step} className="flex gap-4 py-3">
              <span className="rail tabular pt-px">{index + 1}</span>
              <span className="min-w-0 flex-1 text-sm">{step}</span>
            </li>
          ))}
        </ol>

        <Button asChild>
          <Link href="/dashboard/documents">Upload a PDF</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="display-2 text-3xl">
          {firstName ? `Welcome back, ${firstName}` : 'Overview'}
        </h1>
        <p className="tabular text-muted-foreground text-sm">
          {usage?.documents_uploaded ?? 0} of {FREE_TIER_LIMITS.documents}{' '}
          documents, {usage?.queries_made ?? 0} of {FREE_TIER_LIMITS.queries}{' '}
          questions this month
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b pb-2">
          <h2 className="heading text-sm">Documents</h2>
          <Link
            href="/dashboard/documents"
            className="text-primary text-xs underline-offset-4 hover:underline"
          >
            All documents
          </Link>
        </div>

        <ul className="divide-y border-b">
          {docs.slice(0, 4).map((doc) => (
            <li key={doc.id} className="flex items-baseline gap-4 py-3">
              <span className="rail w-24 text-left">
                <StatusBadge status={doc.status} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {doc.filename}
              </span>
              <span className="tabular text-muted-foreground shrink-0 text-xs">
                {format(new Date(doc.created_at), 'd MMM')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b pb-2">
          <h2 className="heading text-sm">Recent questions</h2>
          <Link
            href="/dashboard/ask"
            className="text-primary text-xs underline-offset-4 hover:underline"
          >
            Ask another
          </Link>
        </div>

        {queries.length > 0 ? (
          <ul className="divide-y border-b">
            {queries.map((query) => (
              <li key={query.id} className="flex items-baseline gap-4 py-3">
                <span className="rail">
                  {format(new Date(query.created_at), 'd MMM')}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {query.query_text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nothing asked yet.{' '}
            <Link
              href="/dashboard/ask"
              className="text-primary underline-offset-4 hover:underline"
            >
              Ask your first question
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
