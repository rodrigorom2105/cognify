import Link from 'next/link';
import { SignupForm } from '@/components/auth/signup-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { FREE_TIER_LIMITS } from '@/lib/constants';

export default function SignupPage() {
  return (
    <AuthShell
      title="Create an account"
      intro={`Free, with room for ${FREE_TIER_LIMITS.documents} documents and ${FREE_TIER_LIMITS.queries} questions a month.`}
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          .
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
