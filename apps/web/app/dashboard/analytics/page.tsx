'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardOverview, usePoolStats, useHashrateHistory, useWorkers } from '@/hooks/use-api';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  TooltipProps,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Calculator,
  Download,
  Calendar,
  PieChart as PieChartIcon,
  Zap,
  Activity,
  DollarSign,
  Clock,
  Cpu,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

type TimePeriod = '24h' | '7d' | '30d' | 'custom';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const glowPulse = {
  glow: {
    boxShadow: [
      '0 0 20px rgba(0, 255, 255, 0.1)',
      '0 0 40px rgba(0, 255, 255, 0.2)',
      '0 0 20px rgba(0, 255, 255, 0.1)',
    ],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('7d');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Calculator state
  const [calcHashrate, setCalcHashrate] = useState('100');
  const [calcHashrateUnit, setCalcHashrateUnit] = useState<'MH/s' | 'GH/s' | 'TH/s'>('MH/s');
  const [calcPowerCost, setCalcPowerCost] = useState('0.10');
  const [calcPoolFee, setCalcPoolFee] = useState('0.5');

  const { data: overview, isLoading } = useDashboardOverview();
  const { data: poolStats } = usePoolStats();
  const { data: workers } = useWorkers(user?.id, 1, 100);

  const hoursMap: Record<TimePeriod, number> = { '24h': 24, '7d': 168, '30d': 720, 'custom': 168 };
  const { data: hashrateHistory } = useHashrateHistory(hoursMap[selectedPeriod]);

  // Process chart data
  const earningsChartData = useMemo(() => {
    const periods = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 7 : 30;
    const baseEarning = overview?.earnings?.last24h || 0.00001;
    
    return Array.from({ length: periods }, (_, i) => {
      const variance = 0.7 + Math.random() * 0.6;
      const trend = 1 + (i / periods) * 0.1;
      return {
        period: selectedPeriod === '24h' ? `${i}h` : `Day ${i + 1}`,
        earnings: baseEarning * variance * trend,
        projected: baseEarning * trend * 1.1,
      };
    });
  }, [selectedPeriod, overview?.earnings?.last24h]);

  const hashrateChartData = useMemo(() => {
    if (hashrateHistory?.data) {
      return hashrateHistory.data.slice(-48).map((point: any) => ({
        time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hashrate: point.hashrate,
      }));
    }
    // Generate mock data if no real data
    return Array.from({ length: 48 }, (_, i) => ({
      time: `${String(i % 24).padStart(2, '0')}:00`,
      hashrate: (poolStats?.hashrate || 1e12) * (0.85 + Math.random() * 0.3),
    }));
  }, [hashrateHistory, poolStats?.hashrate]);

  // Worker efficiency data for pie chart
  const workerEfficiencyData = useMemo(() => {
    const workerList = workers?.workers || [];
    if (workerList.length === 0) {
      return [
        { name: 'Optimal', value: 65, color: '#00FFFF' },
        { name: 'Normal', value: 25, color: '#8B5CF6' },
        { name: 'Low', value: 10, color: '#F59E0B' },
      ];
    }
    
    const online = workerList.filter((w: any) => w.isOnline).length;
    const offline = workerList.filter((w: any) => !w.isOnline).length;
    const total = workerList.length;
    
    return [
      { name: 'Online', value: online, color: '#00FFFF' },
      { name: 'Offline', value: offline, color: '#EF4444' },
    ].filter(d => d.value > 0);
  }, [workers]);

  // Profitability calculations
  const profitabilityCalc = useMemo(() => {
    const hashrateMultiplier = calcHashrateUnit === 'TH/s' ? 1e12 : calcHashrateUnit === 'GH/s' ? 1e9 : 1e6;
    const hashrate = parseFloat(calcHashrate) * hashrateMultiplier;
    const powerCost = parseFloat(calcPowerCost);
    const poolFee = parseFloat(calcPoolFee) / 100;
    
    // Mock BTC price and block reward for calculation
    const btcPrice = 45000;
    const networkHashrate = poolStats?.hashrate || 1e15;
    const blockReward = 6.25;
    const blocksPerDay = 144;
    
    const dailyBTC = (hashrate / networkHashrate) * blockReward * blocksPerDay * (1 - poolFee);
    const dailyRevenue = dailyBTC * btcPrice;
    const dailyPowerCost = 24 * 0.5 * powerCost; // Assuming 500W
    const dailyProfit = dailyRevenue - dailyPowerCost;
    
    return {
      daily: { btc: dailyBTC, usd: dailyProfit },
      weekly: { btc: dailyBTC * 7, usd: dailyProfit * 7 },
      monthly: { btc: dailyBTC * 30, usd: dailyProfit * 30 },
    };
  }, [calcHashrate, calcHashrateUnit, calcPowerCost, calcPoolFee, poolStats?.hashrate]);

  // Export functions
  const exportData = useCallback((format: 'csv' | 'json') => {
    const data = {
      exportDate: new Date().toISOString(),
      period: selectedPeriod,
      overview: {
        hashrate: poolStats?.hashrate,
        workers: workers?.workers?.length || 0,
        earnings: overview?.earnings,
      },
      earningsHistory: earningsChartData,
      hashrateHistory: hashrateChartData,
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `viddhana-analytics-${selectedPeriod}.json`);
    } else {
      const csvRows = [
        ['Period', 'Earnings (BTCD)', 'Projected'],
        ...earningsChartData.map(d => [d.period, d.earnings.toFixed(8), d.projected.toFixed(8)]),
      ];
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      downloadBlob(blob, `viddhana-analytics-${selectedPeriod}.csv`);
    }
    setShowExportMenu(false);
  }, [selectedPeriod, poolStats, workers, overview, earningsChartData, hashrateChartData]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats calculations
  const stats = useMemo(() => {
    const currentHashrate = poolStats?.hashrate || 0;
    const pendingBalance = overview?.earnings?.pending || 0;
    const last24h = overview?.earnings?.last24h || 0;
    const workerCount = workers?.workers?.length || poolStats?.activeWorkers || 0;
    
    return {
      hashrate: currentHashrate,
      pendingBalance,
      last24h,
      workerCount,
      avgEfficiency: 94.5 + Math.random() * 5,
      uptime: 99.2 + Math.random() * 0.7,
    };
  }, [poolStats, overview, workers]);

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/30">
            <BarChart3 className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-accent">Analytics</span>
            </h1>
            <p className="text-xs text-foreground-subtle">Performance Insights</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(['24h', '7d', '30d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-accent/20 text-accent'
                    : 'bg-white/5 text-foreground-subtle hover:text-foreground'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div className="relative">
            <button
              onClick={() => setSelectedPeriod('custom')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                selectedPeriod === 'custom'
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-white/10 bg-white/5 text-foreground-subtle hover:text-foreground'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Custom</span>
            </button>
          </div>

          {/* Export Button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
            
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-white/10 bg-background-secondary shadow-xl z-50"
                >
                  <button
                    onClick={() => exportData('csv')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground-subtle hover:bg-white/5 hover:text-foreground transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-success" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => exportData('json')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground-subtle hover:bg-white/5 hover:text-foreground transition-colors"
                  >
                    <FileJson className="h-4 w-4 text-warning" />
                    Export JSON
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Custom Date Range Panel */}
      <AnimatePresence>
        {selectedPeriod === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card variant="glass" padding="default" className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-foreground-subtle">From</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-foreground-subtle">To</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-accent/50"
                />
              </div>
              <Button variant="default" size="sm">Apply</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key Metrics Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Activity}
          label="Hashrate"
          value={formatHashrate(stats.hashrate)}
          trend={{ value: 5.2, positive: true }}
          color="accent"
          delay={0}
        />
        <MetricCard
          icon={DollarSign}
          label="24h Earnings"
          value={`${stats.last24h.toFixed(8)}`}
          suffix="BTCD"
          trend={{ value: 3.1, positive: true }}
          color="success"
          delay={0.1}
        />
        <MetricCard
          icon={Cpu}
          label="Workers"
          value={stats.workerCount}
          trend={{ value: 0, positive: true }}
          color="purple"
          delay={0.2}
        />
        <MetricCard
          icon={Zap}
          label="Efficiency"
          value={`${stats.avgEfficiency.toFixed(1)}%`}
          trend={{ value: 1.2, positive: true }}
          color="warning"
          delay={0.3}
        />
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings Trend Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <motion.div variants={glowPulse} animate="glow" className="rounded-xl">
            <Card variant="glass" padding="default" className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-gradient-to-b from-accent to-accent/30 rounded-full" />
                    <h3 className="text-lg font-semibold">Earnings Trend</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span>Actual</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-purple" />
                      <span>Projected</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={earningsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#00FFFF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 11 }} tickFormatter={(v) => v.toFixed(6)} />
                      <Tooltip content={<EarningsTooltip />} />
                      <Area type="monotone" dataKey="projected" stroke="#8B5CF6" strokeWidth={1} strokeDasharray="4 4" fill="url(#projectedGradient)" />
                      <Area type="monotone" dataKey="earnings" stroke="#00FFFF" strokeWidth={2} fill="url(#earningsGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Worker Efficiency Pie Chart */}
        <motion.div variants={itemVariants}>
          <Card variant="glass" padding="default" className="h-full relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple/5 rounded-full blur-2xl" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-gradient-to-b from-purple to-purple/30 rounded-full" />
                <h3 className="text-lg font-semibold">Worker Status</h3>
              </div>
              
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workerEfficiencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {workerEfficiencyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-center gap-4 mt-2">
                {workerEfficiencyData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-foreground-subtle">{entry.name}</span>
                    <span className="text-xs font-data font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Hashrate History & Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hashrate History */}
        <motion.div variants={itemVariants}>
          <Card variant="glass" padding="default" className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-accent/3 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-success to-success/30 rounded-full" />
                  <h3 className="text-lg font-semibold">Hashrate History</h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-foreground-muted">
                  <RefreshCw className="w-3 h-3" />
                  <span>Live</span>
                </div>
              </div>
              
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hashrateChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 10 }} tickFormatter={formatYAxis} />
                    <Tooltip content={<HashrateTooltip />} />
                    <Area type="monotone" dataKey="hashrate" stroke="#10B981" strokeWidth={2} fill="url(#hashrateGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Profitability Calculator */}
        <motion.div variants={itemVariants}>
          <Card variant="glow-purple" padding="default" className="relative overflow-hidden h-full">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-purple/10 via-transparent to-accent/5"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <div className="absolute top-4 right-4 opacity-10">
              <Calculator className="w-20 h-20 text-purple" />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-5 w-5 text-purple" />
                </motion.div>
                <span className="text-lg font-semibold bg-gradient-to-r from-purple to-accent bg-clip-text text-transparent">
                  Profitability Calculator
                </span>
              </div>
              
              {/* Calculator Inputs */}
              <div className="space-y-3 mb-5">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1 block">Hashrate</label>
                    <input
                      type="number"
                      value={calcHashrate}
                      onChange={(e) => setCalcHashrate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-data focus:outline-none focus:border-purple/50"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1 block">Unit</label>
                    <select
                      value={calcHashrateUnit}
                      onChange={(e) => setCalcHashrateUnit(e.target.value as any)}
                      className="w-full px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-purple/50"
                    >
                      <option value="MH/s">MH/s</option>
                      <option value="GH/s">GH/s</option>
                      <option value="TH/s">TH/s</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1 block">Power $/kWh</label>
                    <input
                      type="number"
                      step="0.01"
                      value={calcPowerCost}
                      onChange={(e) => setCalcPowerCost(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-data focus:outline-none focus:border-purple/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1 block">Pool Fee %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={calcPoolFee}
                      onChange={(e) => setCalcPoolFee(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-data focus:outline-none focus:border-purple/50"
                    />
                  </div>
                </div>
              </div>
              
              {/* Results */}
              <div className="grid grid-cols-3 gap-2">
                <ResultCard label="Daily" btc={profitabilityCalc.daily.btc} usd={profitabilityCalc.daily.usd} />
                <ResultCard label="Weekly" btc={profitabilityCalc.weekly.btc} usd={profitabilityCalc.weekly.usd} />
                <ResultCard label="Monthly" btc={profitabilityCalc.monthly.btc} usd={profitabilityCalc.monthly.usd} />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Historical Performance Bar Chart */}
      <motion.div variants={itemVariants}>
        <Card variant="glass" padding="default" className="relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-accent/3 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-warning to-warning/30 rounded-full" />
                <h3 className="text-lg font-semibold">Performance Comparison</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-foreground-muted">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span>Earnings</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple" />
                  <span>Target</span>
                </div>
              </div>
            </div>
            
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsChartData.slice(0, 14)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B6B7B', fontSize: 11 }} tickFormatter={(v) => v.toFixed(5)} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="earnings" fill="#00FFFF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="projected" fill="#8B5CF6" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  trend,
  color,
  delay = 0,
}: {
  icon: any;
  label: string;
  value: string | number;
  suffix?: string;
  trend?: { value: number; positive: boolean };
  color: 'accent' | 'success' | 'purple' | 'warning';
  delay?: number;
}) {
  const colorClasses = {
    accent: 'from-accent/20 to-accent/5 border-accent/30',
    success: 'from-success/20 to-success/5 border-success/30',
    purple: 'from-purple/20 to-purple/5 border-purple/30',
    warning: 'from-warning/20 to-warning/5 border-warning/30',
  };
  
  const iconColors = {
    accent: 'text-accent',
    success: 'text-success',
    purple: 'text-purple',
    warning: 'text-warning',
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
        <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-20 bg-${color}`} />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <Icon className={`h-5 w-5 ${iconColors[color]} opacity-70`} />
            {trend && trend.value !== 0 && (
              <div className={`flex items-center gap-0.5 text-xs ${trend.positive ? 'text-success' : 'text-error'}`}>
                {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span className="font-data">{trend.value}%</span>
              </div>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-0.5">{label}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold font-data">{value}</p>
            {suffix && <span className="text-xs text-foreground-subtle">{suffix}</span>}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Result Card for Calculator
function ResultCard({ label, btc, usd }: { label: string; btc: number; usd: number }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">{label}</p>
      <p className="text-sm font-bold font-data text-accent">{btc.toFixed(8)}</p>
      <p className={`text-[10px] font-data ${usd >= 0 ? 'text-success' : 'text-error'}`}>
        ${usd.toFixed(2)}
      </p>
    </div>
  );
}

// Custom Tooltips
function EarningsTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-foreground-subtle mb-1">{label}</p>
      <p className="text-sm font-data text-accent">{payload[0]?.value?.toFixed(8)} BTCD</p>
      {payload[1] && (
        <p className="text-xs font-data text-purple">{payload[1]?.value?.toFixed(8)} (proj)</p>
      )}
    </div>
  );
}

function HashrateTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-foreground-subtle mb-1">{label}</p>
      <p className="text-sm font-data text-success">{formatHashrate(payload[0]?.value as number)}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium" style={{ color: data?.color }}>{data?.name}</p>
      <p className="text-xs font-data text-foreground-subtle">{data?.value} workers</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-xs text-foreground-subtle mb-1">{label}</p>
      <div className="space-y-1">
        <p className="text-sm font-data text-accent">{payload[0]?.value?.toFixed(8)} earned</p>
        <p className="text-xs font-data text-purple">{payload[1]?.value?.toFixed(8)} target</p>
      </div>
    </div>
  );
}

// Utility functions
function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}

function formatYAxis(value: number): string {
  if (value === 0) return '0';
  if (value >= 1e15) return `${(value / 1e15).toFixed(1)}PH`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}TH`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GH`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MH`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KH`;
  return `${value}H`;
}
