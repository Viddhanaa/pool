'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { usePoolStats } from '@/hooks/use-api';
import { formatHashrate, formatNumber } from '@/lib/utils';
import { Activity, Users, Cpu, Box } from 'lucide-react';

export function LiveStats() {
  const { data: poolStats, isLoading } = usePoolStats();

  const stats = [
    {
      icon: Activity,
      label: 'Hashrate',
      value: formatHashrate(poolStats?.hashrate || 0),
      color: 'accent' as const,
      glowColor: 'rgba(0, 255, 255, 0.3)',
    },
    {
      icon: Users,
      label: 'Miners',
      value: poolStats?.activeMiners?.toString() || '0',
      color: 'purple' as const,
      glowColor: 'rgba(139, 92, 246, 0.3)',
    },
    {
      icon: Cpu,
      label: 'Difficulty',
      value: formatNumber(poolStats?.difficulty || 0),
      color: 'success' as const,
      glowColor: 'rgba(34, 197, 94, 0.3)',
    },
    {
      icon: Box,
      label: 'Block',
      value: `#${formatNumber(poolStats?.latestBlockNumber || 0)}`,
      color: 'warning' as const,
      glowColor: 'rgba(234, 179, 8, 0.3)',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <StatBox {...stat} isLoading={isLoading} />
        </motion.div>
      ))}
    </div>
  );
}

interface StatBoxProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'accent' | 'purple' | 'success' | 'warning';
  glowColor: string;
  isLoading?: boolean;
}

function StatBox({ icon: Icon, label, value, color, glowColor, isLoading }: StatBoxProps) {
  const colorClasses = {
    accent: 'text-accent border-accent/30',
    purple: 'text-purple border-purple/30',
    success: 'text-success border-success/30',
    warning: 'text-warning border-warning/30',
  };

  const bgClasses = {
    accent: 'bg-accent/10',
    purple: 'bg-purple/10',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
  };

  return (
    <Card
      variant="glass"
      className="relative p-5 overflow-hidden group hover:border-white/20 transition-all duration-300"
    >
      {/* Background glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Icon */}
        <div className={`inline-flex p-2 rounded-lg mb-3 ${bgClasses[color]}`}>
          <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[0]}`} />
        </div>

        {/* Value */}
        {isLoading ? (
          <div className="h-8 w-24 bg-white/10 rounded animate-pulse mb-1" />
        ) : (
          <motion.p
            className={`text-2xl md:text-3xl font-bold font-data ${colorClasses[color].split(' ')[0]}`}
            key={value}
            initial={{ scale: 1.1, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {value}
          </motion.p>
        )}

        {/* Label */}
        <p className="text-xs text-foreground-muted uppercase tracking-wider mt-1">
          {label}
        </p>
      </div>

      {/* Animated border glow */}
      <motion.div
        className={`absolute inset-0 rounded-xl border ${colorClasses[color]} opacity-0`}
        animate={{
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: Math.random() * 2,
        }}
      />
    </Card>
  );
}
