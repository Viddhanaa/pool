'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { formatRelativeTime, truncateAddress, formatCrypto } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Block {
  id: string;
  height: number;
  hash: string;
  reward: number;
  confirmations: number;
  foundAt: string;
}

interface RecentBlocksWidgetProps {
  blocks: Block[];
  isLoading?: boolean;
}

export function RecentBlocksWidget({ blocks, isLoading = false }: RecentBlocksWidgetProps) {
  if (isLoading) {
    return (
      <Card variant="glass" padding="default" className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Blocks</h3>
        </div>
        <div className="space-y-3 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                <div>
                  <div className="h-4 w-20 bg-white/10 rounded mb-1"></div>
                  <div className="h-3 w-32 bg-white/10 rounded"></div>
                </div>
              </div>
              <div className="h-4 w-16 bg-white/10 rounded"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card variant="glass" padding="default" className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Blocks</h3>
        <Button asChild variant="ghost" size="sm">
          <Link href="/blocks" className="flex items-center gap-1">
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3 flex-1">
        {blocks.map((block, index) => (
          <motion.div
            key={block.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between p-3 rounded-lg bg-background-secondary/50 hover:bg-background-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${block.confirmations >= 6 ? 'bg-success/20' : 'bg-warning/20'}`}>
                {block.confirmations >= 6 ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <Clock className="h-4 w-4 text-warning" />
                )}
              </div>
              <div>
                <p className="font-mono text-sm font-medium">
                  Block #{block.height.toLocaleString()}
                </p>
                <p className="text-xs text-foreground-muted font-mono">
                  {truncateAddress(block.hash, 8, 8)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-success">
                +{formatCrypto(block.reward)}
              </p>
              <p className="text-xs text-foreground-muted">
                {formatRelativeTime(block.foundAt)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

