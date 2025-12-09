'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function StatsSection() {
  const { data: statsData } = useQuery({
    queryKey: ['blocks-stats'],
    queryFn: () => apiClient.get('/blocks/stats'),
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;

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
            value={stats?.totalBlocks.toLocaleString() || '—'}
            trend={stats?.blocksLast24h ? `+${stats.blocksLast24h} today` : undefined}
          />
          <StatCard
            label="Blocks (24h)"
            value={stats?.blocksLast24h || '—'}
            trend="Last 24 hours"
          />
          <StatCard
            label="Total Rewards"
            value={stats?.totalRewards ? (stats.totalRewards / 1e8).toFixed(2) : '—'}
            unit="VIDP"
            trend="All time"
          />
          <StatCard
            label="Success Rate"
            value={stats ? `${(100 - stats.orphanRate).toFixed(1)}` : '—'}
            unit="%"
            trend={stats && stats.orphanRate < 5 ? 'Excellent' : 'Good'}
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

