import React from 'react';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserUsage } from '@/lib/actions/usage';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, usage] = await Promise.all([getCurrentUser(), getUserUsage()]);

  return (
    <div className="bg-background flex min-h-screen flex-col md:h-screen md:flex-row">
      <DashboardSidebar email={user?.email} usage={usage} />
      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
