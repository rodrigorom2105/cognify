import { StatsCard } from '@/components/dashboard/stats-cards';
import { FileText, MessageSquare, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserUsage } from '@/lib/actions/usage';
import { FREE_TIER_LIMITS } from '@/lib/constants';

export default async function DashboardPage() {
  const [user, usage] = await Promise.all([getCurrentUser(), getUserUsage()]);
  const userName = user
    ? `${user.name} ${user.last_name}`.trim() || user.email
    : 'User';

  const documentsUploaded = usage?.documents_uploaded ?? 0;
  const queriesMade = usage?.queries_made ?? 0;
  const tokensConsumed = usage?.tokens_consumed ?? 0;

  return (
    <main className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">{userName}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Documents Uploaded"
          current={documentsUploaded}
          limit={FREE_TIER_LIMITS.documents}
          icon={FileText}
        />
        <StatsCard
          title="Queries Made"
          current={queriesMade}
          limit={FREE_TIER_LIMITS.queries}
          icon={MessageSquare}
        />
        <StatsCard
          title="Tokens Consumed"
          current={tokensConsumed}
          limit={FREE_TIER_LIMITS.tokens}
          icon={Zap}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/dashboard/documents">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </Link>
          <Link href="/dashboard/ask">
            <Button variant="outline">
              <MessageSquare className="mr-2 h-4 w-4" />
              Ask Question
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
              1
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a PDF document to get started
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
              2
            </div>
            <p className="text-sm text-muted-foreground">
              Wait for processing to complete (usually takes 30-60 seconds)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
              3
            </div>
            <p className="text-sm text-muted-foreground">
              Ask questions about your document using natural language
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
              4
            </div>
            <p className="text-sm text-muted-foreground">
              Get AI-powered answers based on your document content
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
