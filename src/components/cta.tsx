import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CTA() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-5xl px-5 py-20">
        <div className="max-w-xl">
          <h2 className="display-2">Try it on something you have to read.</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            A contract, a spec, a report you were sent this morning. Upload it
            and ask.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/auth/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
