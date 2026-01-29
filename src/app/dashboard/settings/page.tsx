import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get usage stats
  const { data: usage } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="text-sm text-gray-900 mt-1">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">User ID</label>
            <p className="text-sm text-gray-500 mt-1 font-mono">{user.id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Account Created
            </label>
            <p className="text-sm text-gray-900 mt-1">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Free Tier</p>
              <p className="text-sm text-gray-600 mt-1">
                Limited to 10 documents and 100 queries per month
              </p>
            </div>
            <Badge>Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Documents</span>
            <span className="text-sm text-gray-600">
              {usage?.documents_uploaded || 0} / 10
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Queries</span>
            <span className="text-sm text-gray-600">
              {usage?.queries_made || 0} / 100
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Tokens Consumed</span>
            <span className="text-sm text-gray-600">
              {usage?.tokens_consumed || 0} / 1,000,000
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Resets On</span>
            <span className="text-sm text-gray-600">
              {usage?.last_reset_at
                ? new Date(
                    new Date(usage.last_reset_at).setMonth(
                      new Date(usage.last_reset_at).getMonth() + 1
                    )
                  ).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
