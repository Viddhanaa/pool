'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { usePoolStats } from '@/hooks/use-api';

export function StatsSection() {
  // Use poolStats which has blockchain data (realtime every 5s)
  const { data: poolStats } = usePoolStats();

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold mb-4">Pool Statistics</h2>
          <p className="text-foreground-muted">Real-time pool performance</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard
            label="Total Blocks"
            value={poolStats?.latestBlockNumber?.toLocaleString() || '—'}
            trend={poolStats?.latestBlockNumber ? 'Live from blockchain' : undefined}
          />
          <StatCard
            label="Active Miners"
            value={poolStats?.activeMiners?.toLocaleString() || '0'}
            trend="Currently mining"
          />
          <StatCard
            label="Total Paid"
            value={poolStats?.totalPaid ? poolStats.totalPaid.toFixed(2) : '0.00'}
            unit="BTCD"
            trend="All time"
          />
          <StatCard
            label="Pool Fee"
            value={poolStats?.poolFee ? poolStats.poolFee.toFixed(1) : '1.0'}
            unit="%"
            trend="Low fee"
          />
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  unit,
  trend
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Card variant="glass" padding="default" className="text-center h-full min-h-[140px] flex flex-col justify-between">
        <div>
          <p className="text-sm text-foreground-subtle mb-2">{label}</p>
          <p className="text-3xl font-bold font-data text-accent">
            {value}
            {unit && <span className="text-lg ml-1">{unit}</span>}
          </p>
        </div>
        <div className="min-h-[20px] mt-2">
          {trend && (
            <p className="text-xs text-success">↑ {trend}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

