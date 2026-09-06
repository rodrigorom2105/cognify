import { FREE_TIER_LIMITS } from '@/lib/constants';

const limits = [
  {
    label: 'File type',
    value: 'PDF with a text layer. Scanned pages cannot be read.',
  },
  { label: 'File size', value: '10 MB per document.' },
  {
    label: 'Per month',
    value: `${FREE_TIER_LIMITS.documents} documents, ${FREE_TIER_LIMITS.queries} questions, ${FREE_TIER_LIMITS.tokens.toLocaleString()} tokens.`,
  },
  {
    label: 'Scope',
    value:
      'One document per question. Cognify does not search across your whole library.',
  },
  {
    label: 'Price',
    value: 'Free. There is no paid tier and nothing to enter a card for.',
  },
];

export default function Limits() {
  return (
    <section id="limits" className="border-t">
      <div className="mx-auto max-w-5xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="display-2">Where it stops</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Worth knowing before you sign up rather than after.
          </p>
        </div>

        <dl className="mt-12 max-w-3xl divide-y border-t border-b">
          {limits.map((limit) => (
            <div
              key={limit.label}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6"
            >
              <dt className="text-muted-foreground w-40 shrink-0 text-sm">
                {limit.label}
              </dt>
              <dd className="min-w-0 flex-1 text-sm">{limit.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
