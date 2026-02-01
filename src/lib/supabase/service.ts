import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Create Supabase client with SERVICE ROLE key for background jobs
 *
 * IMPORTANT: This client bypasses Row Level Security (RLS) and should only
 * be used in trusted server-side contexts like Inngest functions.
 *
 * Use cases:
 * - Inngest background jobs
 * - Scheduled tasks
 * - Admin operations
 *
 * DO NOT use in API routes that handle user requests directly.
 * For user-authenticated operations, use @/lib/supabase/server instead.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
