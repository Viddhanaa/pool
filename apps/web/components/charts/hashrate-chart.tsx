'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatHashrate } from '@/lib/utils';

interface HashrateChartProps {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  height?: number;
  showZoom?: boolean;
  className?: string;
}

interface DataPoint {
  timestamp: string;
  hashrate: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const date = new Date(label);

  return (
    <div className="bg-background-secondary border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-tiny text-foreground-subtle mb-1">
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </p>
      <p className="text-sm font-semibold text-accent font-data">
        {formatHashrate(data.value as number)}
      </p>
    </div>
  );
}

export function HashrateChart({
  timeRange = '24h',
  height = 300,
  className,
}: HashrateChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'hashrate', timeRange],
    queryFn: () => api.stats.hashrate({ range: timeRange }),
    refetchInterval: 60000, // Refetch every minute
  });

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((point: DataPoint) => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [data]);

  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1e15) return `${(value / 1e15).toFixed(1)}PH`;
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}TH`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}GH`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}MH`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}KH`;
    return `${value}H`;
  };

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-background-secondary/50 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="animate-pulse text-foreground-muted">
          Loading chart...
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div
        className={`flex items-center justify-center bg-background-secondary/50 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-foreground-muted">No data available</div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00FFFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B7B', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B7B', fontSize: 12 }}
            tickFormatter={formatYAxis}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="hashrate"
            stroke="#00FFFF"
            strokeWidth={2}
            fill="url(#hashrateGradient)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
