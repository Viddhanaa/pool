'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Activity, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { useWorkers } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

export default function WorkersPage() {
  const user = useAuthStore((state) => state.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  const { data, isLoading } = useWorkers(user?.id, 1, 100);

  // Log seed data from API
  console.log('🔍 Workers Page - API Response:', {
    rawData: data,
    workerCount: data?.workers?.length,
    totalWorkers: data?.total,
    isLoading,
    userId: user?.id,
    source: 'seed database via /api/v1/workers'
  });

  const workers = data?.workers || [];
  const filteredWorkers = workers.filter((worker: any) => {
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'online' && worker.isOnline) ||
      (statusFilter === 'offline' && !worker.isOnline);
    return matchesSearch && matchesStatus;
  });

  const onlineWorkers = workers.filter((w: any) => w.isOnline);
  const totalHashrate = onlineWorkers.reduce((sum: number, w: any) => sum + w.hashrate, 0);
  const avgHashrate = onlineWorkers.length > 0 ? totalHashrate / onlineWorkers.length : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">
            <span className="text-accent">Workers</span> Management
          </h1>
          <p className="text-foreground-subtle mt-2">
            Monitor and manage all your mining workers
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-subtle" />
            <input
              type="text"
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg bg-background-secondary border border-white/10 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent/50 transition-colors min-w-[200px]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 rounded-lg bg-background-secondary border border-white/10 text-foreground focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="all">All Workers</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-tiny text-foreground-subtle mb-1">Total Workers</p>
              <p className="text-2xl font-bold font-data">{workers.length}</p>
            </div>
            <Activity className="h-8 w-8 text-accent opacity-50" />
          </div>
        </Card>

        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-tiny text-foreground-subtle mb-1">Online Workers</p>
          <p className="text-2xl font-bold font-data text-error">{workers.length - onlineWorkers.length}</p>
            </div>
            <Zap className="h-8 w-8 text-success opacity-50" />
          </div>
        </Card>

        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-tiny text-foreground-subtle mb-1">Total Hashrate</p>
              <p className="text-2xl font-bold font-data text-accent">
                {(totalHashrate / 1e9).toFixed(2)} <span className="text-sm">GH/s</span>
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-accent opacity-50" />
          </div>
        </Card>

        <Card variant="glass" padding="default">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-tiny text-foreground-subtle mb-1">Avg Hashrate</p>
              <p className="text-2xl font-bold font-data text-purple">
                {(avgHashrate / 1e9).toFixed(2)} <span className="text-sm">GH/s</span>
              </p>
            </div>
            <Activity className="h-8 w-8 text-purple opacity-50" />
          </div>
        </Card>
      </div>

      {/* Workers Table */}
      <Card variant="glass" className="overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        ) : filteredWorkers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Worker Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Hashrate</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Difficulty</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Algorithm</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">Shares</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Last Share</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Version</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker: any) => (
                  <tr key={worker.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            worker.isOnline ? 'bg-success animate-pulse' : 'bg-error'
                          }`}
                        />
                        <span className={`text-sm ${worker.isOnline ? 'text-success' : 'text-error'}`}>
                          {worker.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm font-medium">{worker.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-data ${worker.isOnline ? 'text-accent' : 'text-foreground-subtle'}`}>
                        {worker.isOnline ? `${(worker.hashrate / 1e9).toFixed(2)} GH/s` : '0 H/s'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground-subtle">{worker.difficulty}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm uppercase text-foreground-subtle">{worker.algorithm}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-sm">
                        <span className="text-success">{worker.sharesAccepted.toLocaleString()}</span>
                        {' / '}
                        <span className="text-error">{worker.sharesRejected.toLocaleString()}</span>
                      </div>
                      <div className="text-tiny text-foreground-subtle">
                        {((worker.sharesAccepted / (worker.sharesAccepted + worker.sharesRejected)) * 100).toFixed(1)}% valid
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground-subtle">
                        {worker.lastShareAt ? formatRelativeTime(worker.lastShareAt) : 'Never'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground-subtle">{worker.version || 'Unknown'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-foreground-subtle mx-auto mb-4" />
            <p className="text-foreground-subtle">
              {searchQuery || statusFilter !== 'all'
                ? 'No workers match your filters'
                : 'No workers found. Connect your miners to get started.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Connection Info */}
      {workers.length === 0 && !isLoading && (
        <Card variant="glow" padding="default">
          <h3 className="text-h4 mb-4">Connect Your First Worker</h3>
          <div className="space-y-2 text-sm">
            <p className="text-foreground-subtle">Use the following connection details:</p>
            <div className="bg-background-secondary/50 p-4 rounded-lg font-mono">
              <p><span className="text-accent">Host:</span> stratum.viddhana.io</p>
              <p><span className="text-accent">Port:</span> 3333</p>
              <p><span className="text-accent">User:</span> {user?.walletAddress || 'YOUR_WALLET_ADDRESS'}</p>
              <p><span className="text-accent">Password:</span> x</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
