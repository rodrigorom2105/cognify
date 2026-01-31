'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
  Brain,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Ask AI', href: '/dashboard/ask', icon: MessageSquare },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const secondaryNavigation = [
  { name: 'Help & Support', href: '/dashboard/help', icon: HelpCircle },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Cognify</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3',
                  isActive && 'bg-accent/10 text-accent hover:bg-accent/15'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 border-t border-border space-y-1">
        {secondaryNavigation.map((item) => (
          <Link key={item.name} href={item.href}>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <item.icon className="w-5 h-5" />
              {item.name}
            </Button>
          </Link>
        ))}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
