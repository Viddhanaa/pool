'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useTopMiners } from '@/hooks/use-api';
import { formatHashrate, truncateAddress } from '@/lib/utils';
import { Crown, Medal, Award, Cpu } from 'lucide-react';

interface Miner {
  address: string;
  hashrate: number;
  workers: number;
  blocksFound?: number;
}

export function TopMiners() {
  const { data, isLoading } = useTopMiners(5);
  const miners: Miner[] = data?.miners || [];

  const rankIcons = [
    { icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
    { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-300/20' },
    { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/20' },
    { icon: Cpu, color: 'text-accent', bg: 'bg-accent/20' },
    { icon: Cpu, color: 'text-purple', bg: 'bg-purple/20' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card variant="glass" className="p-6 h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Top Miners</h3>
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Live
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            // Loading skeleton
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-lg bg-white/5 animate-pulse"
              >
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-4 w-20 bg-white/10 rounded" />
              </div>
            ))
          ) : miners.length === 0 ? (
            <div className="text-center py-8 text-foreground-muted">
              <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No active miners</p>
            </div>
          ) : (
            miners.map((miner, index) => {
              const rank = rankIcons[index] || rankIcons[4];
              const RankIcon = rank.icon;

              return (
                <motion.div
                  key={miner.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="group relative flex items-center gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300 border border-transparent hover:border-accent/20"
                >
                  {/* Rank indicator */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${rank.bg}`}>
                    <RankIcon className={`w-5 h-5 ${rank.color}`} />
                  </div>

                  {/* Miner info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-foreground truncate">
                      {truncateAddress(miner.address, 8, 6)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {miner.workers} worker{miner.workers !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Hashrate */}
                  <div className="text-right">
                    <p className="font-data text-sm font-semibold text-accent">
                      {formatHashrate(miner.hashrate)}
                    </p>
                    {miner.blocksFound !== undefined && (
                      <p className="text-xs text-foreground-muted">
                        {miner.blocksFound} blocks
                      </p>
                    )}
                  </div>

                  {/* Hover glow effect */}
                  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-accent/5 to-purple/5" />
                </motion.div>
              );
            })
          )}
        </div>
      </Card>
    </motion.div>
  );
}
