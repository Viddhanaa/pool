'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRecentBlocks } from '@/hooks/use-api';

export function RecentBlocks() {
  const { data } = useRecentBlocks(5);

  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Recent Blocks</h2>
            <p className="text-foreground-muted">Latest blocks found by our pool</p>
          </div>
          <Button asChild variant="ghost">
            <Link href="/blocks" className="gap-2">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          {data?.blocks && data.blocks.length > 0 ? (
            data.blocks.slice(0, 5).map((block: any, index: number) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="glass" padding="sm" className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle className={`h-5 w-5 ${block.confirmations > 0 ? 'text-success' : 'text-warning'}`} />
                    <div>
                      <p className="font-mono text-sm text-foreground">
                        Block #{block.height.toLocaleString()}
                      </p>
                      <p className="font-mono text-xs text-foreground-muted">
                        {block.hash.slice(0, 16)}...{block.hash.slice(-8)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-accent">
                      +{(Number(block.reward) / 1e8).toFixed(8)} BTCD
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {new Date(block.foundAt).toLocaleTimeString()}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card variant="glass" padding="default" className="text-center">
              <p className="text-foreground-muted">Loading blocks from API...</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

