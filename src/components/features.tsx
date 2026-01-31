'use client';

import { Upload, Zap, Search, BarChart3, Lock, Cpu } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Features() {
  const features = [
    {
      icon: Upload,
      title: 'Easy Upload',
      description:
        'Support for all file types. Upload PDFs, documents, spreadsheets, and more in seconds.',
    },
    {
      icon: Cpu,
      title: 'AI-Powered Search',
      description:
        'Advanced vector embeddings understand context and meaning, not just keywords.',
    },
    {
      icon: Zap,
      title: 'Instant Insights',
      description:
        'Get answers and summaries from your documents without manual searching.',
    },
    {
      icon: Search,
      title: 'Smart Discovery',
      description:
        'Find patterns and connections across your entire document library effortlessly.',
    },
    {
      icon: Lock,
      title: 'Enterprise Security',
      description:
        'End-to-end encryption and compliance with industry standards to keep data safe.',
    },
    {
      icon: BarChart3,
      title: 'Analytics Ready',
      description:
        'Track usage and insights with built-in analytics and detailed reporting.',
    },
  ];

  return (
    <section id="features" className="py-20 bg-secondary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cognify combines cutting-edge AI with an intuitive interface to make
            document intelligence simple.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="hover:border-accent/30 transition-all">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
