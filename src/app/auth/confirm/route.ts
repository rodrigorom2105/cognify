import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: token_hash!,
    type: type as any,
  });

  if (error) {
    redirect('/auth/login?error=invalid_code');
  }

  redirect('/dashboard');
}
