'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { Activity, Users, Zap, TrendingUp } from 'lucide-react';
import { formatHashrate } from '@/lib/utils';
import { usePoolStats } from '@/hooks/use-api';

const formatNumber = (num: number) => num.toLocaleString();

export default function PoolsPage() {
  const { data, isLoading } = usePoolStats();
  const [poolStats, setPoolStats] = useState({
    hashrate: 0,
    networkHashrate: 0,
    activeMiners: 0,
    difficulty: 0,
    blocksFound: 0,
    luck: 100,
  });

  // Update poolStats when data changes
  useEffect(() => {
    if (data?.stats) {
      setPoolStats({
        hashrate: data.stats.hashrate || 0,
        networkHashrate: data.stats.networkHashrate || 0,
        activeMiners: data.stats.activeMiners || 0,
        difficulty: data.stats.difficulty || 0,
        blocksFound: data.stats.blocksFound || 0,
        luck: data.stats.luck || 100,
      });
    }
  }, [data]);

  console.log('🔍 Pools Page - API Response:', {
    rawData: data,
    isLoading,
    timestamp: new Date().toISOString()
  });


  console.log('📊 Pools Page - Processed Stats:', {
    poolStats,
    source: 'seed database via /api/v1/stats/pool',
    debug: {
      hasData: !!data,
      hasStats: !!data?.stats,
      rawHashrate: data?.stats?.hashrate,
      processedHashrate: poolStats.hashrate,
    }
  });

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-h1">
              <span className="text-accent">Mining</span> Pools
            </h1>
            <p className="text-foreground-subtle mt-2">
              Live statistics from {poolStats.activeMiners} active miners (from seed data)
            </p>
          </div>

          {/* Pool Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard
              icon={Zap}
              label="Pool Hashrate"
              value={formatHashrate(poolStats.hashrate)}
              color="accent"
              isLoading={isLoading}
            />
            <StatCard
              icon={Users}
              label="Active Miners"
              value={poolStats.activeMiners.toString()}
              color="success"
              isLoading={isLoading}
            />
            <StatCard
              icon={Activity}
              label="Network Difficulty"
              value={poolStats.difficulty.toString()}
              color="purple"
              isLoading={isLoading}
            />
            <StatCard
              icon={TrendingUp}
              label="Blocks Found"
              value={poolStats.blocksFound.toString()}
              color="warning"
              isLoading={isLoading}
            />
          </div>

          {/* Pool Cards */}
          <h2 className="text-h2 mb-6">Available Pools</h2>
          <p className="text-foreground-subtle mb-4">
            Total network hashrate: {formatHashrate(poolStats.networkHashrate)} | Pool luck: {poolStats.luck.toFixed(1)}%
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PoolCard
              name="Viddhana Pool"
              symbol="VIDP"
              hashrate={formatHashrate(poolStats.hashrate)}
              miners={poolStats.activeMiners}
              fee="1%"
              minPayout="0.001 BTC"
              blocks={poolStats.blocksFound}
            />
            <PoolCard
              name="Solo Mining"
              symbol="SOLO"
              hashrate={formatHashrate(poolStats.hashrate * 0.15)}
              miners={Math.floor(poolStats.activeMiners * 0.1)}
              fee="0%"
              minPayout="0 BTC"
              blocks={Math.floor(poolStats.blocksFound * 0.05)}
            />
            <PoolCard
              name="PPLNS Pool"
              symbol="PPLNS"
              hashrate={formatHashrate(poolStats.hashrate * 0.85)}
              miners={Math.floor(poolStats.activeMiners * 0.9)}
              fee="0.5%"
              minPayout="0.0001 BTC"
              blocks={Math.floor(poolStats.blocksFound * 0.95)}
            />
          </div>

          {/* Connection Info */}
          <section className="mt-16">
            <h2 className="text-h2 mb-6">Connection Details</h2>
            <Card variant="glass" padding="default">
              <h3 className="text-h4 mb-4">Stratum Configuration</h3>
              <div className="space-y-4">
                <ConnectionInfo
                  label="Server"
                  value="stratum+tcp://pool.viddhana.io:3333"
                />
                <ConnectionInfo
                  label="Username"
                  value="YOUR_WALLET_ADDRESS.WORKER_NAME"
                />
                <ConnectionInfo label="Password" value="x" />
              </div>
            </Card>
          </section>
        </div>
      </main>
    </>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'accent' | 'success' | 'purple' | 'warning';
  isLoading?: boolean;
}

function StatCard({ icon: Icon, label, value, color, isLoading }: StatCardProps) {
  const colorClasses = {
    accent: 'text-accent bg-accent/10',
    success: 'text-success bg-success/10',
    purple: 'text-purple bg-purple/10',
    warning: 'text-warning bg-warning/10',
  };

  return (
    <Card variant="glass" padding="default">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-tiny text-foreground-subtle uppercase tracking-wide">
            {label}
          </p>
          {isLoading ? (
            <div className="h-7 w-24 bg-white/10 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xl font-bold font-data">{value}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface PoolCardProps {
  name: string;
  symbol: string;
  hashrate: string;
  miners: number;
  fee: string;
  minPayout: string;
  blocks?: number;
}

function PoolCard({ name, symbol, hashrate, miners, fee, minPayout, blocks }: PoolCardProps) {
  return (
    <Card variant="default" hover="glow" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-accent font-bold text-sm">{symbol}</span>
          </div>
          <div>
            <h3 className="font-semibold">{name}</h3>
            <p className="text-tiny text-foreground-subtle">{symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-accent font-data font-semibold">{hashrate}</p>
          <p className="text-tiny text-foreground-subtle">Pool Hashrate</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-white/5">
        <div>
          <p className="text-tiny text-foreground-subtle">Miners</p>
          <p className="font-data">{formatNumber(miners)}</p>
        </div>
        <div>
          <p className="text-tiny text-foreground-subtle">Fee</p>
          <p className="font-data">{fee}</p>
        </div>
        <div>
          <p className="text-tiny text-foreground-subtle">Min Payout</p>
          <p className="font-data text-sm">{minPayout}</p>
        </div>
        {blocks !== undefined && (
          <div>
            <p className="text-tiny text-foreground-subtle">Blocks</p>
            <p className="font-data text-success">{blocks}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ConnectionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-sm text-foreground-subtle w-24">{label}:</span>
      <code className="flex-1 px-3 py-2 rounded-lg bg-background text-accent font-mono text-sm break-all">
        {value}
      </code>
    </div>
  );
}
