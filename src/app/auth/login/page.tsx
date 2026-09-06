import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      intro="Your documents and everything you have asked about them."
      footer={
        <>
          No account yet?{' '}
          <Link
            href="/auth/signup"
            className="text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
          .
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
