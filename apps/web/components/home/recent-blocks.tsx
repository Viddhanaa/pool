'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
// import { useQuery } from '@tanstack/react-query';
// import { api } from '@/lib/api';

export function RecentBlocks() {
  // Mock data - uncomment useQuery below to use real API
  const data = {
    blocks: [
      {
        id: '1',
        height: 850123,
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        reward: 625000000,
        confirmations: 6,
        foundAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
      },
      {
        id: '2',
        height: 850122,
        hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        reward: 625000000,
        confirmations: 4,
        foundAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
      },
      {
        id: '3',
        height: 850121,
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        reward: 625000000,
        confirmations: 2,
        foundAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 mins ago
      },
      {
        id: '4',
        height: 850120,
        hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        reward: 625000000,
        confirmations: 0,
        foundAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
      },
      {
        id: '5',
        height: 850119,
        hash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
        reward: 625000000,
        confirmations: 8,
        foundAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
      },
    ],
  };

  // Real API call (commented out)
  // const { data } = useQuery({
  //   queryKey: ['recent-blocks'],
  //   queryFn: () => api.blocks.list({ page: 1, limit: 5 }),
  //   refetchInterval: 10000, // Refresh every 10s
  // });

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
            data.blocks.slice(0, 5).map((block, index) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="glass" padding="sm" className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {block.confirmations > 0 ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-warning" />
                    )}
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
                      +{(Number(block.reward) / 1e8).toFixed(8)} VIDP
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
              <p className="text-foreground-muted">No blocks found yet</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

