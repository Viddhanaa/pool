'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatHashrate, formatRelativeTime, cn } from '@/lib/utils';
import { Sparkles, RefreshCw, Settings, Power, PowerOff } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  hashrate: number;
  isOnline: boolean;
  lastSeen: string;
  difficulty: number;
  sharesValid: number;
  sharesInvalid: number;
}

export default function WorkersPage() {
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workers', filter],
    queryFn: () => api.workers.list({ status: filter === 'all' ? undefined : filter }),
    refetchInterval: 30000,
  });

  const workers = data?.workers || [];
  const onlineCount = workers.filter((w) => w.isOnline).length;
  const offlineCount = workers.filter((w) => !w.isOnline).length;

  const columns: Column<Worker>[] = [
    {
      key: 'status',
      header: '',
      render: (worker) => (
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            worker.isOnline ? 'bg-success' : 'bg-error'
          )}
        />
      ),
      className: 'w-8',
    },
    {
      key: 'name',
      header: 'Worker',
      render: (worker) => (
        <span className="font-mono text-sm">{worker.name}</span>
      ),
    },
    {
      key: 'hashrate',
      header: 'Hashrate',
      render: (worker) => (
        <span className={cn('font-data', worker.isOnline ? 'text-accent' : 'text-error')}>
          {formatHashrate(worker.hashrate)}
        </span>
      ),
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      render: (worker) => (
        <span className="font-data">{worker.difficulty.toLocaleString()}</span>
      ),
    },
    {
      key: 'shares',
      header: 'Shares (V/I)',
      render: (worker) => (
        <div className="flex gap-2">
          <span className="text-success font-data">{worker.sharesValid}</span>
          <span className="text-foreground-subtle">/</span>
          <span className="text-error font-data">{worker.sharesInvalid}</span>
        </div>
      ),
    },
    {
      key: 'lastSeen',
      header: 'Last Seen',
      render: (worker) => (
        <span className="text-foreground-muted text-sm">
          {formatRelativeTime(worker.lastSeen)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (worker) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon-sm">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm">
            {worker.isOnline ? (
              <Power className="h-4 w-4 text-success" />
            ) : (
              <PowerOff className="h-4 w-4 text-error" />
            )}
          </Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

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
            disabled={selectedWorkers.length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
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
            variant={filter === status ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Workers Table */}
      <Card variant="glass" className="overflow-hidden">
        <DataTable
          columns={columns}
          data={workers}
          isLoading={isLoading}
          emptyMessage="No workers found"
        />
      </Card>
    </div>
  );
}
