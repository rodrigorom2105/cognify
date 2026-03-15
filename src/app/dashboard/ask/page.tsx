import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AskPageClient } from './ask-page-client';

export default async function AskPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Fetch ready documents
  const { data: documents } = await supabase
    .from('documents')
    .select(
      'id, filename, status, file_size_bytes, page_count, created_at, updated_at, storage_path, user_id'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch query history
  const { data: queries } = await supabase
    .from('queries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <AskPageClient documents={documents ?? []} initialQueries={queries ?? []} />
  );
}
