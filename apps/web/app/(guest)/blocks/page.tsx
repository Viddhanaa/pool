'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { useBlocks } from '@/hooks/use-api';

export default function BlocksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Fetch data from API - uses SEED DATA from database
  const { data, isLoading } = useBlocks(page, 20);

  // Log seed data from API
  console.log('🔍 Blocks Page - API Response:', {
    rawData: data,
    totalBlocks: data?.total,
    currentPageBlocks: data?.blocks?.length,
    isLoading,
    page,
    source: 'seed database via /api/v1/blocks'
  });

  const displayData = {
    blocks: data?.blocks || [],
    total: data?.total || 0,
  };

  const totalPages = Math.ceil((data?.total || 0) / 20);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const truncateHash = (hash: string, start = 10, end = 8) => {
    if (!hash) return '';
    return `${hash.slice(0, start)}...${hash.slice(-end)}`;
  };

  const truncateAddress = (address: string, start = 6, end = 4) => {
    if (!address) return '';
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  };

  const formatCrypto = (value: number) => {
    return (value / 100000000).toFixed(8) + ' BTC';
  };

  const formatRelativeTime = (dateString: string) => {
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
  };

  const BlocksTableSkeleton = () => (
    <div className="animate-pulse">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="border-b border-white/5 py-3 px-4">
          <div className="h-4 bg-white/10 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex-1">
              <h1 className="text-h1">
                <span className="text-accent">Block</span> Explorer
              </h1>
              <p className="text-foreground-subtle mt-2">
                Browse {data?.total || 0} blocks from seed data
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-subtle" />
              <input
                type="text"
                placeholder="Search by block height or hash..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-background-secondary border border-white/10 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Total Blocks</p>
              <p className="text-xl font-bold font-data text-accent">{data?.total?.toLocaleString() || 0}</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Current Page</p>
              <p className="text-xl font-bold font-data">{displayData.blocks.length}</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Confirmed</p>
              <p className="text-xl font-bold font-data text-success">
                {displayData.blocks.filter((b: any) => b.isConfirmed).length}
              </p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Pending</p>
              <p className="text-xl font-bold font-data text-warning">
                {displayData.blocks.filter((b: any) => !b.isConfirmed).length}
              </p>
            </Card>
          </div>

          {/* Blocks Table */}
          <Card variant="glass" className="overflow-hidden">
            {isLoading ? (
              <BlocksTableSkeleton />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Height</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Block Hash</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Found By</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">Reward</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">Found</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.blocks.length > 0 ? (
                        displayData.blocks.map((block: any) => (
                          <tr key={block.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-data text-accent">#{block.height?.toLocaleString()}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigator.clipboard.writeText(block.hash)}
                                  className="font-mono text-sm hover:text-accent transition-colors"
                                  title="Click to copy"
                                >
                                  {truncateHash(block.hash)}
                                </button>
                                <ExternalLink className="h-4 w-4 text-foreground-subtle hover:text-accent cursor-pointer" />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => navigator.clipboard.writeText(block.finder)}
                                className="font-mono text-sm hover:text-accent transition-colors"
                                title="Click to copy"
                              >
                                {truncateAddress(block.finder)}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-data text-success">{formatCrypto(block.reward)}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {block.isConfirmed ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-success" />
                                    <span className="text-success text-sm">Confirmed</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-4 w-4 text-warning" />
                                    <span className="text-warning text-sm">{block.confirmations}/100</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-foreground-subtle text-sm">
                                {formatRelativeTime(block.foundAt)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-foreground-subtle">
                            {searchQuery ? `No blocks found for "${searchQuery}"` : 'Loading blocks from seed data...'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                    </div>
                    <span className="text-sm text-foreground-subtle">
                      Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        disabled={page >= totalPages}
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

