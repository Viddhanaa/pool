'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatHashrate, formatCurrency, truncateAddress } from '@/lib/utils';
import { Trophy, Medal, Award, Gauge, Blocks, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimeRange = 'day' | 'week' | 'month';
type SortBy = 'hashrate' | 'blocks' | 'earnings';

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [sortBy, setSortBy] = useState<SortBy>('hashrate');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', timeRange, sortBy],
    queryFn: () => api.leaderboard.get({ timeRange, sortBy }),
  });

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <h1 className="text-h1 mb-8">
            <span className="text-accent">Leaderboard</span>
          </h1>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-8">
            {/* Time Range */}
            <div className="flex gap-1 p-1 rounded-lg bg-background-secondary">
              {(['day', 'week', 'month'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === 'day' ? '24h' : range === 'week' ? '7d' : '30d'}
                </Button>
              ))}
            </div>

            {/* Sort By */}
            <div className="flex gap-1 p-1 rounded-lg bg-background-secondary">
              {([
                { key: 'hashrate', icon: Gauge, label: 'Hashrate' },
                { key: 'blocks', icon: Blocks, label: 'Blocks' },
                { key: 'earnings', icon: Wallet, label: 'Earnings' },
              ] as const).map((item) => (
                <Button
                  key={item.key}
                  variant={sortBy === item.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy(item.key)}
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 0, 2].map((index) => {
              const miner = data?.miners?.[index];
              if (!miner) return null;

              const podiumConfig = {
                0: { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10', order: 'md:order-2' },
                1: { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/10', order: 'md:order-1' },
                2: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10', order: 'md:order-3' },
              }[index]!;

              return (
                <Card
                  key={miner.rank}
                  variant={index === 0 ? 'glow' : 'glass'}
                  padding="default"
                  className={cn('text-center', podiumConfig.order)}
                >
                  <div
                    className={cn(
                      'inline-flex p-4 rounded-full mb-4',
                      podiumConfig.bg
                    )}
                  >
                    <podiumConfig.icon className={cn('h-8 w-8', podiumConfig.color)} />
                  </div>
                  <p className="text-2xl font-bold mb-1">#{miner.rank}</p>
                  <p className="font-mono text-sm text-foreground-muted mb-4">
                    {truncateAddress(miner.address)}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-tiny text-foreground-subtle">Hashrate</p>
                      <p className="font-data text-sm text-accent">
                        {formatHashrate(miner.hashrate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-tiny text-foreground-subtle">Blocks</p>
                      <p className="font-data text-sm">{miner.blocksFound}</p>
                    </div>
                    <div>
                      <p className="text-tiny text-foreground-subtle">Earned</p>
                      <p className="font-data text-sm text-success">
                        {formatCurrency(miner.earnings)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Full Leaderboard Table */}
          <Card variant="glass" className="overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-foreground-muted">
                Loading leaderboard...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-tiny font-medium text-foreground-subtle uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left text-tiny font-medium text-foreground-subtle uppercase tracking-wider">
                        Miner
                      </th>
                      <th className="px-4 py-3 text-right text-tiny font-medium text-foreground-subtle uppercase tracking-wider">
                        Hashrate
                      </th>
                      <th className="px-4 py-3 text-right text-tiny font-medium text-foreground-subtle uppercase tracking-wider">
                        Blocks
                      </th>
                      <th className="px-4 py-3 text-right text-tiny font-medium text-foreground-subtle uppercase tracking-wider">
                        Earnings
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data?.miners?.map((miner) => (
                      <tr
                        key={miner.rank}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'font-data font-bold',
                              miner.rank <= 3 && 'text-accent'
                            )}
                          >
                            #{miner.rank}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm">
                            {truncateAddress(miner.address)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-data text-accent">
                            {formatHashrate(miner.hashrate)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-data">{miner.blocksFound}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-data text-success">
                            {formatCurrency(miner.earnings)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
