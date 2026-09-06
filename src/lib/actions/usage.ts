'use server';

import { createClient } from '@/lib/supabase/server';
import type { UserUsage } from '@/types';

/**
 * Fetch the current user's usage rollup.
 *
 * The `user_usage` row is created lazily by the `increment_*` RPCs, so a user
 * who has not yet uploaded or queried has no row at all. That is not an error
 * condition — it is reported as zeroed usage so callers can render a fresh
 * account without special-casing it.
 */
export async function getUserUsage(): Promise<UserUsage | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // maybeSingle(), not single(): a missing row is expected for new accounts and
  // single() would turn it into a PGRST116 error.
  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user usage:', error);
    return null;
  }

  return (
    data ?? {
      user_id: user.id,
      documents_uploaded: 0,
      queries_made: 0,
      tokens_consumed: 0,
      last_reset_at: new Date().toISOString(),
    }
  );
}
