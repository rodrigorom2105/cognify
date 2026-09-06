'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { logoutUser } from '@/lib/actions/auth';
import { FREE_TIER_LIMITS } from '@/lib/constants';
import { ThemeToggle } from '@/components/theme-toggle';
import type { UserUsage } from '@/types';

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Documents', href: '/dashboard/documents' },
  { name: 'Ask', href: '/dashboard/ask' },
  { name: 'Account', href: '/dashboard/settings' },
];

interface DashboardSidebarProps {
  email?: string;
  usage: UserUsage | null;
}

/**
 * A meter written as a rail entry: the count sits in a fixed tabular column so
 * the numbers stack, with a hairline underneath carrying the proportion.
 */
function UsageRow({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const proportion = Math.min(used / limit, 1);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 text-xs">
        <span className="tabular w-14 shrink-0 text-right text-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div
        className="h-px w-full bg-border"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className="h-px bg-primary"
          style={{ width: `${proportion * 100}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardSidebar({ email, usage }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex shrink-0 flex-col border-b md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5 md:py-5">
        <Link href="/" className="flex items-center gap-2.5">
          {/* The wordmark's rule is the same rule the citations hang on. */}
          <span className="bg-primary h-5 w-[3px]" aria-hidden="true" />
          <span className="heading text-lg">Cognify</span>
        </Link>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <SignOutButton compact />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:gap-0.5 md:px-3 md:pb-0">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                'border-b-2 border-transparent md:border-b-0 md:border-l-2',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'border-primary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden md:block">
        <div className="space-y-3 px-5 py-5">
          <UsageRow
            used={usage?.documents_uploaded ?? 0}
            limit={FREE_TIER_LIMITS.documents}
            label="documents"
          />
          <UsageRow
            used={usage?.queries_made ?? 0}
            limit={FREE_TIER_LIMITS.queries}
            label="questions"
          />
        </div>

        <div className="border-t px-5 py-4">
          {email && (
            <p
              className="text-muted-foreground mb-2 truncate text-xs"
              title={email}
            >
              {email}
            </p>
          )}
          <div className="flex items-center justify-between">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutUser}>
      <button
        type="submit"
        className={cn(
          'text-muted-foreground hover:text-foreground rounded-md text-sm transition-colors',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          compact ? 'px-2 py-1 text-xs' : ''
        )}
      >
        Sign out
      </button>
    </form>
  );
}
