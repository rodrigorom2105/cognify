// A real sequence, which is the one thing that earns numbered markers.
const steps = [
  {
    title: 'You upload a PDF',
    body: 'The text layer is pulled out with unpdf. There is no OCR step, so a scanned or image-only PDF is rejected rather than read badly.',
  },
  {
    title: 'The text is split into passages',
    body: '1,500 characters each, overlapping by 300, so a sentence that straddles a boundary still appears whole inside one of them.',
  },
  {
    title: 'Each passage is embedded',
    body: "OpenAI's text-embedding-3-small turns every passage into a 1,536-dimension vector, stored in Postgres with pgvector.",
  },
  {
    title: 'Your question is embedded the same way',
    body: 'The eight passages closest to it by cosine distance are retrieved. You see each one, and how close it was.',
  },
  {
    title: 'The answer is written from those passages only',
    body: 'gpt-4o-mini, streamed as it is generated. When the passages do not contain the answer, it says so instead of filling the gap.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t">
      <div className="mx-auto max-w-5xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="display-2">What happens to your document</h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Nothing here is hidden. An answer is only worth as much as the
            passages under it, so the whole pipeline is visible in the product.
          </p>
        </div>

        <ol className="mt-12 max-w-3xl divide-y border-t border-b">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5 py-6">
              <span className="rail tabular pt-1">{index + 1}</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="heading text-base">{step.title}</h3>
                <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
