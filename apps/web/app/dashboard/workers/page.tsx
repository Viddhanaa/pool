'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Search,
  Activity,
  Zap,
  TrendingUp,
  AlertTriangle,
  Grid3X3,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Cpu,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Bell,
  Server,
  Terminal,
} from 'lucide-react';
import { useWorkers } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'hashrate' | 'status' | 'lastSeen';
type SortDirection = 'asc' | 'desc';

export default function WorkersPage() {
  const user = useAuthStore((state) => state.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading } = useWorkers(user?.id, 1, 100);

  const workers = data?.workers || [];

  // Sort and filter workers
  const filteredWorkers = useMemo(() => {
    let result = workers.filter((worker: any) => {
      const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'online' && worker.isOnline) ||
        (statusFilter === 'offline' && !worker.isOnline);
      return matchesSearch && matchesStatus;
    });

    // Sort
    result.sort((a: any, b: any) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'hashrate':
          comparison = (a.hashrate || 0) - (b.hashrate || 0);
          break;
        case 'status':
          comparison = (a.isOnline ? 1 : 0) - (b.isOnline ? 1 : 0);
          break;
        case 'lastSeen':
          comparison = new Date(a.lastShareAt || 0).getTime() - new Date(b.lastShareAt || 0).getTime();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [workers, searchQuery, statusFilter, sortField, sortDirection]);

  const onlineWorkers = workers.filter((w: any) => w.isOnline);
  const offlineWorkers = workers.filter((w: any) => !w.isOnline);
  const totalHashrate = onlineWorkers.reduce((sum: number, w: any) => sum + (w.hashrate || 0), 0);
  const avgHashrate = onlineWorkers.length > 0 ? totalHashrate / onlineWorkers.length : 0;

  // Generate alerts based on worker status
  const alerts = useMemo(() => {
    const alertList: { id: string; type: 'warning' | 'error'; message: string; time: string }[] = [];

    offlineWorkers.forEach((w: any) => {
      const lastSeen = w.lastShareAt ? new Date(w.lastShareAt) : null;
      if (lastSeen) {
        const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
        if (minutesAgo < 60) {
          alertList.push({
            id: w.id,
            type: 'warning',
            message: `${w.name} went offline`,
            time: `${minutesAgo}m ago`,
          });
        } else if (minutesAgo < 1440) {
          alertList.push({
            id: w.id,
            type: 'error',
            message: `${w.name} offline for ${Math.floor(minutesAgo / 60)}h`,
            time: formatRelativeTime(w.lastShareAt),
          });
        }
      }
    });

    return alertList.slice(0, 5);
  }, [offlineWorkers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
        sortField === field ? 'text-accent' : 'text-foreground-subtle hover:text-foreground'
      }`}
    >
      {label}
      {sortField === field ? (
        sortDirection === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header with minimal text */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/30">
            <Cpu className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-accent">Workers</span>
            </h1>
            <p className="text-xs text-foreground-subtle">Fleet Management</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 h-9 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all w-40 md:w-48"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all cursor-pointer"
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-white/5 text-foreground-subtle hover:text-foreground'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-white/5 text-foreground-subtle hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatSummaryCard
          icon={Server}
          label="Total"
          value={workers.length}
          color="accent"
          delay={0}
        />
        <StatSummaryCard
          icon={Wifi}
          label="Online"
          value={onlineWorkers.length}
          subValue={workers.length > 0 ? `${((onlineWorkers.length / workers.length) * 100).toFixed(0)}%` : undefined}
          color="success"
          delay={0.1}
          pulse
        />
        <StatSummaryCard
          icon={Zap}
          label="Hashrate"
          value={formatHashrate(totalHashrate)}
          color="purple"
          delay={0.2}
        />
        <StatSummaryCard
          icon={TrendingUp}
          label="Avg Rate"
          value={formatHashrate(avgHashrate)}
          color="accent"
          delay={0.3}
        />
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card variant="glass" className="p-4 border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">Alerts</span>
              <span className="text-xs text-foreground-subtle">({alerts.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                    alert.type === 'error'
                      ? 'bg-error/10 text-error border border-error/20'
                      : 'bg-warning/10 text-warning border border-warning/20'
                  }`}
                >
                  <WifiOff className="h-3 w-3" />
                  <span>{alert.message}</span>
                  <span className="opacity-60">{alert.time}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Workers Display */}
      {isLoading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : filteredWorkers.length > 0 ? (
        <>
          {/* Sort Controls */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-foreground-subtle">Sort:</span>
            <SortButton field="status" label="Status" />
            <SortButton field="name" label="Name" />
            <SortButton field="hashrate" label="Hashrate" />
            <SortButton field="lastSeen" label="Last Seen" />
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {filteredWorkers.map((worker: any, index: number) => (
                  <WorkerGridCard key={worker.id} worker={worker} index={index} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card variant="glass" className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-white/5 bg-white/2">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle">Worker</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle">Hashrate</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-foreground-subtle">Shares</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle">Uptime</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkers.map((worker: any, index: number) => (
                          <WorkerListRow key={worker.id} worker={worker} index={index} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : workers.length > 0 ? (
        <NoResultsCard onClear={() => { setSearchQuery(''); setStatusFilter('all'); }} />
      ) : (
        <OnboardingSection
          walletAddress={user?.walletAddress}
          copiedField={copiedField}
          onCopy={copyToClipboard}
        />
      )}

      {/* Connection Info Card - Show if workers exist but helpful for reference */}
      {workers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ConnectionInfoCard
            walletAddress={user?.walletAddress}
            copiedField={copiedField}
            onCopy={copyToClipboard}
            collapsed
          />
        </motion.div>
      )}
    </div>
  );
}

// Stat Summary Card Component
function StatSummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  delay = 0,
  pulse = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color: 'accent' | 'success' | 'purple';
  delay?: number;
  pulse?: boolean;
}) {
  const colorClasses = {
    accent: 'from-accent/20 to-accent/5 border-accent/30 text-accent',
    success: 'from-success/20 to-success/5 border-success/30 text-success',
    purple: 'from-purple/20 to-purple/5 border-purple/30 text-purple',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card
        variant="glass"
        className={`p-4 bg-gradient-to-br ${colorClasses[color]} relative overflow-hidden`}
      >
        {/* Background glow effect */}
        <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 ${
          color === 'accent' ? 'bg-accent' : color === 'success' ? 'bg-success' : 'bg-purple'
        }`} />
        
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold font-data">{value}</p>
              {subValue && <span className="text-xs text-foreground-subtle">{subValue}</span>}
            </div>
          </div>
          <div className={`relative ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className={`h-8 w-8 opacity-60 ${colorClasses[color].split(' ').pop()}`} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Worker Grid Card Component
function WorkerGridCard({ worker, index }: { worker: any; index: number }) {
  const uptime = calculateUptime(worker.connectedAt);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Card
        variant="glass"
        hover="lift"
        className={`p-4 relative overflow-hidden ${
          worker.isOnline ? 'border-success/20' : 'border-error/20 opacity-75'
        }`}
      >
        {/* Status indicator line */}
        <div
          className={`absolute top-0 left-0 right-0 h-0.5 ${
            worker.isOnline ? 'bg-gradient-to-r from-success via-accent to-success' : 'bg-error'
          }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusIndicator isOnline={worker.isOnline} />
            <span className="font-mono text-sm font-medium truncate max-w-[120px]">{worker.name}</span>
          </div>
          <span className="text-[10px] uppercase text-foreground-subtle">{worker.algorithm}</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-foreground-subtle mb-0.5">Hashrate</p>
            <p className={`text-sm font-data font-medium ${worker.isOnline ? 'text-accent' : 'text-foreground-subtle'}`}>
              {worker.isOnline ? formatHashrate(worker.hashrate) : '0 H/s'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-foreground-subtle mb-0.5">Shares</p>
            <p className="text-sm font-data">
              <span className="text-success">{abbreviateNumber(worker.sharesAccepted)}</span>
              <span className="text-foreground-subtle">/</span>
              <span className="text-error">{abbreviateNumber(worker.sharesRejected)}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-foreground-subtle mb-0.5">Uptime</p>
            <p className="text-sm font-data text-foreground">{uptime}</p>
          </div>
          <div>
            <p className="text-[10px] text-foreground-subtle mb-0.5">Last Seen</p>
            <p className="text-sm font-data text-foreground">
              {worker.lastShareAt ? formatRelativeTime(worker.lastShareAt) : 'Never'}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Worker List Row Component
function WorkerListRow({ worker, index }: { worker: any; index: number }) {
  const uptime = calculateUptime(worker.connectedAt);
  const sharePercent =
    worker.sharesAccepted + worker.sharesRejected > 0
      ? ((worker.sharesAccepted / (worker.sharesAccepted + worker.sharesRejected)) * 100).toFixed(1)
      : '0.0';

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="py-3 px-4">
        <StatusIndicator isOnline={worker.isOnline} showLabel />
      </td>
      <td className="py-3 px-4">
        <span className="font-mono text-sm font-medium">{worker.name}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`font-data ${worker.isOnline ? 'text-accent' : 'text-foreground-subtle'}`}>
          {worker.isOnline ? formatHashrate(worker.hashrate) : '0 H/s'}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="text-sm font-data">
          <span className="text-success">{worker.sharesAccepted.toLocaleString()}</span>
          <span className="text-foreground-subtle mx-1">/</span>
          <span className="text-error">{worker.sharesRejected.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-foreground-subtle">{sharePercent}% valid</div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-foreground font-data">{uptime}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-foreground-subtle">
          {worker.lastShareAt ? formatRelativeTime(worker.lastShareAt) : 'Never'}
        </span>
      </td>
    </motion.tr>
  );
}

// Status Indicator Component
function StatusIndicator({ isOnline, showLabel = false }: { isOnline: boolean; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-error'}`}
        />
        {isOnline && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-success animate-ping opacity-75" />
        )}
      </div>
      {showLabel && (
        <span className={`text-xs ${isOnline ? 'text-success' : 'text-error'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} variant="glass" className="p-4 h-36">
            <div className="animate-pulse space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-8 bg-white/5 rounded" />
                <div className="h-8 bg-white/5 rounded" />
                <div className="h-8 bg-white/5 rounded" />
                <div className="h-8 bg-white/5 rounded" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card variant="glass" className="p-4">
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded" />
        ))}
      </div>
    </Card>
  );
}

// No Results Card
function NoResultsCard({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card variant="glass" className="p-12 text-center">
        <AlertTriangle className="h-12 w-12 text-foreground-subtle mx-auto mb-4 opacity-50" />
        <p className="text-foreground-subtle mb-4">No workers match filters</p>
        <Button variant="outline" onClick={onClear}>
          Clear Filters
        </Button>
      </Card>
    </motion.div>
  );
}

// Onboarding Section for new users
function OnboardingSection({
  walletAddress,
  copiedField,
  onCopy,
}: {
  walletAddress?: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center"
    >
      {/* Hero Section */}
      <Card variant="glow" className="p-8 text-center mb-6 w-full max-w-2xl relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/30 flex items-center justify-center"
          >
            <Cpu className="h-10 w-10 text-accent" />
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">
            <span className="text-accent">Connect</span> Your First Worker
          </h2>
          <p className="text-foreground-subtle text-sm mb-6">Start mining with Viddhana Pool</p>

          {/* Quick Stats Preview */}
          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-2xl font-bold text-accent font-data">0.5%</p>
              <p className="text-[10px] text-foreground-subtle uppercase tracking-wider">Pool Fee</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple font-data">PPLNS</p>
              <p className="text-[10px] text-foreground-subtle uppercase tracking-wider">Reward</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success font-data">24/7</p>
              <p className="text-[10px] text-foreground-subtle uppercase tracking-wider">Uptime</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Connection Details */}
      <ConnectionInfoCard
        walletAddress={walletAddress}
        copiedField={copiedField}
        onCopy={onCopy}
      />
    </motion.div>
  );
}

// Connection Info Card
function ConnectionInfoCard({
  walletAddress,
  copiedField,
  onCopy,
  collapsed = false,
}: {
  walletAddress?: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  collapsed?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  const connectionDetails = [
    { label: 'Host', value: 'stratum.viddhana.com', field: 'host' },
    { label: 'Port', value: '3333', field: 'port' },
    { label: 'User', value: `${walletAddress || 'WALLET_ADDRESS'}.WORKER_NAME`, field: 'user' },
    { label: 'Password', value: 'x', field: 'password' },
  ];

  return (
    <Card variant="glass" className="w-full max-w-2xl border-accent/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-accent" />
          <span className="font-medium">Connection Details</span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
          <ArrowDown className="h-4 w-4 text-foreground-subtle" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {connectionDetails.map((detail, index) => (
                <motion.div
                  key={detail.field}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-background-secondary/50 group hover:bg-background-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-accent font-medium w-16">{detail.label}</span>
                    <span className="font-mono text-sm">{detail.value}</span>
                  </div>
                  <button
                    onClick={() => onCopy(detail.value, detail.field)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {copiedField === detail.field ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-foreground-subtle" />
                    )}
                  </button>
                </motion.div>
              ))}

              <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/10">
                <p className="text-xs text-foreground-subtle">
                  <span className="text-accent">Tip:</span> Replace WORKER_NAME with a unique identifier for each mining device
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Utility Functions
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}

function calculateUptime(connectedAt?: string): string {
  if (!connectedAt) return '-';
  const connected = new Date(connectedAt);
  const now = new Date();
  const diffMs = now.getTime() - connected.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(diffMs / 60000);
  return `${mins}m`;
}

function abbreviateNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
