'use client';

import { Button } from '@/components/ui/button';
import { Bell, Search } from 'lucide-react';

interface DashboardHeaderProps {
  userName?: string;
}

export function DashboardHeader({ userName = 'User' }: DashboardHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-sm font-medium text-accent">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground hidden sm:block">
            {userName}
          </span>
        </div>
      </div>
    </header>
  );
}
