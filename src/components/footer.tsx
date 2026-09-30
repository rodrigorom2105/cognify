import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary h-4 w-[3px]" aria-hidden="true" />
          <span className="heading text-sm">Cognify</span>
          <span className="text-muted-foreground text-sm">
            a personal project by Rodrigo Romero
          </span>
        </div>

        <nav className="flex items-center gap-5">
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            How it works
          </Link>
          <Link
            href="#limits"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Limits
          </Link>
          <Link
            href="/auth/login"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
