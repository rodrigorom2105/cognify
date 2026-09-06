import { cn } from '@/lib/utils';
import { Document } from '@/types';

/**
 * Status as a word in the rail, not a coloured pill. The word carries the
 * meaning on its own, so colour is reinforcement rather than the only signal.
 */
export default function StatusBadge({
  status,
  className,
}: {
  status: Document['status'];
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-xs',
        status === 'ready' && 'text-primary',
        status === 'processing' && 'text-muted-foreground',
        status === 'failed' && 'text-destructive',
        className
      )}
    >
      {status}
    </span>
  );
}
