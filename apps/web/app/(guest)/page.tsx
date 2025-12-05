'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { HeroSection } from '@/components/home/hero-section';
import { StatsSection } from '@/components/home/stats-section';
import { RecentBlocks } from '@/components/home/recent-blocks';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentBlocksWidget } from '@/components/dashboard/recent-blocks-widget';
import { NetworkStats } from '@/components/dashboard/network-stats';
import { Box, Users, Zap, TrendingUp, Activity, Clock } from 'lucide-react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Mock dashboard data with auto-refresh simulation
  const dashboardData = useMemo(() => ({
    latestBlock: {
      height: 850123 + refreshKey, // Simulate new blocks
      time: '2m ago',
    },
    totalTransactions: (1234567 + refreshKey * 5).toLocaleString(),
    activeMiners: 245 + Math.floor(Math.random() * 10) - 5,
    poolHashrate: 123456789012345,
    networkHashrate: 987654321098765,
    difficulty: 85000000000000,
    avgBlockTime: 600,
    blocksToday: 42 + Math.floor(refreshKey / 6), // ~1 block per hour simulation
  }), [refreshKey]);

  // Mock recent blocks
  const recentBlocks = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `block-${i + 1}`,
      height: 850123 - i,
      hash: `0x${Math.random().toString(16).slice(2, 50).padEnd(64, '0')}`,
      reward: 625000000,
      confirmations: Math.floor(Math.random() * 10),
      foundAt: new Date(Date.now() - i * 120000).toISOString(),
    })), []
  );

  return (
    <>
      <Header />
      <main>
        <HeroSection />

        {/* Dashboard Stats Cards */}
        <section className="py-12 bg-background-secondary/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Live Dashboard</h2>

            {/* Main Stats Grid - All equal height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title="Latest Block"
                value={`#${dashboardData.latestBlock.height.toLocaleString()}`}
                subtitle={dashboardData.latestBlock.time}
                icon={Box}
                color="accent"
                isLoading={isLoading}
              />

              <StatCard
                title="Total Transactions"
                value={dashboardData.totalTransactions}
                subtitle="All time"
                icon={Activity}
                color="success"
                trend={{ value: 5.2, label: 'vs yesterday' }}
                isLoading={isLoading}
              />

              <StatCard
                title="Active Miners"
                value={dashboardData.activeMiners}
                subtitle="Currently mining"
                icon={Users}
                color="purple"
                trend={{ value: 12, label: 'vs last week' }}
                isLoading={isLoading}
              />

              <StatCard
                title="Blocks Today"
                value={dashboardData.blocksToday}
                subtitle="Last 24 hours"
                icon={TrendingUp}
                color="warning"
                trend={{ value: -3.1, label: 'vs yesterday' }}
                isLoading={isLoading}
              />
            </div>

            {/* Secondary Stats - All equal height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard
                title="Pool Hashrate"
                value={isLoading ? '—' : '123.45 TH/s'}
                subtitle="Current mining power"
                icon={Zap}
                color="accent"
                isLoading={isLoading}
              />

              <StatCard
                title="Network Difficulty"
                value={isLoading ? '—' : '85.00 T'}
                subtitle="Current difficulty"
                icon={Activity}
                color="success"
                isLoading={isLoading}
              />

              <StatCard
                title="Avg Block Time"
                value={isLoading ? '—' : '10m 0s'}
                subtitle="Last 100 blocks"
                icon={Clock}
                color="purple"
                isLoading={isLoading}
              />
            </div>

            {/* Widgets Grid - Equal height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="h-full">
                <RecentBlocksWidget
                  blocks={recentBlocks}
                  isLoading={isLoading}
                />
              </div>

              <div className="h-full">
                <NetworkStats
                  poolHashrate={dashboardData.poolHashrate}
                  networkHashrate={dashboardData.networkHashrate}
                  difficulty={dashboardData.difficulty}
                  blockTime={dashboardData.avgBlockTime}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </section>

        <StatsSection />
        <RecentBlocks />
      </main>
    </>
  );
}
