'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'accent' | 'success' | 'warning' | 'purple';
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'accent',
  isLoading = false,
}: StatCardProps) {
  const colorClasses = {
    accent: 'text-accent bg-accent/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    purple: 'text-purple bg-purple/10',
  };

  const trendColor = trend && trend.value > 0 ? 'text-success' : 'text-error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card variant="glass" padding="default" hover="lift" className="h-full min-h-[140px]">
        <div className="flex items-start justify-between h-full">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <p className="text-sm text-foreground-subtle mb-2">{title}</p>
              {isLoading ? (
                <div className="h-8 w-32 bg-white/10 rounded animate-pulse mb-2"></div>
              ) : (
                <motion.p
                  className="text-2xl font-bold font-data mb-1"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  {value}
                </motion.p>
              )}
              {subtitle && (
                <p className="text-xs text-foreground-muted">{subtitle}</p>
              )}
            </div>
            {trend && !isLoading && (
              <div className="flex items-center gap-1 mt-3">
                <span className={`text-xs font-medium ${trendColor}`}>
                  {trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-foreground-subtle">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]} flex-shrink-0`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

