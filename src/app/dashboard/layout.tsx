import React from 'react';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { getCurrentUser } from '@/lib/actions/auth';

export  default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader userName={user?.name} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
