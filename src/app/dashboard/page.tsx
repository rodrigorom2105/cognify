import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/dashboard/stats-cards';
import { FileText, MessageSquare, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get or create user usage stats
  let { data: usage } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If no usage record exists, create one
  if (!usage) {
    const { data: newUsage } = await supabase
      .from('user_usage')
      .insert({
        user_id: user.id,
        documents_uploaded: 0,
        queries_made: 0,
        tokens_consumed: 0,
      })
      .select()
      .single();

    usage = newUsage;
  }

  const documentsUploaded = usage?.documents_uploaded || 0;
  const queriesMade = usage?.queries_made || 0;
  const tokensConsumed = usage?.tokens_consumed || 0;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
        <p className="text-gray-600 mt-1">{user.user_metadata.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Documents Uploaded"
          current={documentsUploaded}
          limit={10}
          icon={FileText}
        />
        <StatsCard
          title="Queries Made"
          current={queriesMade}
          limit={100}
          icon={MessageSquare}
        />
        <StatsCard
          title="Tokens Consumed"
          current={tokensConsumed}
          limit={1000000}
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
          <Link href="/dashboard/documents">
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
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            1. Upload a PDF document to get started
          </p>
          <p className="text-sm text-gray-600">
            2. Wait for processing to complete (usually takes 30-60 seconds)
          </p>
          <p className="text-sm text-gray-600">
            3. Ask questions about your document using natural language
          </p>
          <p className="text-sm text-gray-600">
            4. Get AI-powered answers based on your document content
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
