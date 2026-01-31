'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-accent">Powered by AI</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 text-balance">
          Transform Your Documents Into Insights
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Upload your files once and search through them intelligently. Cognify
          uses advanced RAG and vector embeddings to surface insights instantly,
          no manual reading required.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button size="lg" className="gap-2 text-base">
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base bg-transparent"
          >
            View Demo
          </Button>
        </div>

        <div className="mt-16 pt-16 border-t border-border">
          <p className="text-sm text-muted-foreground mb-8">
            Used by leading companies
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-center">
            <div className="flex items-center justify-center">
              <div className="text-sm font-medium text-muted-foreground">
                Acme Corp
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-sm font-medium text-muted-foreground">
                TechFlow
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-sm font-medium text-muted-foreground">
                DataSys
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-sm font-medium text-muted-foreground">
                InnovateLabs
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
