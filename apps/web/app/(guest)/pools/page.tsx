'use client';

import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatHashrate, formatNumber } from '@/lib/utils';
import { Server, Cpu, Gauge, Trophy } from 'lucide-react';

export default function PoolsPage() {
  const { data: poolStats, isLoading } = useQuery({
    queryKey: ['stats', 'pool'],
    queryFn: () => api.stats.pool(),
  });

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <h1 className="text-h1 mb-8">
            <span className="text-accent">Mining</span> Pools
          </h1>

          {/* Pool Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard
              icon={Gauge}
              label="Pool Hashrate"
              value={formatHashrate(poolStats?.hashrate || 0)}
              color="accent"
              isLoading={isLoading}
            />
            <StatCard
              icon={Server}
              label="Active Miners"
              value={formatNumber(poolStats?.activeMiners || 0)}
              color="success"
              isLoading={isLoading}
            />
            <StatCard
              icon={Cpu}
              label="Network Difficulty"
              value={formatNumber(poolStats?.difficulty || 0, 2)}
              color="purple"
              isLoading={isLoading}
            />
            <StatCard
              icon={Trophy}
              label="Blocks Found"
              value={formatNumber(poolStats?.blocksFound || 0)}
              color="warning"
              isLoading={isLoading}
            />
          </div>

          {/* Pool Cards */}
          <h2 className="text-h2 mb-6">Available Pools</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PoolCard
              name="Bitcoin"
              symbol="BTC"
              hashrate="85.2 TH/s"
              miners={1547}
              fee="1%"
              minPayout="0.001 BTC"
            />
            <PoolCard
              name="Litecoin"
              symbol="LTC"
              hashrate="24.8 TH/s"
              miners={892}
              fee="0.5%"
              minPayout="0.01 LTC"
            />
            <PoolCard
              name="Kaspa"
              symbol="KAS"
              hashrate="15.4 TH/s"
              miners={408}
              fee="0.5%"
              minPayout="100 KAS"
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
}

function PoolCard({ name, symbol, hashrate, miners, fee, minPayout }: PoolCardProps) {
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

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
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
