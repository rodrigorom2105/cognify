import Header from '@/components/header';
import Hero from '@/components/hero';
import HowItWorks from '@/components/how-it-works';
import Limits from '@/components/limits';
import CTA from '@/components/cta';
import Footer from '@/components/footer';

export default function Home() {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Limits />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
