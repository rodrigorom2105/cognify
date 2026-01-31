import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  current: number;
  limit: number;
  icon: LucideIcon;
}

export function StatsCard({
  title,
  current,
  limit,
  icon: Icon,
}: StatsCardProps) {
  const percentage = Math.min((current / limit) * 100, 100);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-accent" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">
              {formatNumber(current)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatNumber(limit)}
            </span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
