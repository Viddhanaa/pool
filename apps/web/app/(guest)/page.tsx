'use client';

import { motion } from 'framer-motion';
import { Header } from '@/components/layout/header';
import { HeroSection } from '@/components/home/hero-section';
import { LiveStats } from '@/components/home/live-stats';
import { HashrateChart } from '@/components/home/hashrate-chart';
import { TopMiners } from '@/components/home/top-miners';
import { RecentBlocksWidget } from '@/components/dashboard/recent-blocks-widget';
import { usePoolStats, useRecentBlocks } from '@/hooks/use-api';
import { useMemo } from 'react';

export default function HomePage() {
  // Fetch real data from API with 5s refresh
  const { data: poolStats } = usePoolStats();
  const { data: blocksData } = useRecentBlocks(5);

  // Transform blocks data
  const recentBlocks = useMemo(() => {
    if (blocksData?.blocks && blocksData.blocks.length > 0) {
      return blocksData.blocks.map((block: { id: string; height: number; hash: string; reward: number; confirmations: number; foundAt: string }) => ({
        id: block.id,
        height: block.height,
        hash: block.hash,
        reward: block.reward,
        confirmations: block.confirmations,
        foundAt: block.foundAt,
      }));
    }
    return [];
  }, [blocksData]);

  return (
    <>
      <Header />
      <main className="bg-background min-h-screen">
        {/* Hero Section */}
        <HeroSection />

        {/* Live Stats Section */}
        <section className="relative py-16 bg-background-secondary/50">
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple/5 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs text-accent uppercase tracking-wider">Live</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="text-foreground">Pool </span>
                <span className="text-accent">Statistics</span>
              </h2>
            </motion.div>

            {/* Real-time stats grid */}
            <LiveStats />
          </div>
        </section>

        {/* Charts and Data Section */}
        <section className="relative py-16 bg-background">
          {/* Scan line effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
            <motion.div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
              animate={{ y: [0, 500, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 24h Hashrate Chart */}
              <HashrateChart />

              {/* Top Miners */}
              <TopMiners />
            </div>
          </div>
        </section>

        {/* Recent Blocks Section */}
        <section className="relative py-16 bg-background-secondary/30">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="text-foreground">Recent </span>
                <span className="text-purple">Blocks</span>
              </h2>
              <p className="text-foreground-muted mt-2">BTCD Network</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="max-w-4xl mx-auto"
            >
              <RecentBlocksWidget blocks={recentBlocks} isLoading={false} />
            </motion.div>
          </div>
        </section>

        {/* Pool Info Footer Section */}
        <section className="relative py-20 bg-background overflow-hidden">
          {/* Background orbs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[150px]" />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
                <InfoBlock label="Pool Fee" value={`${poolStats?.poolFee || 1}%`} />
                <InfoBlock label="Payout" value="Instant" />
                <InfoBlock label="Coin" value="BTCD" />
                <InfoBlock label="Protocol" value="Stratum" />
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      className="text-center"
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      <p className="text-3xl md:text-4xl font-bold font-data text-accent mb-1">{value}</p>
      <p className="text-xs text-foreground-muted uppercase tracking-wider">{label}</p>
    </motion.div>
  );
}
