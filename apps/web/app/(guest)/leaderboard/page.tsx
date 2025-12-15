'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Zap, Cpu, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLeaderboard } from '@/hooks/use-api';

type LeaderboardType = 'hashrate' | 'blocks' | 'earnings';
type TimePeriod = 'day' | 'week' | 'month' | 'all';

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  value: number;
  percentage: number;
  previousRank?: number;
}

function formatHashrate(h: number): string {
  if (h >= 1e15) return `${(h / 1e15).toFixed(2)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KH/s`;
  return `${h.toFixed(0)} H/s`;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatValue(value: number, type: LeaderboardType): string {
  switch (type) {
    case 'hashrate':
      return formatHashrate(value);
    case 'blocks':
      return value.toLocaleString();
    case 'earnings':
      return `${value.toFixed(4)} BTCD`;
  }
}

const tabConfig = [
  { id: 'hashrate' as const, label: 'Hashrate', icon: Zap },
  { id: 'blocks' as const, label: 'Blocks', icon: Cpu },
  { id: 'earnings' as const, label: 'Earnings', icon: Coins },
];

const periodConfig = [
  { id: 'day' as const, label: 'Day' },
  { id: 'week' as const, label: 'Week' },
  { id: 'month' as const, label: 'Month' },
  { id: 'all' as const, label: 'All Time' },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('hashrate');
  const [period, setPeriod] = useState<TimePeriod>('all');
  const previousDataRef = useRef<Map<string, number>>(new Map());

  const { data: leaderboardData, isLoading } = useLeaderboard(activeTab, period, 20);

  // Process leaderboard entries with rank change detection
  const entries: LeaderboardEntry[] = (leaderboardData?.entries || leaderboardData?.miners || []).map((entry: any, index: number) => {
    const wallet = entry.wallet || entry.username || entry.address || `Miner ${index + 1}`;
    const previousRank = previousDataRef.current.get(wallet);
    
    let value = 0;
    switch (activeTab) {
      case 'hashrate':
        value = entry.hashrate || entry.value || 0;
        break;
      case 'blocks':
        value = entry.blocks || entry.blocksFound || entry.value || 0;
        break;
      case 'earnings':
        value = entry.earnings || entry.totalEarnings || entry.value || 0;
        break;
    }

    return {
      rank: entry.rank || index + 1,
      wallet,
      value,
      percentage: entry.percentage || 0,
      previousRank,
    };
  });

  // Update previous ranks for next comparison
  useEffect(() => {
    const newMap = new Map<string, number>();
    entries.forEach((entry) => {
      newMap.set(entry.wallet, entry.rank);
    });
    previousDataRef.current = newMap;
  }, [entries]);

  const totalValue = entries.reduce((sum, e) => sum + e.value, 0);

  const getRankChange = (entry: LeaderboardEntry) => {
    if (entry.previousRank === undefined) return null;
    const change = entry.previousRank - entry.rank;
    if (change > 0) return { direction: 'up', amount: change };
    if (change < 0) return { direction: 'down', amount: Math.abs(change) };
    return null;
  };

  const getTabIcon = () => {
    const config = tabConfig.find(t => t.id === activeTab);
    return config?.icon || Zap;
  };

  const TabIcon = getTabIcon();

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-3 mb-4">
              <Trophy className="h-8 w-8 text-cyan-400" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Leaderboard
              </h1>
            </div>
          </motion.div>

          {/* Tab Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <div className="inline-flex bg-white/5 backdrop-blur-xl rounded-xl p-1 border border-white/10">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                      isActive
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg border border-cyan-500/30"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className={`h-4 w-4 relative z-10 ${isActive ? 'text-cyan-400' : ''}`} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Time Period Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center gap-2 mb-10"
          >
            {periodConfig.map((p) => (
              <Button
                key={p.id}
                variant={period === p.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.id)}
                className={`transition-all duration-300 ${
                  period === p.id
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 border-0 shadow-[0_0_20px_rgba(0,255,255,0.3)]'
                    : 'border-white/10 hover:border-cyan-500/50'
                }`}
              >
                {p.label}
              </Button>
            ))}
          </motion.div>

          {/* Leaderboard Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card variant="glass" className="overflow-hidden border-white/10">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-sm text-white/50 font-medium">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Wallet</div>
                <div className="col-span-3 text-right flex items-center justify-end gap-2">
                  <TabIcon className="h-4 w-4 text-cyan-400" />
                  {activeTab === 'hashrate' ? 'Hashrate' : activeTab === 'blocks' ? 'Blocks' : 'Earnings'}
                </div>
                <div className="col-span-3 text-right">% of Total</div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="p-8">
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && entries.length === 0 && (
                <div className="p-16 text-center">
                  <Trophy className="h-16 w-16 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30">No data available</p>
                </div>
              )}

              {/* Leaderboard Entries */}
              <AnimatePresence mode="popLayout">
                {!isLoading && entries.map((entry, index) => {
                  const rankChange = getRankChange(entry);
                  const percentage = totalValue > 0 ? (entry.value / totalValue) * 100 : entry.percentage;
                  const isTop3 = entry.rank <= 3;

                  return (
                    <motion.div
                      key={entry.wallet}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 500, 
                        damping: 30,
                        delay: index * 0.02 
                      }}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-white/5 hover:bg-white/5 transition-colors group ${
                        isTop3 ? 'bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent' : ''
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 text-center">
                        <div className="relative inline-flex items-center justify-center">
                          {entry.rank === 1 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-full blur-lg" />
                          )}
                          <span className={`relative font-bold text-lg ${
                            entry.rank === 1 ? 'text-yellow-400' :
                            entry.rank === 2 ? 'text-gray-300' :
                            entry.rank === 3 ? 'text-orange-400' :
                            'text-white/50'
                          }`}>
                            {entry.rank}
                          </span>
                          {/* Rank change indicator */}
                          {rankChange && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`absolute -right-4 text-xs font-bold ${
                                rankChange.direction === 'up' ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {rankChange.direction === 'up' ? '+' : '-'}{rankChange.amount}
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* Wallet */}
                      <div className="col-span-5">
                        <span className="font-mono text-sm text-white/80 group-hover:text-cyan-400 transition-colors">
                          {truncateWallet(entry.wallet)}
                        </span>
                      </div>

                      {/* Value */}
                      <div className="col-span-3 text-right">
                        <span className={`font-data font-medium ${
                          isTop3 ? 'text-cyan-400' : 'text-white/70'
                        }`}>
                          {formatValue(entry.value, activeTab)}
                        </span>
                      </div>

                      {/* Percentage */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-3 justify-end">
                          <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(percentage, 100)}%` }}
                              transition={{ duration: 0.8, delay: index * 0.02 }}
                              className={`h-full rounded-full ${
                                isTop3 
                                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500' 
                                  : 'bg-cyan-500/50'
                              }`}
                            />
                          </div>
                          <span className="text-sm text-white/50 w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center mt-6"
          >
            <div className="inline-flex items-center gap-2 text-sm text-white/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Live updates every 30s
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
