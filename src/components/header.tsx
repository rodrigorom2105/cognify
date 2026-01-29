'use client';

import Link from 'next/link';
import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="fixed top-0 w-full bg-background/80 backdrop-blur-sm border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">
              Cognify
            </span>
          </Link>

          <nav className="hidden md:flex gap-8 items-center">
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex gap-3">
            <Button variant="outline" className="text-sm bg-transparent">
              <Link href={'/auth/login'}>Sign In</Link>
            </Button>
            <Button className="text-sm">
              <Link href={'/auth/signup'}>Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
