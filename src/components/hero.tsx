import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * The hero is the product's characteristic moment rather than a claim about
 * it: an answer, and the passages underneath it that the answer was built
 * from. The layout mirrors what /dashboard/ask actually renders.
 */
export default function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-5 pt-16 pb-20 md:pt-24">
      <div className="max-w-2xl">
        <h1 className="display-1">Answers you can check.</h1>

        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
          Cognify reads your PDF, answers questions using only what that
          document says, and shows you the passages it used.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link href="/auth/signup">Create account</Link>
          </Button>
          <Link
            href="#how-it-works"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            See how it works
          </Link>
        </div>
      </div>

      <figure className="bg-card mt-14 rounded-xl border p-6 md:p-8">
        <figcaption className="text-muted-foreground border-b pb-3 text-xs">
          An example of what an answer looks like.
        </figcaption>

        <p className="mt-5 text-sm font-medium">
          When does the agreement terminate?
        </p>

        <p className="prose-doc text-foreground mt-4">
          The agreement terminates on the earlier of two events: 31 December
          2027, or written notice given by either party 90 days in advance.
        </p>

        <div className="mt-8 space-y-4">
          <p className="text-muted-foreground border-b pb-2 text-xs">
            Passages used, numbered as the answer cites them, with where each
            sits in the document and how close it was. The closest is
            highlighted.
          </p>

          <div className="flex gap-4">
            <div className="rail w-20 pt-0.5 leading-5">
              <div className="text-foreground font-medium">1</div>
              <div>&para;12</div>
              <div>0.871</div>
            </div>
            <p className="prose-doc-sm text-foreground min-w-0 flex-1">
              <span className="mark-span">
                This Agreement shall terminate upon the earlier of (a) 31
                December 2027 or (b) written notice by either party.
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <div className="rail w-20 pt-0.5 leading-5">
              <div className="text-foreground font-medium">2</div>
              <div>&para;31</div>
              <div>0.714</div>
            </div>
            <p className="prose-doc-sm text-foreground min-w-0 flex-1">
              Any notice under clause 9 shall be given not less than ninety (90)
              days before the intended date of termination.
            </p>
          </div>
        </div>
      </figure>
    </section>
  );
}
