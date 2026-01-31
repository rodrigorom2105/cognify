'use client';

import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Testimonials() {
  const testimonials = [
    {
      quote:
        'Cognify transformed how we analyze documents. What used to take days now takes minutes.',
      author: 'Sarah Chen',
      role: 'Legal Director, Axiom Corp',
      rating: 5,
    },
    {
      quote:
        'The accuracy of the semantic search is unmatched. It understands context like no other tool.',
      author: 'Marcus Johnson',
      role: 'Chief Knowledge Officer, DataFlow',
      rating: 5,
    },
    {
      quote:
        'Enterprise-grade security with consumer-grade simplicity. Exactly what we needed.',
      author: 'Emma Rodriguez',
      role: 'CTO, Precision Analytics',
      rating: 5,
    },
  ];

  return (
    <section className="py-20 bg-secondary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Trusted by Teams Worldwide
          </h2>
          <p className="text-lg text-muted-foreground">
            See how organizations are using Cognify to unlock insights from
            their data.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-semibold text-foreground">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
