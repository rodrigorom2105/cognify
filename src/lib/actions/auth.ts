'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

type LoginResult = { success: false; error: string } | never;
type SignupResult =
  | { success: false; error: string }
  | { success: true; message: string };

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Success
  redirect('/dashboard');
}

export async function signupUser(
  email: string,
  password: string,
  name: string,
  last_name: string
): Promise<SignupResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL + '/auth/confirm',
      data: {
        name,
        last_name,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Account created! Check your email to verify.',
  };
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.name || '',
    last_name: user.user_metadata?.last_name || '',
    created_at: user.created_at,
  };
}
