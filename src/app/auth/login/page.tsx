import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow">
        <h2 className="text-2xl font-bold text-center">Log In</h2>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
