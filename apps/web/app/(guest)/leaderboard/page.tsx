'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Award, TrendingUp, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('24h');

  // Fetch leaderboard data from PUBLIC API endpoint (uses SEED DATA)
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['leaderboard', timeframe],
    queryFn: () => apiClient.get('/leaderboard', { params: { timeframe } }),
    refetchInterval: 30000,
  });

  // Log seed data
  console.log('🔍 Leaderboard - API Response:', {
    leaderboardData,
    minerCount: leaderboardData?.miners?.length,
    total: leaderboardData?.total,
    source: 'seed database via /api/v1/leaderboard'
  });

  // Get miners from API response
  const miners = useMemo(() => {
    return leaderboardData?.miners || [];
  }, [leaderboardData]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-warning" />;
      case 2:
        return <Medal className="h-6 w-6 text-foreground-subtle" />;
      case 3:
        return <Award className="h-6 w-6 text-orange-600" />;
      default:
        return <span className="text-foreground-subtle font-bold">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-warning/10 border-warning/30';
      case 2:
        return 'bg-foreground-subtle/10 border-foreground-subtle/30';
      case 3:
        return 'bg-orange-600/10 border-orange-600/30';
      default:
        return 'bg-transparent border-white/5';
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-h1">
                <Trophy className="inline-block h-10 w-10 text-accent mr-3 mb-2" />
                <span className="text-accent">Leaderboard</span>
              </h1>
              <p className="text-foreground-subtle mt-2">
                Top {miners.length} online miners from seed data (ranked by hashrate)
              </p>
            </div>

            <div className="flex gap-2">
              {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    timeframe === tf
                      ? 'bg-accent text-white'
                      : 'bg-background-secondary hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {tf === 'all' ? 'All Time' : tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Top 3 Podium */}
          {!isLoading && miners.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* 2nd Place */}
              <Card variant="glass" padding="default" className="md:mt-8 order-2 md:order-1">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <Medal className="h-16 w-16 text-foreground-subtle" />
                  </div>
                  <div className="text-4xl font-bold mb-2">2nd</div>
                  <div className="font-mono text-lg mb-4">{miners[1].username}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Hashrate:</span>
                      <span className="font-data text-accent">
                        {(miners[1].hashrate / 1e9).toFixed(2)} GH/s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Efficiency:</span>
                      <span className="font-data text-success">{miners[1].efficiency}%</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 1st Place */}
              <Card variant="glow" padding="default" className="order-1 md:order-2">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <Trophy className="h-20 w-20 text-warning animate-pulse" />
                  </div>
                  <div className="text-5xl font-bold mb-2 text-warning">1st</div>
                  <div className="font-mono text-xl mb-4">{miners[0].username}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Hashrate:</span>
                      <span className="font-data text-accent text-lg">
                        {(miners[0].hashrate / 1e9).toFixed(2)} GH/s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Efficiency:</span>
                      <span className="font-data text-success text-lg">{miners[0].efficiency}%</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 3rd Place */}
              <Card variant="glass" padding="default" className="md:mt-8 order-3">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <Award className="h-16 w-16 text-orange-600" />
                  </div>
                  <div className="text-4xl font-bold mb-2">3rd</div>
                  <div className="font-mono text-lg mb-4">{miners[2].username}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Hashrate:</span>
                      <span className="font-data text-accent">
                        {(miners[2].hashrate / 1e9).toFixed(2)} GH/s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-subtle">Efficiency:</span>
                      <span className="font-data text-success">{miners[2].efficiency}%</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Full Leaderboard */}
          <Card variant="glass" className="overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-h3">All Miners</h2>
            </div>

            {isLoading ? (
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/5 rounded" />
                  ))}
                </div>
              </div>
            ) : miners.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="h-16 w-16 text-foreground-subtle mx-auto mb-4 opacity-30" />
                <p className="text-foreground-subtle text-lg mb-2">No Active Miners</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/5">
                    <tr>
                      <th className="text-left py-3 px-6 text-sm font-medium text-foreground-subtle">Rank</th>
                      <th className="text-left py-3 px-6 text-sm font-medium text-foreground-subtle">Miner</th>
                      <th className="text-right py-3 px-6 text-sm font-medium text-foreground-subtle">Hashrate</th>
                      <th className="text-right py-3 px-6 text-sm font-medium text-foreground-subtle">Shares</th>
                      <th className="text-right py-3 px-6 text-sm font-medium text-foreground-subtle">Efficiency</th>
                      <th className="text-right py-3 px-6 text-sm font-medium text-foreground-subtle">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miners.map((miner: any) => (
                      <tr
                        key={miner.rank}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${getRankColor(
                          miner.rank
                        )}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {getRankIcon(miner.rank)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono font-medium">{miner.username}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Zap className="h-4 w-4 text-accent" />
                            <span className="font-data text-accent">
                              {(miner.hashrate / 1e9).toFixed(2)} GH/s
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="font-data">{miner.shares.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="font-data text-success">{miner.efficiency}%</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <TrendingUp className="h-4 w-4 text-success" />
                            <span className="text-sm text-success">Excellent</span>
                          </div>
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

