'use client';

import { useState } from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, RefreshCw, Search, Settings } from 'lucide-react';

export default function WorkersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Mock data - uncomment useQuery below to use real API
  const data = {
    workers: Array.from({ length: 15 }, (_, i) => ({
      id: `worker-${i + 1}`,
      name: `Worker-${String(i + 1).padStart(2, '0')}`,
      hashrate: Math.floor(Math.random() * 5000000000),
      isOnline: Math.random() > 0.3,
      lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      difficulty: 1024 * Math.pow(2, Math.floor(Math.random() * 10)),
      sharesValid: Math.floor(Math.random() * 10000),
      sharesInvalid: Math.floor(Math.random() * 100),
    })),
    total: 15,
  };

  // Real API call (commented out)
  // const { data, isLoading, refetch } = useQuery({
  //   queryKey: ['workers', statusFilter],
  //   queryFn: () => api.workers.list({ status: statusFilter !== 'all' ? statusFilter : undefined }),
  //   refetchInterval: 30000,
  // });

  const isLoading = false; // Mock loading state
  const refetch = () => console.log('Refreshing workers...');

  const workers = data.workers || [];
  const onlineCount = workers.filter((w) => w.isOnline).length;
  const offlineCount = workers.filter((w) => !w.isOnline).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Workers</h1>
          <p className="text-foreground-muted mt-1">
            Manage and monitor your mining workers
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="glow"
            size="sm"
            disabled={workers.filter(w => w.isOnline).length === 0}
          >
            <Cpu className="h-4 w-4 mr-2" />
            Optimize Selected
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="glass" padding="default">
          <p className="text-tiny text-foreground-subtle mb-1">Total Workers</p>
          <p className="text-2xl font-bold font-data">{workers.length}</p>
        </Card>
        <Card variant="glass" padding="default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <p className="text-tiny text-foreground-subtle">Online</p>
          </div>
          <p className="text-2xl font-bold font-data text-success">{onlineCount}</p>
        </Card>
        <Card variant="glass" padding="default">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-error" />
            <p className="text-tiny text-foreground-subtle">Offline</p>
          </div>
          <p className="text-2xl font-bold font-data text-error">{offlineCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-1 rounded-lg bg-background-secondary w-fit">
        {(['all', 'online', 'offline'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Workers Table */}
      <Card variant="glass" className="overflow-hidden">
        {/* Table component here */}
      </Card>
    </div>
  );
}
