import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LucideIcon } from 'lucide-react';

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
  const percentage = (current / limit) * 100;

  const getColor = () => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{current}</div>
        <p className="text-xs text-gray-600 mt-1">
          of {limit} ({percentage.toFixed(0)}% used)
        </p>
        <Progress value={percentage} className="mt-3" />
      </CardContent>
    </Card>
  );
}
