import { HeroSection } from '@/components/home/hero-section';
import { Header } from '@/components/layout/header';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        
        {/* Stats Section */}
        <section className="py-20 bg-background-secondary">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatCard label="Pool Hashrate" value="125 TH/s" />
              <StatCard label="Active Miners" value="2,847" />
              <StatCard label="Blocks Found" value="1,234" />
              <StatCard label="Total Paid" value="$2.4M" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-h2 text-center mb-12">
              Why Choose <span className="text-accent">VIDDHANA</span>?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                title="AI-Powered Optimization"
                description="Prometheus AI continuously analyzes and optimizes your mining operations for maximum efficiency."
              />
              <FeatureCard
                title="Layer 3 Instant Payouts"
                description="Get paid instantly with our Layer 3 technology. No more waiting for confirmations."
              />
              <FeatureCard
                title="DePIN Hardware Verification"
                description="Fair rewards through hardware verification. No fake hashrate, no cheating."
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold font-data text-accent mb-2">{value}</p>
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-background-secondary border border-white/5 hover:border-accent/20 transition-colors">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <p className="text-sm text-foreground-muted">{description}</p>
    </div>
  );
}
