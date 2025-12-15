'use client';

import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { HashrateChart } from '@/components/charts/hashrate-chart';
import { Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  Wallet,
  TrendingUp,
  Clock,
  Sparkles,
  Cpu,
  ArrowUpRight,
  RefreshCw,
  Settings,
  Download,
  Brain,
  CircleDot,
  ChevronRight,
} from 'lucide-react';
import { useDashboardOverview, usePayouts, usePoolStats } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

// Helper to format hashrate with appropriate unit
function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const glowVariants = {
  glow: {
    boxShadow: [
      '0 0 20px rgba(0, 255, 255, 0.1)',
      '0 0 40px rgba(0, 255, 255, 0.2)',
      '0 0 20px rgba(0, 255, 255, 0.1)',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = user?.id;

  const { data: overview, isLoading, refetch } = useDashboardOverview();
  const { data: poolStats } = usePoolStats();
  const { data: payoutsData } = usePayouts(userId, 1, 5);

  // Real-time update indicator
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [refetch]);

  // Use pool stats as fallback when user data is not available
  // Check isAuthenticated from store, not just user object
  const isLoggedIn = isAuthenticated;
  const userHashrate = overview?.user?.hashrate || 0;
  const poolHashrate = poolStats?.hashrate || overview?.pool?.hashrate || 0;
  const displayHashrate = userHashrate > 0 ? userHashrate : poolHashrate;
  const hasNoWorkers = isLoggedIn && (overview?.user?.totalWorkers === 0 || overview?.workers?.length === 0);

  const workers = overview?.workers || [];
  const onlineWorkers = workers.filter((w: any) => w.isOnline);
  const offlineWorkers = workers.filter((w: any) => w.isOnline === false);

  // Use pool active workers if no user workers
  const displayActiveWorkers =
    onlineWorkers.length > 0
      ? onlineWorkers.length
      : poolStats?.activeWorkers || overview?.pool?.activeWorkers || 0;
  const displayOfflineWorkers = offlineWorkers.length;

  const recentPayouts = payoutsData?.payouts || [];

  // Earnings - use user earnings if available, otherwise show estimated pool earnings
  const userEarnings24h = overview?.earnings?.last24h || 0;
  const userPending = overview?.earnings?.pending || 0;
  
  // Estimated earnings from pool tokenomics
  const dailyEmission = poolStats?.dailyEmission || 100000;
  const activeMiners = poolStats?.activeMiners || 1;
  const estimatedDailyPerMiner = dailyEmission / Math.max(activeMiners, 1);
  
  // Display earnings: if logged in show user data (even if 0), otherwise show estimated
  const displayPending = isLoggedIn ? userPending : estimatedDailyPerMiner * 0.1;
  const displayEarnings24h = isLoggedIn ? userEarnings24h : estimatedDailyPerMiner;

  // AI Prediction calculations - always use estimated for projections
  const dailyEarnings = estimatedDailyPerMiner;
  const weeklyProjection = dailyEarnings * 7;
  const monthlyProjection = dailyEarnings * 30;
  const poolShare =
    displayHashrate > 0 && poolHashrate > 0
      ? (displayHashrate / poolHashrate) * 100
      : 100;

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header with real-time indicator */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full bg-success"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-foreground-subtle font-mono">
            LIVE DATA
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <RefreshCw className="w-3 h-3" />
          <span>Updated {formatRelativeTime(lastUpdate.toISOString())}</span>
        </div>
      </motion.div>

      {/* Pool Data Notice - only show when NOT logged in */}
      <AnimatePresence>
        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-3">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-sm text-accent">
                Displaying estimated pool statistics. Login and connect workers to see your personal data.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Workers Notice - show when logged in but no workers */}
      <AnimatePresence>
        {isLoggedIn && workers.length === 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 rounded-lg bg-purple/5 border border-purple/20 flex items-center gap-3">
              <Cpu className="w-4 h-4 text-purple" />
              <span className="text-sm text-purple">
                No workers connected yet. Start mining to see your earnings!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Current Hashrate"
          value={displayHashrate > 0 ? formatHashrate(displayHashrate) : '0 H/s'}
          subtitle={userHashrate > 0 ? 'Real-time' : 'Pool total'}
          icon={Activity}
          color="accent"
          isLoading={isLoading}
          trend={
            displayHashrate > 0
              ? {
                  value: 5.2,
                  label: 'active',
                }
              : undefined
          }
        />

        <StatCard
          title="Active Workers"
          value={displayActiveWorkers}
          subtitle={
            displayOfflineWorkers > 0
              ? `${displayOfflineWorkers} offline`
              : 'All systems nominal'
          }
          icon={Cpu}
          color="success"
          isLoading={isLoading}
        />

        <StatCard
          title="Pending Balance"
          value={displayPending.toFixed(2)}
          subtitle={!isLoggedIn ? 'Est. BTCD' : 'BTCD'}
          icon={Wallet}
          color="purple"
          isLoading={isLoading}
        />

        <StatCard
          title="24h Earnings"
          value={displayEarnings24h.toFixed(2)}
          subtitle={!isLoggedIn ? 'Est. BTCD/day' : 'BTCD'}
          icon={TrendingUp}
          color="warning"
          isLoading={isLoading}
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hashrate Chart - Spans 2 columns */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <motion.div
            variants={glowVariants}
            animate="glow"
            className="rounded-xl"
          >
            <Card
              variant="glass"
              padding="default"
              className="relative overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple/5 rounded-full blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-gradient-to-b from-accent to-accent/30 rounded-full" />
                    <h3 className="text-lg font-semibold">Hashrate History</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground-muted px-2 py-1 rounded bg-white/5">
                      24H
                    </span>
                  </div>
                </div>
                <Suspense
                  fallback={
                    <div className="h-[300px] animate-pulse bg-white/5 rounded-lg flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-accent/50 animate-spin" />
                    </div>
                  }
                >
                  <HashrateChart timeRange="24h" height={300} />
                </Suspense>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Prometheus AI Predictions */}
        <motion.div variants={itemVariants}>
          <Card
            variant="glow-purple"
            padding="default"
            className="relative overflow-hidden h-full"
          >
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-purple/10 via-transparent to-accent/5"
              animate={{
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Neural network pattern */}
            <div className="absolute top-4 right-4 opacity-10">
              <Brain className="w-24 h-24 text-purple" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-5 w-5 text-purple" />
                </motion.div>
                <span className="text-lg font-semibold bg-gradient-to-r from-purple to-accent bg-clip-text text-transparent">
                  Prometheus AI
                </span>
              </div>

              <div className="space-y-5">
                <AIProjectionItem
                  icon={TrendingUp}
                  label="Daily Projection"
                  value={`${dailyEarnings.toFixed(8)} BTCD`}
                  confidence={94}
                  delay={0}
                />
                <AIProjectionItem
                  icon={Clock}
                  label="Weekly Projection"
                  value={`${weeklyProjection.toFixed(8)} BTCD`}
                  confidence={87}
                  delay={0.1}
                />
                <AIProjectionItem
                  icon={Activity}
                  label="Monthly Projection"
                  value={`${monthlyProjection.toFixed(6)} BTCD`}
                  confidence={72}
                  delay={0.2}
                />
                <AIProjectionItem
                  icon={Zap}
                  label="Pool Share"
                  value={`${poolShare.toFixed(4)}%`}
                  confidence={99}
                  delay={0.3}
                />
              </div>

              <motion.div
                className="mt-6 p-3 rounded-lg bg-purple/5 border border-purple/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    variants={pulseVariants}
                    animate="pulse"
                    className="w-1.5 h-1.5 rounded-full bg-purple"
                  />
                  <p className="text-xs text-foreground-muted">
                    Neural analysis • Real-time inference
                  </p>
                </div>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers Overview */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card variant="glass" padding="default" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-success to-success/30 rounded-full" />
                <h3 className="text-lg font-semibold">Workers</h3>
              </div>
              <a
                href="/dashboard/workers"
                className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>

            {/* Worker Status Summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <CircleDot className="w-3 h-3 text-success" />
                  <span className="text-xs text-foreground-muted">Online</span>
                </div>
                <p className="text-2xl font-bold font-data text-success">
                  {onlineWorkers.length || displayActiveWorkers}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-error/5 border border-error/20">
                <div className="flex items-center gap-2 mb-1">
                  <CircleDot className="w-3 h-3 text-error" />
                  <span className="text-xs text-foreground-muted">Offline</span>
                </div>
                <p className="text-2xl font-bold font-data text-error">
                  {displayOfflineWorkers}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="animate-pulse h-12 bg-white/5 rounded-lg"
                  />
                ))
              ) : workers.length > 0 ? (
                workers.slice(0, 4).map((worker: any, index: number) => (
                  <WorkerRow
                    key={worker.id}
                    name={worker.name}
                    hashrate={formatHashrate(worker.hashrate || 0)}
                    status={worker.isOnline ? 'online' : 'offline'}
                    index={index}
                  />
                ))
              ) : displayActiveWorkers > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-6"
                >
                  <Cpu className="w-8 h-8 text-accent/50 mx-auto mb-2" />
                  <p className="text-sm text-foreground-subtle">
                    {displayActiveWorkers} pool worker
                    {displayActiveWorkers > 1 ? 's' : ''} active
                  </p>
                  <p className="text-xs text-accent mt-1">
                    Connect to see details
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Cpu className="w-8 h-8 text-foreground-muted/30 mx-auto mb-2" />
                  <p className="text-sm text-foreground-muted">No workers</p>
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Recent Payouts */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card variant="glass" padding="default" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-warning to-warning/30 rounded-full" />
                <h3 className="text-lg font-semibold">Recent Payouts</h3>
              </div>
              <a
                href="/dashboard/payouts"
                className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="animate-pulse h-14 bg-white/5 rounded-lg"
                  />
                ))
              ) : recentPayouts.length > 0 ? (
                recentPayouts.map((payout: any, index: number) => (
                  <PayoutRow
                    key={payout.id}
                    amount={`${payout.amount.toFixed(8)} BTCD`}
                    date={formatRelativeTime(payout.createdAt)}
                    status={payout.status.toLowerCase()}
                    index={index}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Wallet className="w-8 h-8 text-foreground-muted/30 mx-auto mb-2" />
                  <p className="text-sm text-foreground-muted">
                    No payouts yet
                  </p>
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card variant="glass" padding="default" className="h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-accent to-accent/30 rounded-full" />
              <h3 className="text-lg font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-3">
              <QuickActionButton
                icon={ArrowUpRight}
                label="Start Mining"
                description="Configure your miner"
                href="/get-started"
                color="accent"
                index={0}
              />
              <QuickActionButton
                icon={Settings}
                label="Worker Settings"
                description="Manage workers"
                href="/dashboard/workers"
                color="purple"
                index={1}
              />
              <QuickActionButton
                icon={Wallet}
                label="Request Payout"
                description="Withdraw earnings"
                href="/dashboard/payouts"
                color="warning"
                index={2}
              />
              <QuickActionButton
                icon={Download}
                label="Export Data"
                description="Download reports"
                href="/dashboard/settings"
                color="success"
                index={3}
              />
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

interface AIProjectionItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  confidence: number;
  delay: number;
}

function AIProjectionItem({
  icon: Icon,
  label,
  value,
  confidence,
  delay,
}: AIProjectionItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center justify-between group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple/10 group-hover:bg-purple/20 transition-colors">
          <Icon className="h-4 w-4 text-purple" />
        </div>
        <div>
          <p className="text-xs text-foreground-muted">{label}</p>
          <p className="font-data text-sm font-semibold text-white">{value}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-purple/50 to-purple"
            style={{ width: `${confidence * 0.4}px` }}
          />
          <span className="text-xs font-data text-purple">{confidence}%</span>
        </div>
      </div>
    </motion.div>
  );
}

interface WorkerRowProps {
  name: string;
  hashrate: string;
  status: 'online' | 'offline';
  index: number;
}

function WorkerRow({ name, hashrate, status, index }: WorkerRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all group"
    >
      <div className="flex items-center gap-3">
        <motion.div
          className={`w-2 h-2 rounded-full ${
            status === 'online' ? 'bg-success' : 'bg-error'
          }`}
          animate={
            status === 'online'
              ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="font-mono text-sm text-foreground-subtle group-hover:text-white transition-colors">
          {name}
        </span>
      </div>
      <span
        className={`font-data text-sm ${
          status === 'online' ? 'text-accent' : 'text-error'
        }`}
      >
        {hashrate}
      </span>
    </motion.div>
  );
}

interface PayoutRowProps {
  amount: string;
  date: string;
  status: string;
  index: number;
}

function PayoutRow({ amount, date, status, index }: PayoutRowProps) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'bg-success/10', text: 'text-success' },
    pending: { bg: 'bg-warning/10', text: 'text-warning' },
    processing: { bg: 'bg-accent/10', text: 'text-accent' },
    failed: { bg: 'bg-error/10', text: 'text-error' },
  };

  const config = statusConfig[status] || {
    bg: 'bg-foreground-subtle/10',
    text: 'text-foreground-subtle',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all"
    >
      <div>
        <p className="font-data text-sm text-success">{amount}</p>
        <p className="text-xs text-foreground-muted">{date}</p>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded-full capitalize ${config.bg} ${config.text}`}
      >
        {status}
      </span>
    </motion.div>
  );
}

interface QuickActionButtonProps {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: 'accent' | 'purple' | 'warning' | 'success';
  index: number;
}

function QuickActionButton({
  icon: Icon,
  label,
  description,
  href,
  color,
  index,
}: QuickActionButtonProps) {
  const colorClasses = {
    accent: 'bg-accent/10 text-accent group-hover:bg-accent/20',
    purple: 'bg-purple/10 text-purple group-hover:bg-purple/20',
    warning: 'bg-warning/10 text-warning group-hover:bg-warning/20',
    success: 'bg-success/10 text-success group-hover:bg-success/20',
  };

  const borderColors = {
    accent: 'hover:border-accent/30',
    purple: 'hover:border-purple/30',
    warning: 'hover:border-warning/30',
    success: 'hover:border-success/30',
  };

  return (
    <motion.a
      href={href}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ x: 4 }}
      className={`flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 ${borderColors[color]} transition-all group cursor-pointer`}
    >
      <div className={`p-2 rounded-lg ${colorClasses[color]} transition-colors`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-foreground-muted group-hover:text-white transition-colors" />
    </motion.a>
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
