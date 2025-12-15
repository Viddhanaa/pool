'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardOverview, usePoolStats, useBlocks, useHashrateHistory } from '@/hooks/use-api';
import { formatHashrate, formatRelativeTime, truncateAddress } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  BarChart3,
  PieChart,
  Share2,
  Target,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Zap,
  Box,
  ChevronRight,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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

type TimeRange = '24h' | '7d' | '30d';

interface ShareStats {
  accepted: number;
  rejected: number;
  stale: number;
}

export default function MiningStatsPage() {
  const user = useAuthStore((state) => state.user);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: overview, isLoading, refetch } = useDashboardOverview();
  const { data: poolStats } = usePoolStats();
  const { data: blocksData } = useBlocks(1, 10);

  // Compute hours based on time range
  const hoursMap: Record<TimeRange, number> = {
    '24h': 24,
    '7d': 168,
    '30d': 720,
  };

  const { data: hashrateData } = useHashrateHistory(hoursMap[timeRange]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Mock share stats - in real app these would come from API
  const shareStats: ShareStats = useMemo(() => {
    const baseAccepted = poolStats?.totalShares || overview?.pool?.totalShares || 1245678;
    return {
      accepted: baseAccepted,
      rejected: Math.floor(baseAccepted * 0.012), // ~1.2% rejection rate
      stale: Math.floor(baseAccepted * 0.005), // ~0.5% stale rate
    };
  }, [poolStats, overview]);

  // Calculate efficiency
  const efficiency = useMemo(() => {
    const total = shareStats.accepted + shareStats.rejected + shareStats.stale;
    return total > 0 ? ((shareStats.accepted / total) * 100).toFixed(2) : '0.00';
  }, [shareStats]);

  // Prepare hashrate chart data
  const hashrateChartData = useMemo(() => {
    if (!hashrateData?.data) {
      // Generate mock data based on time range
      const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
      const baseHashrate = poolStats?.hashrate || 1.5e12;
      return Array.from({ length: points }, (_, i) => ({
        timestamp: new Date(Date.now() - (points - i - 1) * (timeRange === '24h' ? 3600000 : 86400000)).toISOString(),
        hashrate: baseHashrate * (0.9 + Math.random() * 0.2),
        label: timeRange === '24h' 
          ? `${i}h` 
          : timeRange === '7d' 
            ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i % 7]
            : `Day ${i + 1}`,
      }));
    }
    return hashrateData.data.map((point: any) => ({
      ...point,
      label: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [hashrateData, timeRange, poolStats]);

  // Prepare difficulty chart data
  const difficultyChartData = useMemo(() => {
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    const baseDifficulty = poolStats?.difficulty || 52.5e12;
    return Array.from({ length: points }, (_, i) => ({
      label: timeRange === '24h' 
        ? `${i}h` 
        : timeRange === '7d' 
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i % 7]
          : `D${i + 1}`,
      difficulty: baseDifficulty * (0.95 + Math.random() * 0.1),
    }));
  }, [timeRange, poolStats]);

  // Prepare pie chart data
  const sharesPieData = useMemo(() => [
    { name: 'Accepted', value: shareStats.accepted, color: '#00FFFF' },
    { name: 'Rejected', value: shareStats.rejected, color: '#EF4444' },
    { name: 'Stale', value: shareStats.stale, color: '#F59E0B' },
  ], [shareStats]);

  // User blocks
  const userBlocks = useMemo(() => {
    if (!blocksData?.blocks) return [];
    // Filter blocks by user if available, otherwise show recent blocks
    return blocksData.blocks.slice(0, 5).map((block: any) => ({
      ...block,
      id: block.id || block.hash?.slice(0, 8),
    }));
  }, [blocksData]);

  // Performance metrics
  const performanceMetrics = useMemo(() => ({
    efficiency: parseFloat(efficiency),
    uptime: 99.7,
    avgHashrate: poolStats?.hashrate || overview?.user?.hashrate || 0,
    blocksFound: blocksData?.total || poolStats?.blocksFound || 0,
    totalEarnings: overview?.earnings?.total || 0,
  }), [efficiency, poolStats, overview, blocksData]);

  // Export data handler
  const handleExportData = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      timeRange,
      shareStats,
      efficiency,
      performanceMetrics,
      hashrateData: hashrateChartData,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mining-stats-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full bg-success"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-foreground-subtle font-mono">
            MINING STATS
          </span>
          <span className="text-xs text-foreground-muted">
            Updated {formatRelativeTime(lastUpdate.toISOString())}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <motion.button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeRange === range
                    ? 'bg-accent text-background'
                    : 'text-foreground-muted hover:text-white hover:bg-white/5'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {range.toUpperCase()}
              </motion.button>
            ))}
          </div>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </motion.div>

      {/* Stats Overview Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <MiniStatCard
          icon={Activity}
          label="Hashrate"
          value={formatHashrate(performanceMetrics.avgHashrate)}
          color="accent"
          isLoading={isLoading}
        />
        <MiniStatCard
          icon={Target}
          label="Efficiency"
          value={`${performanceMetrics.efficiency}%`}
          color="success"
          isLoading={isLoading}
        />
        <MiniStatCard
          icon={Zap}
          label="Uptime"
          value={`${performanceMetrics.uptime}%`}
          color="purple"
          isLoading={isLoading}
        />
        <MiniStatCard
          icon={Box}
          label="Blocks Found"
          value={performanceMetrics.blocksFound.toString()}
          color="warning"
          isLoading={isLoading}
        />
      </motion.div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hashrate Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <motion.div variants={glowVariants} animate="glow" className="rounded-xl">
            <Card variant="glass" padding="default" className="relative overflow-hidden">
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
                      {timeRange.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hashrateChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hashrateGradientStats" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#00FFFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B6B7B', fontSize: 11 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B6B7B', fontSize: 11 }}
                        tickFormatter={(value) => formatYAxis(value)}
                        dx={-10}
                      />
                      <Tooltip content={<HashrateTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="hashrate"
                        stroke="#00FFFF"
                        strokeWidth={2}
                        fill="url(#hashrateGradientStats)"
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Shares Statistics */}
        <motion.div variants={itemVariants}>
          <Card variant="glass" padding="default" className="h-full relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple/5"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-gradient-to-b from-purple to-purple/30 rounded-full" />
                <h3 className="text-lg font-semibold">Share Statistics</h3>
              </div>

              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={sharesPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {sharesPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ShareTooltip />} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4">
                <ShareStatRow
                  icon={CheckCircle2}
                  label="Accepted"
                  value={shareStats.accepted.toLocaleString()}
                  color="accent"
                />
                <ShareStatRow
                  icon={XCircle}
                  label="Rejected"
                  value={shareStats.rejected.toLocaleString()}
                  color="error"
                />
                <ShareStatRow
                  icon={Clock}
                  label="Stale"
                  value={shareStats.stale.toLocaleString()}
                  color="warning"
                />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Difficulty Chart */}
        <motion.div variants={itemVariants}>
          <Card variant="glass" padding="default" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple/5 rounded-full blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple to-purple/30 rounded-full" />
                  <h3 className="text-lg font-semibold">Network Difficulty</h3>
                </div>
              </div>

              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="difficultyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B6B7B', fontSize: 10 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6B6B7B', fontSize: 10 }}
                      tickFormatter={(value) => formatDifficulty(value)}
                    />
                    <Tooltip content={<DifficultyTooltip />} />
                    <Bar
                      dataKey="difficulty"
                      fill="url(#difficultyGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div variants={itemVariants}>
          <Card variant="glow-purple" padding="default" className="h-full relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-purple/10 via-transparent to-accent/5"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-accent to-accent/30 rounded-full" />
                <h3 className="text-lg font-semibold">Performance Metrics</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  label="Hash Efficiency"
                  value={`${performanceMetrics.efficiency}%`}
                  icon={Cpu}
                  progress={performanceMetrics.efficiency}
                  color="accent"
                />
                <MetricCard
                  label="System Uptime"
                  value={`${performanceMetrics.uptime}%`}
                  icon={Activity}
                  progress={performanceMetrics.uptime}
                  color="success"
                />
                <MetricCard
                  label="Blocks/Day"
                  value={(performanceMetrics.blocksFound / 30).toFixed(1)}
                  icon={Box}
                  color="purple"
                />
                <MetricCard
                  label="Total Earned"
                  value={`${performanceMetrics.totalEarnings.toFixed(4)}`}
                  icon={TrendingUp}
                  suffix="BTCD"
                  color="warning"
                />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Blocks Found Table */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="default" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/3 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-warning to-warning/30 rounded-full" />
                <h3 className="text-lg font-semibold">Blocks Found</h3>
              </div>
              <a
                href="/blocks"
                className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>

            {userBlocks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Height</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBlocks.map((block: any, index: number) => (
                    <motion.tr
                      key={block.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <TableCell className="font-mono text-accent">
                        #{block.height || block.blockHeight || '---'}
                      </TableCell>
                      <TableCell className="font-mono text-foreground-subtle">
                        {truncateAddress(block.hash || block.blockHash, 8, 6)}
                      </TableCell>
                      <TableCell className="font-data text-success">
                        {block.reward?.toFixed(4) || '6.25'} BTCD
                      </TableCell>
                      <TableCell className="text-foreground-muted">
                        {formatRelativeTime(block.createdAt || block.timestamp)}
                      </TableCell>
                      <TableCell>
                        <BlockStatus status={block.status || 'confirmed'} />
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Box className="w-12 h-12 text-foreground-muted/30 mx-auto mb-3" />
                <p className="text-foreground-muted">No blocks found yet</p>
                <p className="text-xs text-foreground-subtle mt-1">Keep mining to discover blocks</p>
              </motion.div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Detailed Reports Section */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="default" className="relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple/5 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-accent to-accent/30 rounded-full" />
                <h3 className="text-lg font-semibold">Detailed Reports</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ReportCard
                icon={FileText}
                title="Mining Summary"
                description="Complete mining activity overview"
                period={timeRange}
                color="accent"
                onClick={handleExportData}
              />
              <ReportCard
                icon={BarChart3}
                title="Performance Report"
                description="Efficiency and uptime metrics"
                period={timeRange}
                color="purple"
                onClick={handleExportData}
              />
              <ReportCard
                icon={Calendar}
                title="Earnings Report"
                description="Detailed earnings breakdown"
                period={timeRange}
                color="warning"
                onClick={handleExportData}
              />
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Helper Components

function MiniStatCard({
  icon: Icon,
  label,
  value,
  color,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'accent' | 'success' | 'warning' | 'purple';
  isLoading?: boolean;
}) {
  const colorClasses = {
    accent: 'text-accent bg-accent/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    purple: 'text-purple bg-purple/10',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-foreground-muted">{label}</p>
          {isLoading ? (
            <div className="h-5 w-16 bg-white/10 rounded animate-pulse mt-1" />
          ) : (
            <p className="font-data font-semibold text-white">{value}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ShareStatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'accent' | 'success' | 'warning' | 'error';
}) {
  const colorClasses = {
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        <span className="text-sm text-foreground-subtle">{label}</span>
      </div>
      <span className={`font-data font-medium ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  progress,
  suffix,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  progress?: number;
  suffix?: string;
  color: 'accent' | 'success' | 'warning' | 'purple';
}) {
  const colorClasses = {
    accent: { bg: 'bg-accent', text: 'text-accent' },
    success: { bg: 'bg-success', text: 'text-success' },
    warning: { bg: 'bg-warning', text: 'text-warning' },
    purple: { bg: 'bg-purple', text: 'text-purple' },
  };

  return (
    <div className="p-4 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color].text}`} />
        <span className="text-xs text-foreground-muted">{label}</span>
      </div>
      <p className="text-xl font-bold font-data text-white">
        {value}
        {suffix && <span className="text-sm text-foreground-muted ml-1">{suffix}</span>}
      </p>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${colorClasses[color].bg}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  );
}

function BlockStatus({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: 'bg-success/10', text: 'text-success', label: 'Confirmed' },
    pending: { bg: 'bg-warning/10', text: 'text-warning', label: 'Pending' },
    orphaned: { bg: 'bg-error/10', text: 'text-error', label: 'Orphaned' },
  };

  const config = statusConfig[status.toLowerCase()] || statusConfig.confirmed;

  return (
    <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  period,
  color,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  period: string;
  color: 'accent' | 'purple' | 'warning';
  onClick: () => void;
}) {
  const colorClasses = {
    accent: 'bg-accent/10 text-accent hover:bg-accent/20',
    purple: 'bg-purple/10 text-purple hover:bg-purple/20',
    warning: 'bg-warning/10 text-warning hover:bg-warning/20',
  };

  const borderColors = {
    accent: 'hover:border-accent/30',
    purple: 'hover:border-purple/30',
    warning: 'hover:border-warning/30',
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={`w-full p-4 rounded-lg bg-white/[0.02] border border-white/5 ${borderColors[color]} transition-all text-left group`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]} transition-colors`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white group-hover:text-accent transition-colors">{title}</p>
          <p className="text-xs text-foreground-muted mt-1">{description}</p>
          <p className="text-xs text-foreground-subtle mt-2">Period: {period.toUpperCase()}</p>
        </div>
        <Download className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors flex-shrink-0" />
      </div>
    </motion.button>
  );
}

// Custom Tooltips
function HashrateTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-tiny text-foreground-subtle mb-1">{label}</p>
      <p className="text-sm font-semibold text-accent font-data">
        {formatHashrate(payload[0].value as number)}
      </p>
    </div>
  );
}

function ShareTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold" style={{ color: data.payload.color }}>
        {data.name}: {(data.value as number).toLocaleString()}
      </p>
    </div>
  );
}

function DifficultyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-tiny text-foreground-subtle mb-1">{label}</p>
      <p className="text-sm font-semibold text-purple font-data">
        {formatDifficulty(payload[0].value as number)}
      </p>
    </div>
  );
}

// Utility Functions
function formatYAxis(value: number): string {
  if (value === 0) return '0';
  if (value >= 1e15) return `${(value / 1e15).toFixed(1)}PH`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}TH`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GH`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MH`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KH`;
  return `${value}H`;
}

function formatDifficulty(value: number): string {
  if (value >= 1e15) return `${(value / 1e15).toFixed(1)}P`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}G`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
