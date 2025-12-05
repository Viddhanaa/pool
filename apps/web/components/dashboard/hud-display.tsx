'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gauge, Users, TrendingUp, Wallet, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/use-socket';
import { formatHashrate, formatCurrency } from '@/lib/utils';

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: 'accent' | 'purple' | 'success' | 'warning' | 'error';
  trend?: number;
  isAI?: boolean;
  index: number;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  trend,
  isAI,
  index,
}: MetricCardProps) {
  const colorClasses = {
    accent: 'text-accent',
    purple: 'text-purple',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  const bgGradients = {
    accent: 'from-accent/10 to-transparent',
    purple: 'from-purple/10 to-transparent',
    success: 'from-success/10 to-transparent',
    warning: 'from-warning/10 to-transparent',
    error: 'from-error/10 to-transparent',
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl p-5 bg-background-secondary border border-white/5 hover:border-white/10 transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {/* Background gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${bgGradients[color]} opacity-50`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${colorClasses[color]}`} />
            <span className="text-small text-foreground-subtle">{label}</span>
          </div>
          {isAI && (
            <span className="flex items-center gap-1 text-tiny text-purple bg-purple/10 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" />
              AI
            </span>
          )}
        </div>

        {/* Value */}
        <p className={`font-data text-2xl font-bold ${colorClasses[color]}`}>
          {value}
        </p>

        {/* Sub value */}
        {subValue && (
          <p className="text-tiny text-foreground-subtle mt-1">{subValue}</p>
        )}

        {/* Trend indicator */}
        {trend !== undefined && (
          <div
            className={`absolute top-5 right-5 text-tiny font-medium ${
              trend >= 0 ? 'text-success' : 'text-error'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function HUDDisplay() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.dashboard.overview(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to real-time updates
  useSocket('user:stats', () => refetch());

  const metrics = [
    {
      icon: Gauge,
      label: 'Current Hashrate',
      value: formatHashrate(data?.currentHashrate || 0),
      subValue: `24h Avg: ${formatHashrate(data?.avgHashrate || 0)}`,
      color: 'accent' as const,
      trend: data?.hashrateTrend,
    },
    {
      icon: Users,
      label: 'Workers',
      value: `${data?.onlineWorkers || 0} / ${data?.totalWorkers || 0}`,
      subValue: data?.offlineWorkers
        ? `${data.offlineWorkers} offline`
        : 'All online',
      color: data?.offlineWorkers ? ('warning' as const) : ('success' as const),
    },
    {
      icon: TrendingUp,
      label: 'Est. Earnings (24h)',
      value: formatCurrency(data?.estimated24h || 0),
      subValue: `Monthly: ${formatCurrency(data?.estimatedMonthly || 0)}`,
      color: 'purple' as const,
      isAI: true,
    },
    {
      icon: Wallet,
      label: 'Unpaid Balance',
      value: formatCurrency(data?.unpaidBalance || 0),
      subValue: `Next payout: ${data?.nextPayout || '-'}`,
      color: 'accent' as const,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-background-secondary border border-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={metric.label} {...metric} index={index} />
      ))}
    </div>
  );
}
