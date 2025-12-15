'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useHashrateHistory } from '@/hooks/use-api';
import { formatHashrate } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface DataPoint {
  timestamp: string;
  hashrate: number;
}

export function HashrateChart() {
  const { data, isLoading } = useHashrateHistory(24);
  const history: DataPoint[] = data?.history || [];

  const { chartData, maxHashrate, minHashrate, avgHashrate, trend } = useMemo(() => {
    if (history.length === 0) {
      return { chartData: [], maxHashrate: 0, minHashrate: 0, avgHashrate: 0, trend: 0 };
    }

    const max = Math.max(...history.map(h => h.hashrate));
    const min = Math.min(...history.map(h => h.hashrate));
    const avg = history.reduce((sum, h) => sum + h.hashrate, 0) / history.length;
    
    // Calculate trend (compare last quarter to first quarter)
    const quarterLength = Math.floor(history.length / 4);
    const firstQuarterAvg = history.slice(0, quarterLength).reduce((s, h) => s + h.hashrate, 0) / quarterLength || 0;
    const lastQuarterAvg = history.slice(-quarterLength).reduce((s, h) => s + h.hashrate, 0) / quarterLength || 0;
    const trendPercent = firstQuarterAvg > 0 ? ((lastQuarterAvg - firstQuarterAvg) / firstQuarterAvg) * 100 : 0;

    // Normalize data for chart
    const range = max - min || 1;
    const normalized = history.map(h => ({
      ...h,
      normalized: ((h.hashrate - min) / range) * 100,
    }));

    return {
      chartData: normalized,
      maxHashrate: max,
      minHashrate: min,
      avgHashrate: avg,
      trend: trendPercent,
    };
  }, [history]);

  // Generate SVG path for the chart
  const pathData = useMemo(() => {
    if (chartData.length < 2) return '';
    
    const width = 100;
    const height = 100;
    const padding = 5;
    const effectiveHeight = height - padding * 2;
    
    const points = chartData.map((point, i) => {
      const x = (i / (chartData.length - 1)) * width;
      const y = height - padding - (point.normalized / 100) * effectiveHeight;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [chartData]);

  // Generate area fill path
  const areaPath = useMemo(() => {
    if (!pathData) return '';
    return `${pathData} L100,100 L0,100 Z`;
  }, [pathData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card variant="glass" className="p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/20">
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">24h Hashrate</h3>
              <p className="text-xs text-foreground-muted">Pool performance</p>
            </div>
          </div>
          
          {/* Trend indicator */}
          {!isLoading && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="relative h-40 mb-4">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : chartData.length > 1 ? (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(0, 255, 255)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(0, 255, 255)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                  <stop offset="50%" stopColor="rgb(0, 255, 255)" />
                  <stop offset="100%" stopColor="rgb(139, 92, 246)" />
                </linearGradient>
              </defs>
              
              {/* Horizontal grid lines */}
              {[25, 50, 75].map(y => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="0.5"
                />
              ))}

              {/* Area fill */}
              <motion.path
                d={areaPath}
                fill="url(#chartGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              />

              {/* Line */}
              <motion.path
                d={pathData}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />

              {/* Glow effect */}
              <motion.path
                d={pathData}
                fill="none"
                stroke="rgb(0, 255, 255)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.2"
                filter="blur(4px)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-foreground-muted">
              <p>No data available</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-foreground-muted mb-1">Current</p>
            <p className="font-data text-sm font-semibold text-accent">
              {formatHashrate(chartData[chartData.length - 1]?.hashrate || 0)}
            </p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="text-xs text-foreground-muted mb-1">Average</p>
            <p className="font-data text-sm font-semibold text-foreground">
              {formatHashrate(avgHashrate)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-foreground-muted mb-1">Peak</p>
            <p className="font-data text-sm font-semibold text-purple">
              {formatHashrate(maxHashrate)}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
