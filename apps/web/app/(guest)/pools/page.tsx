'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import {
  Zap,
  Activity,
  Cpu,
  Clock,
  Layers,
  Globe,
  Server,
  Shield,
  Gauge,
  Coins,
  Timer,
  Wallet,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatHashrate } from '@/lib/utils';
import { usePoolStats } from '@/hooks/use-api';
import { useState } from 'react';

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

const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(0,255,255,0.1)',
      '0 0 40px rgba(0,255,255,0.2)',
      '0 0 20px rgba(0,255,255,0.1)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export default function PoolsPage() {
  const { data: poolStats, isLoading } = usePoolStats();
  const [copied, setCopied] = useState(false);

  const stats = {
    hashrate: poolStats?.hashrate || 0,
    networkHashrate: poolStats?.networkHashrate || 0,
    activeMiners: poolStats?.activeMiners || 0,
    activeWorkers: poolStats?.activeWorkers || 0,
    difficulty: poolStats?.difficulty || 0,
    blocksFound: poolStats?.blocksFound || 0,
    latestBlockNumber: poolStats?.latestBlockNumber || 0,
    poolFee: poolStats?.poolFee || 1,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const poolFeatures = [
    { icon: Shield, label: 'DDoS Protected', color: 'text-cyan-400' },
    { icon: Gauge, label: 'Low Latency', color: 'text-purple-400' },
    { icon: Sparkles, label: 'PPLNS Rewards', color: 'text-cyan-400' },
    { icon: TrendingUp, label: '99.9% Uptime', color: 'text-purple-400' },
    { icon: Users, label: '24/7 Support', color: 'text-cyan-400' },
    { icon: Wallet, label: 'Auto Payouts', color: 'text-purple-400' },
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 text-sm font-medium">LIVE</span>
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Pools & Stats
              </span>
            </h1>
            <p className="text-foreground-subtle max-w-xl mx-auto">
              Real-time mining statistics and pool information
            </p>
          </motion.div>

          {/* Pool Info Card */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-12"
          >
            <motion.div variants={itemVariants}>
              <Card
                variant="glass"
                className="relative overflow-hidden border-cyan-500/20"
              >
                <motion.div {...glowPulse} className="p-8">
                  {/* Pool Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30">
                          <Cpu className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Viddhana Pool</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-foreground-subtle">Ethash</span>
                          <span className="text-foreground-subtle">•</span>
                          <span className="text-sm text-cyan-400 font-medium">BTCD</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-xs text-foreground-subtle block">Fee</span>
                        <span className="text-lg font-bold text-cyan-400">{stats.poolFee}%</span>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <span className="text-xs text-foreground-subtle block">Min Payout</span>
                        <span className="text-lg font-bold text-purple-400">0.1 BTCD</span>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-xs text-foreground-subtle block">Payout</span>
                        <span className="text-lg font-bold text-cyan-400">Every 2h</span>
                      </div>
                    </div>
                  </div>

                  {/* Pool Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <InfoItem icon={Coins} label="Coin" value="BTCD" />
                    <InfoItem icon={Cpu} label="Algorithm" value="Ethash" />
                    <InfoItem icon={Timer} label="Frequency" value="2 Hours" />
                  </div>
                </motion.div>
              </Card>
            </motion.div>
          </motion.div>

          {/* Network Stats Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-12"
          >
            <NetworkStatCard
              icon={Zap}
              label="Pool Hashrate"
              value={formatHashrate(stats.hashrate)}
              color="cyan"
              isLoading={isLoading}
            />
            <NetworkStatCard
              icon={Activity}
              label="Network Hashrate"
              value={formatHashrate(stats.networkHashrate)}
              color="purple"
              isLoading={isLoading}
            />
            <NetworkStatCard
              icon={Gauge}
              label="Difficulty"
              value={stats.difficulty.toLocaleString()}
              color="cyan"
              isLoading={isLoading}
            />
            <NetworkStatCard
              icon={Clock}
              label="Block Time"
              value="~10s"
              color="purple"
              isLoading={isLoading}
            />
            <NetworkStatCard
              icon={Layers}
              label="Current Block"
              value={stats.latestBlockNumber.toLocaleString()}
              color="cyan"
              isLoading={isLoading}
            />
          </motion.div>

          {/* Connection Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <Card variant="glass" className="border-purple-500/20 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Server className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold">Connection</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-foreground-subtle uppercase tracking-wider mb-2 block">
                        Stratum URL
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-4 py-3 rounded-lg bg-background/50 border border-white/10 text-cyan-400 font-mono text-sm">
                          stratum.viddhana.com:3333
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard('stratum+tcp://stratum.viddhana.com:3333')}
                          className="shrink-0"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-foreground-subtle uppercase tracking-wider mb-2 block">
                        Region
                      </label>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-background/50 border border-white/10">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="text-foreground">Global</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-foreground-subtle uppercase tracking-wider mb-2 block">
                        Username
                      </label>
                      <code className="block px-4 py-3 rounded-lg bg-background/50 border border-white/10 text-foreground-subtle font-mono text-sm">
                        YOUR_WALLET.WORKER_NAME
                      </code>
                    </div>
                    <div>
                      <label className="text-xs text-foreground-subtle uppercase tracking-wider mb-2 block">
                        Password
                      </label>
                      <code className="block px-4 py-3 rounded-lg bg-background/50 border border-white/10 text-foreground-subtle font-mono text-sm">
                        x
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Pool Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">Pool Features</h3>
              <p className="text-foreground-subtle text-sm">Enterprise-grade mining infrastructure</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {poolFeatures.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                >
                  <Card
                    variant="glass"
                    hover="glow"
                    className="p-4 text-center border-white/5 hover:border-cyan-500/30 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-3">
                      <feature.icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <span className="text-xs font-medium text-foreground-subtle">
                      {feature.label}
                    </span>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}

interface NetworkStatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'cyan' | 'purple';
  isLoading?: boolean;
}

function NetworkStatCard({ icon: Icon, label, value, color, isLoading }: NetworkStatCardProps) {
  const colorClasses = {
    cyan: {
      bg: 'from-cyan-500/10 to-cyan-500/5',
      border: 'border-cyan-500/20 hover:border-cyan-500/40',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/10',
    },
    purple: {
      bg: 'from-purple-500/10 to-purple-500/5',
      border: 'border-purple-500/20 hover:border-purple-500/40',
      text: 'text-purple-400',
      glow: 'shadow-purple-500/10',
    },
  };

  const colors = colorClasses[color];

  return (
    <motion.div variants={itemVariants}>
      <Card
        variant="glass"
        className={`relative overflow-hidden ${colors.border} transition-all duration-300 hover:shadow-lg ${colors.glow}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-50`} />
        <div className="relative p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg bg-background/50 ${colors.text}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-foreground-subtle uppercase tracking-wider mb-1">
            {label}
          </p>
          {isLoading ? (
            <div className="h-7 w-20 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className={`text-xl font-bold font-data ${colors.text}`}>{value}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
      <Icon className="w-4 h-4 text-cyan-400" />
      <div>
        <span className="text-xs text-foreground-subtle block">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}
