'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatRelativeTime, truncateAddress, formatCrypto } from '@/lib/utils';
import { Search, ExternalLink, CheckCircle, Clock } from 'lucide-react';

interface Block {
  id: string;
  height: number;
  hash: string;
  reward: number;
  finder: string;
  foundAt: string;
  confirmations: number;
}

export default function BlocksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['blocks', page, searchQuery],
    queryFn: () => api.blocks.list({ page, limit: 20, search: searchQuery }),
  });

  const columns: Column<Block>[] = [
    {
      key: 'height',
      header: 'Height',
      render: (block) => (
        <span className="font-data text-accent">#{block.height}</span>
      ),
    },
    {
      key: 'hash',
      header: 'Block Hash',
      render: (block) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{truncateAddress(block.hash, 8, 8)}</span>
          <a
            href={`https://blockchain.info/block/${block.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-subtle hover:text-accent"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ),
    },
    {
      key: 'finder',
      header: 'Found By',
      render: (block) => (
        <span className="font-mono text-sm">{truncateAddress(block.finder)}</span>
      ),
    },
    {
      key: 'reward',
      header: 'Reward',
      render: (block) => (
        <span className="font-data text-success">{formatCrypto(block.reward)}</span>
      ),
      className: 'text-right',
    },
    {
      key: 'confirmations',
      header: 'Status',
      render: (block) => (
        <div className="flex items-center gap-2">
          {block.confirmations >= 6 ? (
            <>
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-success text-sm">Confirmed</span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-warning text-sm">
                {block.confirmations}/6
              </span>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'foundAt',
      header: 'Found',
      render: (block) => (
        <span className="text-foreground-subtle text-sm">
          {formatRelativeTime(block.foundAt)}
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h1 className="text-h1">
              <span className="text-accent">Block</span> Explorer
            </h1>

            {/* Search */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-subtle" />
              <input
                type="text"
                placeholder="Search by block height or hash..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background-secondary border border-white/10 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Total Blocks</p>
              <p className="text-xl font-bold font-data text-accent">1,234</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Last 24h</p>
              <p className="text-xl font-bold font-data">12</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Pool Luck</p>
              <p className="text-xl font-bold font-data text-success">98.5%</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Avg. Time</p>
              <p className="text-xl font-bold font-data">2h 15m</p>
            </Card>
          </div>

          {/* Blocks Table */}
          <Card variant="glass" className="overflow-hidden">
            <DataTable
              columns={columns}
              data={data?.blocks || []}
              isLoading={isLoading}
              emptyMessage="No blocks found"
              page={page}
              totalPages={data?.totalPages || 1}
              onPageChange={setPage}
            />
          </Card>
        </div>
      </main>
    </>
  );
}
