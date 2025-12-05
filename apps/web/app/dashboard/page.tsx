'use client';

import { Suspense } from 'react';
import { HUDDisplay } from '@/components/dashboard/hud-display';
import { HashrateChart } from '@/components/charts/hashrate-chart';
import { Card } from '@/components/ui/card';
import { Sparkles, TrendingUp, Clock, Zap } from 'lucide-react';

function LoadingCard() {
  return (
    <div className="h-32 rounded-xl bg-background-secondary border border-white/5 animate-pulse" />
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* HUD Display - Key Metrics */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        }
      >
        <HUDDisplay />
      </Suspense>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hashrate Chart - 2 columns */}
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
              value="$45.23"
              confidence={94}
            />
            <ProjectionItem
              icon={Clock}
              label="Est. Weekly Earnings"
              value="$312.50"
              confidence={87}
            />
            <ProjectionItem
              icon={Zap}
              label="Optimal Difficulty"
              value="65,536"
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
          <h3 className="text-h4 mb-4">Workers Overview</h3>
          <div className="space-y-3">
            <WorkerRow name="worker-01" hashrate="45.2 TH/s" status="online" />
            <WorkerRow name="worker-02" hashrate="42.8 TH/s" status="online" />
            <WorkerRow name="worker-03" hashrate="38.5 TH/s" status="online" />
            <WorkerRow name="worker-04" hashrate="0 H/s" status="offline" />
          </div>
        </Card>

        {/* Recent Payouts */}
        <Card variant="glass" padding="default">
          <h3 className="text-h4 mb-4">Recent Payouts</h3>
          <div className="space-y-3">
            <PayoutRow amount="0.00234 BTC" date="2 hours ago" status="completed" />
            <PayoutRow amount="0.00189 BTC" date="1 day ago" status="completed" />
            <PayoutRow amount="0.00312 BTC" date="3 days ago" status="completed" />
            <PayoutRow amount="0.00156 BTC" date="5 days ago" status="completed" />
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
  status: 'completed' | 'pending';
}

function PayoutRow({ amount, date, status }: PayoutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div>
        <p className="font-data text-sm text-success">{amount}</p>
        <p className="text-tiny text-foreground-subtle">{date}</p>
      </div>
      <span
        className={`text-tiny px-2 py-1 rounded-full ${
          status === 'completed'
            ? 'bg-success/10 text-success'
            : 'bg-warning/10 text-warning'
        }`}
      >
        {status}
      </span>
    </div>
  );
}
