'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePayouts, useUserBalance } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import {
  Download,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Filter,
  Coins,
} from 'lucide-react';

type PayoutStatus = 'completed' | 'pending' | 'failed';

interface Payout {
  id: string;
  amount: number;
  txHash: string;
  status: PayoutStatus;
  createdAt: string;
  confirmedAt?: string;
}

interface PayoutSettings {
  minPayout: number;
  walletAddress: string;
}

export default function PayoutsPage() {
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [settings, setSettings] = useState<PayoutSettings>({
    minPayout: 0.01,
    walletAddress: user?.walletAddress || '',
  });

  const { data, isLoading } = usePayouts(user?.id, page, 20);
  const { data: balanceData } = useUserBalance(user?.id);

  const payouts: Payout[] = data?.payouts || [];
  const totalPages = data?.totalPages || 1;
  const totalItems = data?.total || 0;

  // Filter payouts by date range
  const filteredPayouts = useMemo(() => {
    if (!dateFilter.start && !dateFilter.end) return payouts;

    return payouts.filter((payout) => {
      const date = new Date(payout.createdAt);
      const start = dateFilter.start ? new Date(dateFilter.start) : null;
      const end = dateFilter.end ? new Date(dateFilter.end) : null;

      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  }, [payouts, dateFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = payouts.filter((p) => p.status === 'completed');
    const pending = payouts.filter((p) => p.status === 'pending');
    const totalPaid = completed.reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);
    const lastPayout = completed.length > 0 ? completed[0] : null;

    return {
      totalPaid: balanceData?.totalPaid || totalPaid,
      pendingAmount: balanceData?.pending || pendingAmount,
      lastPayout,
      minThreshold: balanceData?.minPayout || 0.01,
      balance: balanceData?.balance || 0,
    };
  }, [payouts, balanceData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Amount (BTCD)', 'TX Hash', 'Status'];
    const rows = filteredPayouts.map((p) => [
      new Date(p.createdAt).toISOString(),
      p.amount.toFixed(8),
      p.txHash,
      p.status,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viddhana-payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setDateFilter({ start: '', end: '' });
  };

  const hasFilters = dateFilter.start || dateFilter.end;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-purple/20 border border-accent/30">
            <Wallet className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-accent">Payouts</span>
            </h1>
            <p className="text-xs text-foreground-subtle">Transaction History</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircle}
          label="Total Paid"
          value={`${stats.totalPaid.toFixed(4)}`}
          suffix="BTCD"
          color="success"
          delay={0}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={`${stats.pendingAmount.toFixed(4)}`}
          suffix="BTCD"
          color="warning"
          delay={0.1}
          pulse
        />
        <StatCard
          icon={TrendingUp}
          label="Last Payout"
          value={stats.lastPayout ? formatAmount(stats.lastPayout.amount) : '-'}
          suffix={stats.lastPayout ? 'BTCD' : ''}
          subValue={stats.lastPayout ? formatRelativeTime(stats.lastPayout.createdAt) : 'No payouts yet'}
          color="accent"
          delay={0.2}
        />
        <StatCard
          icon={Coins}
          label="Min Threshold"
          value={`${stats.minThreshold}`}
          suffix="BTCD"
          color="purple"
          delay={0.3}
        />
      </div>

      {/* Current Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card variant="glow" className="p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple/30 rounded-full blur-3xl" />
          </div>

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-foreground-subtle uppercase tracking-wider mb-1">
                Current Balance
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-data text-accent">
                  {stats.balance.toFixed(8)}
                </span>
                <span className="text-lg text-foreground-subtle">BTCD</span>
              </div>
              {stats.balance < stats.minThreshold && (
                <p className="text-xs text-foreground-subtle mt-2">
                  {(stats.minThreshold - stats.balance).toFixed(8)} BTCD until next payout
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.balance / stats.minThreshold) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-accent to-purple rounded-full"
                />
              </div>
              <p className="text-xs text-foreground-subtle">
                {Math.min((stats.balance / stats.minThreshold) * 100, 100).toFixed(1)}% of minimum
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card variant="glass" className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-foreground-subtle" />
              <span className="text-sm text-foreground-subtle">Filter by date</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-foreground-subtle">From</label>
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter((f) => ({ ...f, start: e.target.value }))}
                  className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-foreground-subtle">To</label>
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter((f) => ({ ...f, end: e.target.value }))}
                  className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Pending Payments Section */}
      {stats.pendingAmount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card variant="glass" className="p-4 border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-warning animate-pulse" />
              <span className="text-sm font-medium text-warning">Pending Payments</span>
            </div>
            <div className="space-y-2">
              {payouts
                .filter((p) => p.status === 'pending')
                .slice(0, 3)
                .map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/10"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <span className="font-mono text-sm font-medium">
                        {payout.amount.toFixed(8)} BTCD
                      </span>
                    </div>
                    <span className="text-xs text-foreground-subtle">
                      {formatRelativeTime(payout.createdAt)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Payout History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card variant="glass" className="overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-medium">Transaction History</h3>
            <span className="text-xs text-foreground-subtle">
              {totalItems} total transactions
            </span>
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredPayouts.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/5 bg-white/2">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
                        TX Hash
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredPayouts.map((payout, index) => (
                        <PayoutRow
                          key={payout.id}
                          payout={payout}
                          index={index}
                          copiedHash={copiedHash}
                          onCopy={copyToClipboard}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
                  <div className="text-sm text-foreground-subtle">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
          )}
        </Card>
      </motion.div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={(newSettings) => {
              setSettings(newSettings);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  subValue,
  color,
  delay = 0,
  pulse = false,
}: {
  icon: any;
  label: string;
  value: string;
  suffix?: string;
  subValue?: string;
  color: 'accent' | 'success' | 'warning' | 'purple';
  delay?: number;
  pulse?: boolean;
}) {
  const colorClasses = {
    accent: 'from-accent/20 to-accent/5 border-accent/30 text-accent',
    success: 'from-success/20 to-success/5 border-success/30 text-success',
    warning: 'from-warning/20 to-warning/5 border-warning/30 text-warning',
    purple: 'from-purple/20 to-purple/5 border-purple/30 text-purple',
  };

  const iconColors = {
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    purple: 'text-purple',
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
        <div
          className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 ${
            color === 'accent'
              ? 'bg-accent'
              : color === 'success'
              ? 'bg-success'
              : color === 'warning'
              ? 'bg-warning'
              : 'bg-purple'
          }`}
        />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold font-data">{value}</p>
              {suffix && <span className="text-xs text-foreground-subtle">{suffix}</span>}
            </div>
            {subValue && <p className="text-[10px] text-foreground-subtle mt-0.5">{subValue}</p>}
          </div>
          <div className={`relative ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className={`h-6 w-6 opacity-60 ${iconColors[color]}`} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Payout Row Component
function PayoutRow({
  payout,
  index,
  copiedHash,
  onCopy,
}: {
  payout: Payout;
  index: number;
  copiedHash: string | null;
  onCopy: (hash: string) => void;
}) {
  const statusConfig = {
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
      label: 'Completed',
    },
    pending: {
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      label: 'Pending',
    },
    failed: {
      icon: XCircle,
      color: 'text-error',
      bg: 'bg-error/10',
      border: 'border-error/20',
      label: 'Failed',
    },
  };

  const config = statusConfig[payout.status];
  const StatusIcon = config.icon;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="py-4 px-4">
        <div>
          <p className="text-sm font-data">{formatDate(payout.createdAt)}</p>
          <p className="text-xs text-foreground-subtle">{formatTime(payout.createdAt)}</p>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="font-mono text-sm font-medium text-accent">
          {payout.amount.toFixed(8)} BTCD
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground-subtle truncate max-w-[120px] md:max-w-[200px]">
            {payout.txHash}
          </span>
          <button
            onClick={() => onCopy(payout.txHash)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Copy TX Hash"
          >
            {copiedHash === payout.txHash ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3 text-foreground-subtle" />
            )}
          </button>
          <a
            href={`https://scan.viddhana.com/tx/${payout.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="View on Explorer"
          >
            <ExternalLink className="h-3 w-3 text-foreground-subtle hover:text-accent transition-colors" />
          </a>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color} ${config.border} border`}
          >
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
      </td>
    </motion.tr>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-4">
          <div className="h-10 w-32 bg-white/5 rounded" />
          <div className="h-10 w-24 bg-white/5 rounded" />
          <div className="h-10 flex-1 bg-white/5 rounded" />
          <div className="h-8 w-24 bg-white/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Empty State
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
        <Wallet className="h-8 w-8 text-foreground-subtle opacity-50" />
      </div>
      <p className="text-foreground-subtle mb-4">
        {hasFilters ? 'No payouts match your filters' : 'No payout history yet'}
      </p>
      {hasFilters && (
        <Button variant="outline" onClick={onClear}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Settings Modal Component
function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: PayoutSettings;
  onSave: (settings: PayoutSettings) => void;
  onClose: () => void;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    onSave(localSettings);
    setIsSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg z-50"
      >
        <Card variant="glow" className="p-6 relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-accent/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple/30 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
                  <Settings className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Payout Settings</h3>
                  <p className="text-xs text-foreground-subtle">Configure your preferences</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-foreground-subtle" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5">
              {/* Min Payout */}
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Payout</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={localSettings.minPayout}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, minPayout: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full h-11 px-4 pr-16 rounded-lg bg-white/5 border border-white/10 text-foreground font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-foreground-subtle">
                    BTCD
                  </span>
                </div>
                <p className="text-xs text-foreground-subtle mt-1.5">
                  Minimum: 0.001 BTCD
                </p>
              </div>

              {/* Wallet Address */}
              <div>
                <label className="block text-sm font-medium mb-2">Payout Wallet Address</label>
                <input
                  type="text"
                  value={localSettings.walletAddress}
                  onChange={(e) =>
                    setLocalSettings((s) => ({ ...s, walletAddress: e.target.value }))
                  }
                  placeholder="Enter your BTCD wallet address"
                  className="w-full h-11 px-4 rounded-lg bg-white/5 border border-white/10 text-foreground font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
                <p className="text-xs text-foreground-subtle mt-1.5">
                  Payments will be sent to this address
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/10">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-accent mt-0.5" />
                  <div className="text-xs text-foreground-subtle">
                    <p className="text-accent font-medium mb-1">Important</p>
                    <p>
                      Payouts are processed automatically when your balance reaches the minimum
                      threshold. Make sure your wallet address is correct.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="glow" onClick={handleSave} isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </>
  );
}

// Utility Functions
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function formatAmount(amount: number): string {
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(8);
}
