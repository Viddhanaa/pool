'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink, Copy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface BlockData {
  height: number;
  hash: string;
  miner: string;
  reward: number;
  timestamp: string;
  confirmations: number;
  transactions: number;
}

const RPC_URL = 'https://rpc.viddhana.com';
const BLOCKS_PER_PAGE = 20;
const BLOCK_REWARD = 2; // 2 BTCD

async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
  });
  const data = await response.json();
  return data.result;
}

async function getLatestBlockNumber(): Promise<number> {
  const result = await rpcCall('eth_blockNumber');
  return parseInt(result, 16);
}

async function getBlockByNumber(blockNumber: number): Promise<BlockData | null> {
  const result = await rpcCall('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  if (!result) return null;
  
  return {
    height: blockNumber,
    hash: result.hash,
    miner: result.miner,
    reward: BLOCK_REWARD,
    timestamp: new Date(parseInt(result.timestamp, 16) * 1000).toISOString(),
    confirmations: 0,
    transactions: result.transactions?.length || 0,
  };
}

async function getBlockByHash(hash: string): Promise<BlockData | null> {
  const result = await rpcCall('eth_getBlockByHash', [hash, true]);
  if (!result) return null;
  
  const height = parseInt(result.number, 16);
  return {
    height,
    hash: result.hash,
    miner: result.miner,
    reward: BLOCK_REWARD,
    timestamp: new Date(parseInt(result.timestamp, 16) * 1000).toISOString(),
    confirmations: 0,
    transactions: result.transactions?.length || 0,
  };
}

async function fetchBlocks(startBlock: number, count: number, latestBlock: number): Promise<BlockData[]> {
  const promises: Promise<BlockData | null>[] = [];
  
  for (let i = 0; i < count && (startBlock - i) >= 0; i++) {
    const blockNum = startBlock - i;
    promises.push(getBlockByNumber(blockNum));
  }
  
  const results = await Promise.all(promises);
  return results
    .filter((b): b is BlockData => b !== null)
    .map(block => ({
      ...block,
      confirmations: latestBlock - block.height,
    }));
}

function truncateHash(hash: string, startChars = 10, endChars = 8): string {
  if (!hash || hash.length <= startChars + endChars) return hash || '';
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Animated confirmation indicator
function ConfirmationIndicator({ confirmations }: { confirmations: number }) {
  const isPending = confirmations < 6;
  const segments = 6;
  const filledSegments = Math.min(confirmations, segments);
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-1.5 h-4 rounded-sm ${
              i < filledSegments
                ? confirmations >= 6
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400'
                : 'bg-white/10'
            }`}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ 
              opacity: 1, 
              scaleY: 1,
              ...(isPending && i === filledSegments - 1 ? {
                opacity: [1, 0.4, 1],
              } : {})
            }}
            transition={{ 
              delay: i * 0.05,
              duration: 0.2,
              ...(isPending && i === filledSegments - 1 ? {
                opacity: { duration: 1, repeat: Infinity, ease: 'easeInOut' }
              } : {})
            }}
          />
        ))}
      </div>
      <span className={`text-xs font-mono ${
        confirmations >= 6 ? 'text-emerald-400' : 'text-cyan-400'
      }`}>
        {confirmations >= 6 ? 'Confirmed' : `${confirmations}/6`}
      </span>
    </div>
  );
}

// Animated block row
function BlockRow({ block, index, onCopy }: { block: BlockData; index: number; onCopy: (text: string) => void }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="border-b border-white/5 hover:bg-gradient-to-r hover:from-cyan-500/5 hover:to-purple-500/5 transition-all duration-300 group"
    >
      {/* Height */}
      <td className="py-4 px-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="inline-flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:shadow-[0_0_10px_rgba(0,255,255,0.5)]" />
          <span className="font-mono text-cyan-400 font-semibold">
            #{block.height.toLocaleString()}
          </span>
        </motion.div>
      </td>
      
      {/* Hash */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopy(block.hash)}
            className="font-mono text-sm text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
            title="Copy hash"
          >
            {truncateHash(block.hash)}
            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <a
            href={`https://scan.viddhana.com/block/${block.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="h-4 w-4 text-purple-400 hover:text-purple-300" />
          </a>
        </div>
      </td>
      
      {/* Miner */}
      <td className="py-4 px-4">
        <button
          onClick={() => onCopy(block.miner)}
          className="font-mono text-sm text-gray-400 hover:text-cyan-400 transition-colors"
          title="Copy address"
        >
          {truncateHash(block.miner, 6, 4)}
        </button>
      </td>
      
      {/* Reward */}
      <td className="py-4 px-4 text-right">
        <span className="font-mono text-purple-400 font-medium">
          {block.reward} <span className="text-purple-300/70">BTCD</span>
        </span>
      </td>
      
      {/* Confirmations */}
      <td className="py-4 px-4">
        <ConfirmationIndicator confirmations={block.confirmations} />
      </td>
      
      {/* Timestamp */}
      <td className="py-4 px-4 text-right">
        <span className="text-gray-500 text-sm">
          {formatRelativeTime(block.timestamp)}
        </span>
      </td>
    </motion.tr>
  );
}

// Loading skeleton
function BlocksSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="h-14 bg-gradient-to-r from-white/5 to-white/[0.02] rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

export default function BlocksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [latestBlock, setLatestBlock] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<BlockData | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Fetch latest block number
  const fetchLatestBlock = useCallback(async () => {
    try {
      const blockNum = await getLatestBlockNumber();
      setLatestBlock(blockNum);
      return blockNum;
    } catch (error) {
      console.error('Failed to fetch latest block:', error);
      return 0;
    }
  }, []);

  // Fetch blocks for current page
  const loadBlocks = useCallback(async (latestBlockNum: number, pageNum: number) => {
    if (latestBlockNum <= 0) return;
    
    setIsLoading(true);
    try {
      const startBlock = latestBlockNum - ((pageNum - 1) * BLOCKS_PER_PAGE);
      const fetchedBlocks = await fetchBlocks(startBlock, BLOCKS_PER_PAGE, latestBlockNum);
      setBlocks(fetchedBlocks);
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and auto-refresh
  useEffect(() => {
    const init = async () => {
      const blockNum = await fetchLatestBlock();
      await loadBlocks(blockNum, page);
    };
    init();

    // Auto-refresh every 10 seconds
    const interval = setInterval(async () => {
      const blockNum = await fetchLatestBlock();
      if (page === 1) {
        await loadBlocks(blockNum, 1);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchLatestBlock, loadBlocks, page]);

  // Handle page changes
  useEffect(() => {
    if (latestBlock > 0) {
      loadBlocks(latestBlock, page);
    }
  }, [page, latestBlock, loadBlocks]);

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    try {
      let result: BlockData | null = null;
      
      // Check if it's a block number or hash
      if (searchQuery.startsWith('0x')) {
        result = await getBlockByHash(searchQuery);
      } else {
        const blockNum = parseInt(searchQuery, 10);
        if (!isNaN(blockNum)) {
          result = await getBlockByNumber(blockNum);
          if (result) {
            result.confirmations = latestBlock - result.height;
          }
        }
      }
      
      setSearchResult(result);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const totalPages = Math.ceil(latestBlock / BLOCKS_PER_PAGE);

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background via-background to-background relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 bg-clip-text text-transparent">
                  Blocks
                </span>
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  />
                  <span className="text-gray-400 text-sm">Live</span>
                </div>
                <span className="text-gray-600">|</span>
                <span className="font-mono text-cyan-400/80">
                  {latestBlock.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm">blocks</span>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text"
                placeholder="Block height or hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-24 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(0,255,255,0.1)] transition-all duration-300"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>
          </motion.div>

          {/* Search Result */}
          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
              >
                <Card variant="glow" padding="default" className="border-cyan-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-cyan-400">Search Result</span>
                    <button
                      onClick={() => {
                        setSearchResult(null);
                        setSearchQuery('');
                      }}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Height</p>
                      <p className="font-mono text-cyan-400">#{searchResult.height.toLocaleString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Hash</p>
                      <p className="font-mono text-sm text-gray-300">{truncateHash(searchResult.hash, 16, 12)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Miner</p>
                      <p className="font-mono text-sm text-gray-300">{truncateHash(searchResult.miner, 6, 4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reward</p>
                      <p className="font-mono text-purple-400">{searchResult.reward} BTCD</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <ConfirmationIndicator confirmations={searchResult.confirmations} />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: 'Latest Block', value: `#${latestBlock.toLocaleString()}`, color: 'cyan' },
              { label: 'Page Size', value: BLOCKS_PER_PAGE.toString(), color: 'purple' },
              { label: 'Block Reward', value: `${BLOCK_REWARD} BTCD`, color: 'purple' },
              { label: 'Auto Refresh', value: '10s', color: 'emerald' },
            ].map((stat, i) => (
              <Card key={i} variant="glass" padding="sm" className="backdrop-blur-xl">
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className={`font-mono text-lg font-semibold ${
                  stat.color === 'cyan' ? 'text-cyan-400' : 
                  stat.color === 'purple' ? 'text-purple-400' : 
                  'text-emerald-400'
                }`}>
                  {stat.value}
                </p>
              </Card>
            ))}
          </motion.div>

          {/* Blocks Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="glass" className="overflow-hidden backdrop-blur-xl border-white/10">
              {isLoading ? (
                <BlocksSkeleton />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02]">
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Height</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Miner</th>
                          <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Confirmations</th>
                          <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence mode="popLayout">
                          {blocks.length > 0 ? (
                            blocks.map((block, index) => (
                              <BlockRow
                                key={block.height}
                                block={block}
                                index={index}
                                onCopy={handleCopy}
                              />
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-gray-500">
                                No blocks found
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(1)}
                          disabled={page === 1}
                          className="border-white/10 hover:border-cyan-500/50"
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="border-white/10 hover:border-cyan-500/50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Page</span>
                        <input
                          type="number"
                          value={page}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                              setPage(val);
                            }
                          }}
                          className="w-16 text-center py-1 px-2 rounded bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                          min={1}
                          max={totalPages}
                        />
                        <span className="text-sm text-gray-500">of</span>
                        <span className="font-mono text-cyan-400">{totalPages.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="border-white/10 hover:border-cyan-500/50"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(totalPages)}
                          disabled={page >= totalPages}
                          className="border-white/10 hover:border-cyan-500/50"
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </motion.div>

          {/* Copy notification */}
          <AnimatePresence>
            {copiedText && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-xl text-cyan-400 text-sm"
              >
                Copied to clipboard
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
