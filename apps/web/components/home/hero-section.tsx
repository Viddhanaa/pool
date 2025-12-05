'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-purple/5" />
      
      {/* Animated grid pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Content */}
      <div className="relative z-10 text-center max-w-5xl px-4">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8"
        >
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm text-accent">Powered by Prometheus AI</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-display mb-6"
        >
          <span className="text-accent">VIDDHANA</span>{' '}
          <span className="text-foreground">POOL</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-foreground-muted mb-8 max-w-3xl mx-auto"
        >
          Next-generation mining powered by AI optimization and Layer 3 instant payouts
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-wrap gap-4 justify-center mb-16"
        >
          <Button asChild size="lg" variant="glow">
            <Link href="/register" className="gap-2">
              Start Mining
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pools">View Pools</Link>
          </Button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          <FeatureCard
            icon={Sparkles}
            title="AI-Optimized"
            description="Prometheus AI maximizes your mining efficiency automatically"
            color="purple"
          />
          <FeatureCard
            icon={Zap}
            title="Instant Payouts"
            description="Layer 3 technology enables real-time micro-payouts"
            color="accent"
          />
          <FeatureCard
            icon={Shield}
            title="DePIN Verified"
            description="Hardware verification ensures fair reward distribution"
            color="success"
          />
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'accent' | 'purple' | 'success';
}

function FeatureCard({ icon: Icon, title, description, color }: FeatureCardProps) {
  const colorClasses = {
    accent: 'text-accent bg-accent/10 border-accent/20',
    purple: 'text-purple bg-purple/10 border-purple/20',
    success: 'text-success bg-success/10 border-success/20',
  };

  return (
    <div className="p-6 rounded-xl bg-background-secondary/50 border border-white/5 backdrop-blur-sm">
      <div
        className={`inline-flex p-3 rounded-lg mb-4 ${colorClasses[color]}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-foreground-muted">{description}</p>
    </div>
  );
}
