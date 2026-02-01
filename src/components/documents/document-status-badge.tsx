import { Document } from '@/types';

export default function StatusBadge({
  status,
}: {
  status: Document['status'];
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status === 'ready'
          ? 'bg-green-100 text-green-800'
          : status === 'processing'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
