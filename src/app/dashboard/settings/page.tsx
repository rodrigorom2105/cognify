import { format } from 'date-fns';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserUsage } from '@/lib/actions/usage';
import { FREE_TIER_LIMITS } from '@/lib/constants';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 py-3">
      <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
      <dd className="tabular min-w-0 flex-1 text-sm break-words">{value}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const [user, usage] = await Promise.all([getCurrentUser(), getUserUsage()]);

  if (!user) return null;

  const resetsOn = usage?.last_reset_at
    ? new Date(usage.last_reset_at)
    : new Date();
  resetsOn.setMonth(resetsOn.getMonth() + 1);

  const fullName = `${user.name} ${user.last_name}`.trim();

  return (
    <div className="space-y-10">
      <header className="border-b pb-3">
        <h1 className="display-2 text-3xl">Account</h1>
      </header>

      <section className="space-y-3">
        <h2 className="heading border-b pb-2 text-sm">You</h2>
        <dl className="divide-y border-b">
          {fullName && <Row label="Name" value={fullName} />}
          <Row label="Email" value={user.email} />
          <Row
            label="Joined"
            value={format(new Date(user.created_at), 'd MMMM yyyy')}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="heading border-b pb-2 text-sm">This month</h2>
        <dl className="divide-y border-b">
          <Row
            label="Documents"
            value={`${usage?.documents_uploaded ?? 0} of ${FREE_TIER_LIMITS.documents}`}
          />
          <Row
            label="Questions"
            value={`${usage?.queries_made ?? 0} of ${FREE_TIER_LIMITS.queries}`}
          />
          <Row
            label="Tokens"
            value={`${(usage?.tokens_consumed ?? 0).toLocaleString()} of ${FREE_TIER_LIMITS.tokens.toLocaleString()}`}
          />
          <Row label="Resets on" value={format(resetsOn, 'd MMMM yyyy')} />
        </dl>
        <p className="text-muted-foreground text-xs">
          Cognify is free while it is a personal project. These are the only
          limits, and there is nothing to pay.
        </p>
      </section>
    </div>
  );
}
