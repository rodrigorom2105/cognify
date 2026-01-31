'use client';

export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Upload Documents',
      description:
        'Drag and drop or select files from your computer. Cognify accepts PDFs, Word docs, spreadsheets, and text files.',
    },
    {
      number: '2',
      title: 'Process with AI',
      description:
        'Our system converts your documents into semantic vectors using advanced embeddings for intelligent analysis.',
    },
    {
      number: '3',
      title: 'Search & Discover',
      description:
        "Ask questions in natural language and get precise answers. Find insights you didn't know existed.",
    },
    {
      number: '4',
      title: 'Export & Share',
      description:
        'Generate reports, summaries, and export findings in multiple formats for your team.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Simple, Powerful, Fast
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes. No complicated setup or training required.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg">
                  {step.number}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-lg bg-accent/5 border border-accent/20">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Why Cognify is Different
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <p className="font-semibold text-foreground mb-2">98% Accuracy</p>
              <p className="text-muted-foreground text-sm">
                Our vector search captures semantic meaning with high precision.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">60% Faster</p>
              <p className="text-muted-foreground text-sm">
                Find answers 60% faster than manual document review.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Any Scale</p>
              <p className="text-muted-foreground text-sm">
                From a single document to millions of pages, Cognify scales
                seamlessly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
