'use client';

import { Card } from '@/components/ui/card';
import { Activity, Zap, TrendingUp, Box } from 'lucide-react';
import { formatHashrate } from '@/lib/utils';

// Helper to format difficulty with appropriate unit
function formatDifficulty(difficulty: number): string {
  if (difficulty >= 1e15) return `${(difficulty / 1e15).toFixed(2)} P`;
  if (difficulty >= 1e12) return `${(difficulty / 1e12).toFixed(2)} T`;
  if (difficulty >= 1e9) return `${(difficulty / 1e9).toFixed(2)} G`;
  if (difficulty >= 1e6) return `${(difficulty / 1e6).toFixed(2)} M`;
  if (difficulty >= 1e3) return `${(difficulty / 1e3).toFixed(2)} K`;
  return difficulty.toString();
}

interface NetworkStatsProps {
  poolHashrate: number;
  networkHashrate: number;
  difficulty: number;
  blockTime: number;
  isLoading?: boolean;
}

export function NetworkStats({
  poolHashrate,
  networkHashrate,
  difficulty,
  blockTime,
  isLoading = false,
}: NetworkStatsProps) {
  // Prevent division by zero and NaN
  const poolShare = networkHashrate > 0 
    ? ((poolHashrate / networkHashrate) * 100).toFixed(2) 
    : '0.00';

  const stats = [
    {
      label: 'Pool Hashrate',
      value: isLoading ? '—' : formatHashrate(poolHashrate),
      icon: Zap,
      color: 'text-accent',
    },
    {
      label: 'Network Hashrate',
      value: isLoading ? '—' : formatHashrate(networkHashrate),
      icon: Activity,
      color: 'text-success',
    },
    {
      label: 'Pool Share',
      value: isLoading ? '—' : `${poolShare}%`,
      icon: TrendingUp,
      color: 'text-purple',
    },
    {
      label: 'Avg Block Time',
      value: isLoading ? '—' : `${blockTime}s`,
      icon: Box,
      color: 'text-warning',
    },
  ];

  return (
    <Card variant="glass" padding="default" className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Network Stats</h3>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle mb-1">{stat.label}</p>
              {isLoading ? (
                <div className="h-5 w-20 bg-white/10 rounded animate-pulse"></div>
              ) : (
                <p className="font-data font-semibold">{stat.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-subtle">Network Difficulty</span>
            <span className="font-mono font-medium">
              {formatDifficulty(difficulty)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

