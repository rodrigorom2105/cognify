import React from 'react';
import Link from 'next/link';

interface AuthShellProps {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, intro, children, footer }: AuthShellProps) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="bg-primary h-5 w-[3px]" aria-hidden="true" />
            <span className="heading text-lg">Cognify</span>
          </Link>

          <div className="space-y-1.5">
            <h1 className="display-2 text-3xl">{title}</h1>
            <p className="text-muted-foreground text-sm">{intro}</p>
          </div>
        </div>

        {children}

        <p className="text-muted-foreground border-t pt-5 text-sm">{footer}</p>
      </div>
    </main>
  );
}
