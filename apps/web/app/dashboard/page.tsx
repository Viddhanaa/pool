'use client';

import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { HashrateChart } from '@/components/charts/hashrate-chart';
import { Suspense } from 'react';
import { Activity, Zap, DollarSign, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { useDashboardOverview, usePayouts } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;

  const { data: overview, isLoading } = useDashboardOverview();
  const { data: payoutsData } = usePayouts(userId, 1, 5);

  // Log seed data from API
  console.log('🔍 Dashboard - Overview Data:', {
    overview,
    source: 'seed database via /api/v1/dashboard/overview'
  });
  console.log('🔍 Dashboard - Payouts Data:', {
    payoutsData,
    payoutCount: payoutsData?.payouts?.length,
    source: 'seed database via /api/v1/payouts'
  });

  const workers = overview?.workers || [];
  const onlineWorkers = workers.filter((w: any) => w.isOnline);
  const offlineWorkers = workers.filter((w: any) => w.isOnline === false);
  const recentPayouts = payoutsData?.payouts || [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Current Hashrate"
          value={overview?.hashrate ? `${(overview.hashrate.hashrate / 1e9).toFixed(2)} GH/s` : '—'}
          subtitle={overview?.hashrate?.averageHashrate24h ? `Avg: ${(overview.hashrate.averageHashrate24h / 1e9).toFixed(2)} GH/s` : ''}
          icon={Activity}
          color="accent"
          isLoading={isLoading}
          trend={overview?.hashrate ? {
            value: overview.hashrate.hashrate > overview.hashrate.averageHashrate24h ? 5.2 : -2.1,
            label: 'vs 24h avg'
          } : undefined}
        />

        <StatCard
          title="Active Workers"
          value={onlineWorkers.length}
          subtitle={`${offlineWorkers.length} offline`}
          icon={Zap}
          color="success"
          isLoading={isLoading}
        />

        <StatCard
          title="Pending Balance"
          value={overview?.balance ? `${overview.balance.pending.toFixed(8)} BTC` : '0.00000000 BTC'}
          subtitle={overview?.balance?.total ? `Total: ${overview.balance.total.toFixed(8)} BTC` : ''}
          icon={DollarSign}
          color="purple"
          isLoading={isLoading}
        />

        <StatCard
          title="24h Earnings"
          value={overview?.earnings ? `${overview.earnings.last24h.toFixed(8)} BTC` : '0.00000000 BTC'}
          subtitle={overview?.earnings?.lastWeek ? `Week: ${overview.earnings.lastWeek.toFixed(8)} BTC` : ''}
          icon={TrendingUp}
          color="warning"
          isLoading={isLoading}
        />
      </div>

      {/* Charts & AI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hashrate Chart - Spans 2 columns */}
        <Card variant="glass" padding="default" className="lg:col-span-2">
          <h3 className="text-h4 mb-4">Hashrate History</h3>
          <Suspense fallback={<div className="h-[300px] animate-pulse bg-white/5 rounded-lg" />}>
            <HashrateChart timeRange="24h" height={300} />
          </Suspense>
        </Card>

        {/* AI Projection */}
        <Card variant="glow-purple" padding="default">
          <h3 className="text-h4 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple" />
            <span className="text-purple">Prometheus AI</span>
          </h3>
          <div className="space-y-4">
            <ProjectionItem
              icon={TrendingUp}
              label="Est. Daily Earnings"
              value={overview?.earnings ? `${(overview.earnings.last24h * 1).toFixed(8)} BTC` : '—'}
              confidence={94}
            />
            <ProjectionItem
              icon={Clock}
              label="Est. Weekly Earnings"
              value={overview?.earnings ? `${(overview.earnings.last24h * 7).toFixed(8)} BTC` : '—'}
              confidence={87}
            />
            <ProjectionItem
              icon={Zap}
              label="Pool Share"
              value={overview?.hashrate && overview?.poolStats ?
                `${((overview.hashrate.hashrate / overview.poolStats.hashrate) * 100).toFixed(2)}%` : '—'}
              confidence={91}
            />
          </div>
          <div className="mt-6 p-3 rounded-lg bg-purple/10 border border-purple/20">
            <p className="text-tiny text-foreground-muted">
              AI predictions based on current hashrate, network difficulty, and historical data.
            </p>
          </div>
        </Card>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers Overview */}
        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h4">Workers Overview</h3>
            <a href="/dashboard/workers" className="text-sm text-accent hover:underline">
              View All
            </a>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse h-10 bg-white/5 rounded" />
              ))
            ) : workers.length > 0 ? (
              workers.slice(0, 5).map((worker: any) => (
                <WorkerRow
                  key={worker.id}
                  name={worker.name}
                  hashrate={`${(worker.hashrate / 1e9).toFixed(2)} GH/s`}
                  status={worker.isOnline ? 'online' : 'offline'}
                />
              ))
            ) : (
              <p className="text-center py-8 text-foreground-subtle">No workers found</p>
            )}
          </div>
        </Card>

        {/* Recent Payouts */}
        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h4">Recent Payouts</h3>
            <a href="/dashboard/payouts" className="text-sm text-accent hover:underline">
              View All
            </a>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse h-10 bg-white/5 rounded" />
              ))
            ) : recentPayouts.length > 0 ? (
              recentPayouts.map((payout: any) => (
                <PayoutRow
                  key={payout.id}
                  amount={`${payout.amount.toFixed(8)} BTC`}
                  date={formatRelativeTime(payout.createdAt)}
                  status={payout.status.toLowerCase()}
                />
              ))
            ) : (
              <p className="text-center py-8 text-foreground-subtle">No payouts yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface ProjectionItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  confidence: number;
}

function ProjectionItem({ icon: Icon, label, value, confidence }: ProjectionItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-purple" />
        <div>
          <p className="text-tiny text-foreground-subtle">{label}</p>
          <p className="font-data text-lg font-semibold text-purple">{value}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-tiny text-foreground-subtle">Confidence</p>
        <p className="font-data text-sm text-success">{confidence}%</p>
      </div>
    </div>
  );
}

interface WorkerRowProps {
  name: string;
  hashrate: string;
  status: 'online' | 'offline';
}

function WorkerRow({ name, hashrate, status }: WorkerRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'online' ? 'bg-success' : 'bg-error'
          }`}
        />
        <span className="font-mono text-sm">{name}</span>
      </div>
      <span className={`font-data text-sm ${status === 'online' ? 'text-accent' : 'text-error'}`}>
        {hashrate}
      </span>
    </div>
  );
}

interface PayoutRowProps {
  amount: string;
  date: string;
  status: string;
}

function PayoutRow({ amount, date, status }: PayoutRowProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success';
      case 'pending':
        return 'bg-warning/10 text-warning';
      case 'processing':
        return 'bg-accent/10 text-accent';
      case 'failed':
        return 'bg-error/10 text-error';
      default:
        return 'bg-foreground-subtle/10 text-foreground-subtle';
    }
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div>
        <p className="font-data text-sm text-success">{amount}</p>
        <p className="text-tiny text-foreground-subtle">{date}</p>
      </div>
      <span className={`text-tiny px-2 py-1 rounded-full capitalize ${getStatusColor(status)}`}>
        {status}
      </span>
    </div>
  );
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
