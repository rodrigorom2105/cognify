'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-accent/5 border border-accent/20 p-12 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6 text-balance">
            Ready to Transform Your Documents?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join teams using Cognify to unlock insights. Start free, upgrade
            when you're ready.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" className="text-base">
              Start Your Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base bg-transparent"
            >
              Schedule Demo
            </Button>
          </div>

          <div className="inline-flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span>14-day free trial, full access</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span>Cancel anytime, no questions asked</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
