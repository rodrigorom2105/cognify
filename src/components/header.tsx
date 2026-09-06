import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="bg-primary h-5 w-[3px]" aria-hidden="true" />
          <span className="heading text-lg">Cognify</span>
        </Link>

        <nav className="flex items-center gap-5">
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground hidden text-sm transition-colors sm:inline"
          >
            How it works
          </Link>
          <Link
            href="#limits"
            className="text-muted-foreground hover:text-foreground hidden text-sm transition-colors sm:inline"
          >
            Limits
          </Link>
          <Link
            href="/auth/login"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/auth/signup">Create account</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
