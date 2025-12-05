'use client';

import { useState, useEffect, useMemo } from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { formatRelativeTime, truncateAddress, formatCrypto } from '@/lib/utils';
import { Search, ExternalLink, CheckCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BlocksTableSkeleton } from '@/components/blocks/blocks-table-skeleton';

type SortField = 'height' | 'reward' | 'confirmations' | 'foundAt';
type SortOrder = 'asc' | 'desc';

export default function BlocksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [sortField, setSortField] = useState<SortField>('height');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Mock data - uncomment useQuery below to use real API
  // Generate all blocks first
  const allBlocks = useMemo(() =>
    Array.from({ length: 100 }, (_, i) => ({
      id: `block-${i + 1}`,
      height: 850123 - i,
      hash: `0x${Math.random().toString(16).slice(2, 50).padEnd(64, '0')}`,
      reward: 625000000,
      finder: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      confirmations: Math.floor(Math.random() * 10),
      foundAt: new Date(Date.now() - i * 600000).toISOString(),
    })), []
  );

  // Filter blocks based on debounced search query
  const filteredBlocks = useMemo(() => {
    if (!debouncedSearch) return allBlocks;

    return allBlocks.filter((block) => {
      const query = debouncedSearch.toLowerCase().trim();
      // Search by block height
      if (!isNaN(Number(query))) {
        return block.height.toString().includes(query);
      }
      // Search by hash
      return block.hash.toLowerCase().includes(query);
    });
  }, [allBlocks, debouncedSearch]);

  // Sort filtered blocks
  const sortedBlocks = useMemo(() => {
    const sorted = [...filteredBlocks];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'height':
          comparison = a.height - b.height;
          break;
        case 'reward':
          comparison = a.reward - b.reward;
          break;
        case 'confirmations':
          comparison = a.confirmations - b.confirmations;
          break;
        case 'foundAt':
          comparison = new Date(a.foundAt).getTime() - new Date(b.foundAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredBlocks, sortField, sortOrder]);

  // Paginate sorted results
  const startIndex = (page - 1) * 20;
  const endIndex = startIndex + 20;
  const paginatedBlocks = sortedBlocks.slice(startIndex, endIndex);

  const data = {
    blocks: paginatedBlocks,
    total: sortedBlocks.length,
  };

  const statsData = {
    stats: {
      totalBlocks: 12345,
      blocksLast24h: 42,
      totalRewards: 7812500000,
      orphanRate: 1.5,
    },
  };

  // Real API calls (commented out)
  // const { data, isLoading } = useQuery({
  //   queryKey: ['blocks', page, searchQuery],
  //   queryFn: () => api.blocks.list({ page, limit: 20, search: searchQuery }),
  // });

  // const { data: statsData } = useQuery({
  //   queryKey: ['blocks-stats'],
  //   queryFn: () => api.blocks.getStats(),
  // });

  const stats = statsData?.stats;
  const totalPages = Math.ceil((data?.total || 0) / 20);
  const isLoading = false; // Mock loading state

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if clicking same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-h1">
                    <span className="text-accent">Block</span> Explorer
                  </h1>
                  {debouncedSearch && (
                    <p className="text-sm text-foreground-muted mt-2">
                      Found {data?.total.toLocaleString() || 0} result{data?.total !== 1 ? 's' : ''} for "{debouncedSearch}"
                    </p>
                  )}
                </div>
              </div>
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
              {searchQuery && searchQuery !== debouncedSearch ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full"></div>
                </div>
              ) : searchQuery ? (
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
              ) : null}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Total Blocks</p>
              <p className="text-xl font-bold font-data text-accent">{stats?.totalBlocks.toLocaleString()}</p>
            </Card>
            <Card variant="glass" padding="default">
              <p className="text-tiny text-foreground-subtle mb-1">Last 24h</p>
              <p className="text-xl font-bold font-data">{stats?.blocksLast24h.toLocaleString()}</p>
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
            {isLoading ? (
              <BlocksTableSkeleton />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">
                          <button
                            onClick={() => handleSort('height')}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Height
                            {getSortIcon('height')}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Block Hash</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Found By</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">
                          <button
                            onClick={() => handleSort('reward')}
                            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          >
                            Reward
                            {getSortIcon('reward')}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">
                          <button
                            onClick={() => handleSort('confirmations')}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Status
                            {getSortIcon('confirmations')}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">
                          <button
                            onClick={() => handleSort('foundAt')}
                            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          >
                            Found
                            {getSortIcon('foundAt')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.blocks && data.blocks.length > 0 ? (
                    data.blocks.map((block) => (
                      <tr key={block.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-data text-accent">#{block.height.toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(block.hash);
                              }}
                              className="font-mono text-sm hover:text-accent transition-colors group relative max-w-full"
                              title={showFullDetails ? 'Click to copy' : block.hash}
                            >
                              {showFullDetails ? (
                                <span className="break-all">{block.hash}</span>
                              ) : (
                                <>
                                  {truncateAddress(block.hash, 8, 8)}
                                  <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                                    📋
                                  </span>
                                  <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-background-secondary border border-white/10 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                    Click to copy full hash
                                  </span>
                                </>
                              )}
                            </button>
                            <a
                              href={`https://blockchain.info/block/${block.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground-subtle hover:text-accent transition-colors flex-shrink-0"
                              title="View on blockchain explorer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(block.finder);
                            }}
                            className="font-mono text-sm hover:text-accent transition-colors group relative"
                            title={showFullDetails ? 'Click to copy' : block.finder}
                          >
                            {showFullDetails ? (
                              block.finder
                            ) : (
                              <>
                                {block.finder.includes('...') ? block.finder : truncateAddress(block.finder)}
                                <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                                  📋
                                </span>
                                <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-background-secondary border border-white/10 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                  Click to copy address
                                </span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-data text-success">{formatCrypto(block.reward)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {block.confirmations >= 6 ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-success" />
                                <span className="text-success text-sm">Confirmed</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-4 w-4 text-warning" />
                                <span className="text-warning text-sm">{block.confirmations}/6</span>
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
                        {debouncedSearch ? (
                          <>
                            No blocks found for "{debouncedSearch}"
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setPage(1);
                              }}
                              className="block mx-auto mt-2 text-accent hover:underline text-sm"
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          'No blocks found'
                        )}
                      </td>
                    </tr>
                  )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  {'<<'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  {'<'}
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
                  disabled={page === totalPages}
                >
                  {'>'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  {'>>'}
                </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

