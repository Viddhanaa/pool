# VIDDHANA POOL - Frontend Implementation Guide

> **Document ID:** 02-FRONTEND  
> **Priority:** P0 - Critical  
> **Dependencies:** 01-INFRASTRUCTURE (API endpoints), 06-API-SPECIFICATION

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Design System](#4-design-system)
5. [Guest Zone Pages](#5-guest-zone-pages)
6. [User Zone Pages](#6-user-zone-pages)
7. [Components Library](#7-components-library)
8. [State Management](#8-state-management)
9. [Real-time Integration](#9-real-time-integration)
10. [3D Visualizations](#10-3d-visualizations)

---

## 1. Overview

The frontend delivers a **futuristic, data-heavy** mining pool interface with:
- Minimal text, maximum visualization
- Dark mode default with neon accents (Cyan #00FFFF / Purple #8B5CF6)
- Real-time WebSocket updates for live data
- WebGL-powered 3D visualizations
- Mobile-first responsive design

---

## 2. Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework (App Router) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.4.x | Utility-first styling |
| Framer Motion | 10.x | Animations |
| Three.js / React Three Fiber | Latest | 3D WebGL visualizations |
| Socket.io Client | 4.x | Real-time WebSocket |
| TanStack Query | 5.x | Server state management |
| Zustand | 4.x | Client state management |
| Recharts | 2.x | Data visualization charts |
| Radix UI | Latest | Accessible primitives |

---

## 3. Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (guest)/                  # Guest zone (public)
│   │   ├── page.tsx              # Home page
│   │   ├── pools/
│   │   │   └── page.tsx          # Pools & Statistics
│   │   ├── leaderboard/
│   │   │   └── page.tsx          # Leaderboard
│   │   ├── blocks/
│   │   │   └── page.tsx          # Block Explorer
│   │   └── support/
│   │       └── page.tsx          # Support & Guides
│   ├── (auth)/                   # Auth pages
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── dashboard/                # User zone (protected)
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── page.tsx              # Main dashboard
│   │   ├── workers/
│   │   │   └── page.tsx          # Workers management
│   │   ├── stats/
│   │   │   └── page.tsx          # Mining statistics
│   │   ├── payouts/
│   │   │   └── page.tsx          # Payouts & Finance
│   │   ├── licenses/
│   │   │   └── page.tsx          # License management
│   │   ├── settings/
│   │   │   └── page.tsx          # Settings
│   │   └── support/
│   │       └── page.tsx          # Support tickets
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── providers.tsx             # Context providers
├── components/
│   ├── ui/                       # Base UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── tooltip.tsx
│   │   └── ...
│   ├── charts/                   # Chart components
│   │   ├── hashrate-chart.tsx
│   │   ├── earnings-chart.tsx
│   │   ├── share-pie-chart.tsx
│   │   └── block-history-bar.tsx
│   ├── 3d/                       # WebGL/Three.js
│   │   ├── globe.tsx
│   │   ├── network-mesh.tsx
│   │   └── particle-field.tsx
│   ├── dashboard/                # Dashboard-specific
│   │   ├── hud-display.tsx
│   │   ├── worker-card.tsx
│   │   ├── stats-ticker.tsx
│   │   └── payout-table.tsx
│   ├── layout/                   # Layout components
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── footer.tsx
│   │   └── mobile-nav.tsx
│   └── shared/                   # Shared components
│       ├── wallet-connect.tsx
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       └── seo.tsx
├── hooks/                        # Custom hooks
│   ├── use-socket.ts
│   ├── use-hashrate.ts
│   ├── use-workers.ts
│   └── use-auth.ts
├── lib/                          # Utilities
│   ├── api.ts                    # API client
│   ├── socket.ts                 # Socket.io client
│   ├── utils.ts                  # Helper functions
│   ├── formatters.ts             # Number/date formatting
│   └── constants.ts              # App constants
├── stores/                       # Zustand stores
│   ├── auth-store.ts
│   ├── ui-store.ts
│   └── realtime-store.ts
├── types/                        # TypeScript types
│   ├── api.ts
│   ├── worker.ts
│   └── user.ts
├── public/
│   ├── fonts/
│   └── images/
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## 4. Design System

### 4.1 Color Palette

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        // Base
        background: {
          DEFAULT: '#0A0A0F',
          secondary: '#12121A',
          tertiary: '#1A1A24',
        },
        foreground: {
          DEFAULT: '#FFFFFF',
          muted: '#A0A0B0',
          subtle: '#6B6B7B',
        },
        // Accent - Primary (Cyan)
        accent: {
          DEFAULT: '#00FFFF',
          50: '#E0FFFF',
          100: '#B3FFFF',
          200: '#80FFFF',
          300: '#4DFFFF',
          400: '#1AFFFF',
          500: '#00FFFF',
          600: '#00CCCC',
          700: '#009999',
          800: '#006666',
          900: '#003333',
        },
        // Accent - Secondary (Purple)
        purple: {
          DEFAULT: '#8B5CF6',
          50: '#F3F0FF',
          100: '#E9E3FF',
          200: '#D4C7FE',
          300: '#B69FFE',
          400: '#9F7AFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        // Chart colors
        chart: {
          1: '#00FFFF',
          2: '#8B5CF6',
          3: '#10B981',
          4: '#F59E0B',
          5: '#EF4444',
        },
      },
    },
  },
};
```

### 4.2 Typography

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Typography scale */
.text-display { @apply text-4xl md:text-5xl lg:text-6xl font-bold; }
.text-h1 { @apply text-3xl md:text-4xl font-bold; }
.text-h2 { @apply text-2xl md:text-3xl font-semibold; }
.text-h3 { @apply text-xl md:text-2xl font-semibold; }
.text-h4 { @apply text-lg md:text-xl font-medium; }
.text-body { @apply text-base; }
.text-small { @apply text-sm; }
.text-tiny { @apply text-xs; }

/* Monospace for data/numbers */
.font-data { @apply font-mono tabular-nums; }
```

### 4.3 Component Styling Patterns

```typescript
// components/ui/card.tsx
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'glow';
  className?: string;
}

export function Card({ children, variant = 'default', className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-300',
        {
          // Default - solid dark
          'bg-background-secondary border-white/5': variant === 'default',
          // Glass - frosted glass effect
          'bg-white/5 backdrop-blur-xl border-white/10': variant === 'glass',
          // Glow - accent border glow
          'bg-background-secondary border-accent/20 shadow-[0_0_30px_-5px_rgba(0,255,255,0.15)]':
            variant === 'glow',
        },
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 4.4 Animation Patterns

```typescript
// lib/animations.ts
import { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export const glowPulse: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(0, 255, 255, 0)' },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(0, 255, 255, 0)',
      '0 0 20px 2px rgba(0, 255, 255, 0.3)',
      '0 0 0 0 rgba(0, 255, 255, 0)',
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};

// Number counting animation hook
export function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const startValue = count;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(startValue + (end - startValue) * easeOutExpo(progress)));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [end]);
  
  return count;
}
```

---

## 5. Guest Zone Pages

### 5.1 Home Page

**File: `app/(guest)/page.tsx`**

```typescript
import { Suspense } from 'react';
import { HeroSection } from '@/components/home/hero-section';
import { LiveStatsTicker } from '@/components/home/live-stats-ticker';
import { HashrateChart } from '@/components/charts/hashrate-chart';
import { LeaderboardPreview } from '@/components/home/leaderboard-preview';
import { FeaturesGrid } from '@/components/home/features-grid';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero with 3D Globe */}
      <section className="relative h-screen">
        <HeroSection />
        
        {/* Floating Stats Ticker */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <Suspense fallback={<LoadingSpinner />}>
            <LiveStatsTicker />
          </Suspense>
        </div>
      </section>
      
      {/* 24h Hashrate Chart */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-h2 text-accent mb-8">Network Hashrate</h2>
        <Suspense fallback={<LoadingSpinner />}>
          <HashrateChart timeRange="24h" height={400} />
        </Suspense>
      </section>
      
      {/* Leaderboard Preview */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-h2 text-accent mb-8">Top Miners</h2>
        <Suspense fallback={<LoadingSpinner />}>
          <LeaderboardPreview limit={5} />
        </Suspense>
      </section>
      
      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <FeaturesGrid />
      </section>
    </main>
  );
}
```

### 5.2 Hero Section with 3D Globe

**File: `components/home/hero-section.tsx`**

```typescript
'use client';

import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Dynamic import for 3D component (no SSR)
const Globe3D = dynamic(() => import('@/components/3d/globe'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-background" />,
});

export function HeroSection() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D Globe Background */}
      <div className="absolute inset-0 z-0">
        <Globe3D />
      </div>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-10" />
      
      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center">
        <div className="text-center max-w-4xl px-4">
          <motion.h1
            className="text-display text-foreground mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-accent">VIDDHANA</span> POOL
          </motion.h1>
          
          <motion.p
            className="text-xl text-foreground-muted mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Next-generation mining powered by AI optimization and Layer 3 instant payouts
          </motion.p>
          
          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <Button asChild size="lg" variant="glow">
              <Link href="/register">Start Mining</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pools">View Pools</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
```

### 5.3 Live Stats Ticker

**File: `components/home/live-stats-ticker.tsx`**

```typescript
'use client';

import { useSocket } from '@/hooks/use-socket';
import { useRealtimeStore } from '@/stores/realtime-store';
import { formatHashrate, formatNumber } from '@/lib/formatters';
import { motion } from 'framer-motion';
import { Activity, Users, Gauge, Zap } from 'lucide-react';

export function LiveStatsTicker() {
  const { poolStats } = useRealtimeStore();
  
  // Subscribe to real-time updates
  useSocket('pool:stats', (data) => {
    useRealtimeStore.getState().setPoolStats(data);
  });
  
  const stats = [
    {
      icon: Gauge,
      label: 'Pool Hashrate',
      value: formatHashrate(poolStats.hashrate),
      color: 'text-accent',
    },
    {
      icon: Activity,
      label: 'Network Hashrate',
      value: formatHashrate(poolStats.networkHashrate),
      color: 'text-purple',
    },
    {
      icon: Users,
      label: 'Active Miners',
      value: formatNumber(poolStats.activeMiners),
      color: 'text-success',
    },
    {
      icon: Zap,
      label: 'Difficulty',
      value: formatNumber(poolStats.difficulty, 2),
      color: 'text-warning',
    },
  ];
  
  return (
    <div className="bg-background-secondary/80 backdrop-blur-xl border-t border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4 overflow-x-auto">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="flex items-center gap-3 px-4 min-w-fit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-tiny text-foreground-subtle uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className={`font-data text-lg font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 5.4 Pools & Statistics Page

**File: `app/(guest)/pools/page.tsx`**

```typescript
import { Suspense } from 'react';
import { PoolsGrid } from '@/components/pools/pools-grid';
import { BlockHistoryChart } from '@/components/charts/block-history-bar';
import { PoolStats } from '@/components/pools/pool-stats';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

export const metadata = {
  title: 'Pools & Statistics | VIDDHANA POOL',
};

export default function PoolsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-h1 text-accent mb-8">Mining Pools</h1>
      
      {/* Pool Cards Grid */}
      <section className="mb-12">
        <Suspense fallback={<LoadingSpinner />}>
          <PoolsGrid />
        </Suspense>
      </section>
      
      {/* Pool Statistics */}
      <section className="mb-12">
        <h2 className="text-h2 mb-6">Pool Statistics</h2>
        <Suspense fallback={<LoadingSpinner />}>
          <PoolStats />
        </Suspense>
      </section>
      
      {/* Block History */}
      <section>
        <h2 className="text-h2 mb-6">Blocks Found (Last 30 Days)</h2>
        <Suspense fallback={<LoadingSpinner />}>
          <BlockHistoryChart days={30} />
        </Suspense>
      </section>
    </main>
  );
}
```

### 5.5 Block Explorer Page

**File: `app/(guest)/blocks/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BlocksTable } from '@/components/blocks/blocks-table';
import { BlockSearch } from '@/components/blocks/block-search';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function BlocksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  
  const { data, isLoading } = useQuery({
    queryKey: ['blocks', page, searchQuery],
    queryFn: () => api.blocks.list({ page, search: searchQuery }),
  });
  
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-h1 text-accent">Block Explorer</h1>
        <BlockSearch value={searchQuery} onChange={setSearchQuery} />
      </div>
      
      <Card variant="glass" className="p-0 overflow-hidden">
        <BlocksTable
          blocks={data?.blocks || []}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages || 1}
          onPageChange={setPage}
        />
      </Card>
    </main>
  );
}
```

### 5.6 Leaderboard Page

**File: `app/(guest)/leaderboard/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table';
import { TimeFilter } from '@/components/leaderboard/time-filter';
import { SortFilter } from '@/components/leaderboard/sort-filter';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

type TimeRange = 'day' | 'week' | 'month';
type SortBy = 'hashrate' | 'blocks' | 'earnings';

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [sortBy, setSortBy] = useState<SortBy>('hashrate');
  
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', timeRange, sortBy],
    queryFn: () => api.leaderboard.get({ timeRange, sortBy }),
  });
  
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-h1 text-accent mb-8">Leaderboard</h1>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <TimeFilter value={timeRange} onChange={setTimeRange} />
        <SortFilter value={sortBy} onChange={setSortBy} />
      </div>
      
      {/* Leaderboard Table */}
      <Card variant="glass" className="p-0 overflow-hidden">
        <LeaderboardTable
          miners={data?.miners || []}
          isLoading={isLoading}
          sortBy={sortBy}
        />
      </Card>
    </main>
  );
}
```

---

## 6. User Zone Pages

### 6.1 Dashboard Layout

**File: `app/dashboard/layout.tsx`**

```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 6.2 Main Dashboard (HUD)

**File: `app/dashboard/page.tsx`**

```typescript
'use client';

import { Suspense } from 'react';
import { HUDDisplay } from '@/components/dashboard/hud-display';
import { HashrateChart } from '@/components/charts/hashrate-chart';
import { WorkersOverview } from '@/components/dashboard/workers-overview';
import { RecentPayouts } from '@/components/dashboard/recent-payouts';
import { AIProjection } from '@/components/dashboard/ai-projection';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* HUD Display - Key Metrics */}
      <Suspense fallback={<LoadingSpinner />}>
        <HUDDisplay />
      </Suspense>
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hashrate Chart - 2 columns */}
        <Card variant="glass" className="lg:col-span-2 p-6">
          <h3 className="text-h4 mb-4">Hashrate History</h3>
          <Suspense fallback={<LoadingSpinner />}>
            <HashrateChart timeRange="24h" height={300} showZoom />
          </Suspense>
        </Card>
        
        {/* AI Projection */}
        <Card variant="glow" className="p-6">
          <h3 className="text-h4 mb-4 flex items-center gap-2">
            <span className="text-purple">Prometheus AI</span>
            <span className="text-tiny text-foreground-subtle">Projection</span>
          </h3>
          <Suspense fallback={<LoadingSpinner />}>
            <AIProjection />
          </Suspense>
        </Card>
      </div>
      
      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers Overview */}
        <Card variant="glass" className="p-6">
          <h3 className="text-h4 mb-4">Workers</h3>
          <Suspense fallback={<LoadingSpinner />}>
            <WorkersOverview />
          </Suspense>
        </Card>
        
        {/* Recent Payouts */}
        <Card variant="glass" className="p-6">
          <h3 className="text-h4 mb-4">Recent Payouts</h3>
          <Suspense fallback={<LoadingSpinner />}>
            <RecentPayouts limit={5} />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
```

### 6.3 HUD Display Component

**File: `components/dashboard/hud-display.tsx`**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/hooks/use-socket';
import { motion } from 'framer-motion';
import { formatHashrate, formatCurrency } from '@/lib/formatters';
import { Gauge, Users, TrendingUp, Wallet } from 'lucide-react';
import { api } from '@/lib/api';

export function HUDDisplay() {
  const { data, refetch } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.dashboard.overview(),
  });
  
  // Real-time updates
  useSocket('user:stats', () => refetch());
  
  const metrics = [
    {
      icon: Gauge,
      label: 'Current Hashrate',
      value: formatHashrate(data?.currentHashrate || 0),
      subValue: `24h Avg: ${formatHashrate(data?.avgHashrate || 0)}`,
      color: 'accent',
      trend: data?.hashrateTrend,
    },
    {
      icon: Users,
      label: 'Workers',
      value: `${data?.onlineWorkers || 0} / ${data?.totalWorkers || 0}`,
      subValue: `${data?.offlineWorkers || 0} offline`,
      color: data?.offlineWorkers ? 'warning' : 'success',
    },
    {
      icon: TrendingUp,
      label: 'Est. Earnings (24h)',
      value: formatCurrency(data?.estimated24h || 0),
      subValue: `Monthly: ${formatCurrency(data?.estimatedMonthly || 0)}`,
      color: 'purple',
      isAI: true,
    },
    {
      icon: Wallet,
      label: 'Unpaid Balance',
      value: formatCurrency(data?.unpaidBalance || 0),
      subValue: `Next payout: ${data?.nextPayout || '-'}`,
      color: 'accent',
    },
  ];
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          className={`
            relative overflow-hidden rounded-xl p-5
            bg-background-secondary border border-white/5
            ${metric.color === 'accent' ? 'hover:border-accent/30' : ''}
            ${metric.color === 'purple' ? 'hover:border-purple/30' : ''}
            transition-colors duration-300
          `}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          {/* Glow effect for AI metrics */}
          {metric.isAI && (
            <div className="absolute inset-0 bg-gradient-to-br from-purple/10 to-transparent" />
          )}
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <metric.icon className={`h-5 w-5 text-${metric.color}`} />
              <span className="text-small text-foreground-subtle">
                {metric.label}
              </span>
              {metric.isAI && (
                <span className="text-tiny text-purple bg-purple/10 px-2 py-0.5 rounded-full">
                  AI
                </span>
              )}
            </div>
            
            <p className={`font-data text-2xl font-bold text-${metric.color}`}>
              {metric.value}
            </p>
            
            <p className="text-tiny text-foreground-subtle mt-1">
              {metric.subValue}
            </p>
            
            {/* Trend indicator */}
            {metric.trend !== undefined && (
              <div className={`
                absolute top-4 right-4 text-tiny
                ${metric.trend >= 0 ? 'text-success' : 'text-error'}
              `}>
                {metric.trend >= 0 ? '↑' : '↓'} {Math.abs(metric.trend)}%
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

### 6.4 Workers Management Page

**File: `app/dashboard/workers/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { WorkersTable } from '@/components/workers/workers-table';
import { WorkerFilters } from '@/components/workers/worker-filters';
import { BulkActions } from '@/components/workers/bulk-actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkersPage() {
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workers', filter],
    queryFn: () => api.workers.list({ status: filter }),
  });
  
  const optimizeMutation = useMutation({
    mutationFn: () => api.ai.optimizeWorkers(selectedWorkers),
    onSuccess: (result) => {
      toast.success('Prometheus optimization complete', {
        description: `${result.optimized} workers updated`,
      });
      refetch();
    },
  });
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-h1">Workers</h1>
        
        <Button
          variant="glow"
          onClick={() => optimizeMutation.mutate()}
          disabled={selectedWorkers.length === 0 || optimizeMutation.isPending}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Prometheus Optimize
        </Button>
      </div>
      
      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <WorkerFilters value={filter} onChange={setFilter} />
        {selectedWorkers.length > 0 && (
          <BulkActions
            selectedCount={selectedWorkers.length}
            onAction={(action) => {
              // Handle bulk actions
            }}
          />
        )}
      </div>
      
      {/* Workers Table */}
      <Card variant="glass" className="p-0 overflow-hidden">
        <WorkersTable
          workers={data?.workers || []}
          isLoading={isLoading}
          selectedWorkers={selectedWorkers}
          onSelectionChange={setSelectedWorkers}
        />
      </Card>
    </div>
  );
}
```

---

## 7. Components Library

### 7.1 Button Component

**File: `components/ui/button.tsx`**

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-background hover:bg-accent/90',
        outline: 'border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20',
        ghost: 'hover:bg-white/5',
        glow: 'bg-accent text-background shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]',
        destructive: 'bg-error text-white hover:bg-error/90',
        purple: 'bg-purple text-white hover:bg-purple/90 shadow-[0_0_20px_rgba(139,92,246,0.3)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### 7.2 Data Table Component

**File: `components/ui/table.tsx`**

```typescript
import { cn } from '@/lib/utils';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No data available',
  onRowClick,
  rowClassName,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        {emptyMessage}
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={cn(
                  'px-4 py-3 text-left text-tiny font-medium text-foreground-subtle uppercase tracking-wider',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'hover:bg-white/5 transition-colors',
                onRowClick && 'cursor-pointer',
                rowClassName?.(item)
              )}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={cn('px-4 py-3 text-small', column.className)}
                >
                  {column.render
                    ? column.render(item)
                    : String(item[column.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 8. State Management

### 8.1 Auth Store

**File: `stores/auth-store.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  walletAddress: string;
  email?: string;
  twoFactorEnabled: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'viddhana-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
```

### 8.2 Real-time Store

**File: `stores/realtime-store.ts`**

```typescript
import { create } from 'zustand';

interface PoolStats {
  hashrate: number;
  networkHashrate: number;
  activeMiners: number;
  difficulty: number;
}

interface WorkerUpdate {
  id: string;
  hashrate: number;
  isOnline: boolean;
  lastSeen: string;
}

interface RealtimeState {
  poolStats: PoolStats;
  workerUpdates: Record<string, WorkerUpdate>;
  setPoolStats: (stats: PoolStats) => void;
  updateWorker: (update: WorkerUpdate) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  poolStats: {
    hashrate: 0,
    networkHashrate: 0,
    activeMiners: 0,
    difficulty: 0,
  },
  workerUpdates: {},
  setPoolStats: (stats) => set({ poolStats: stats }),
  updateWorker: (update) =>
    set((state) => ({
      workerUpdates: { ...state.workerUpdates, [update.id]: update },
    })),
}));
```

---

## 9. Real-time Integration

### 9.1 Socket Hook

**File: `hooks/use-socket.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function useSocket<T>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  const { token, isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    const socket = getSocket();
    
    // Connect with auth token
    if (isAuthenticated && token) {
      socket.auth = { token };
      socket.connect();
    }
    
    // Subscribe to event
    const eventHandler = (data: T) => handlerRef.current(data);
    socket.on(event, eventHandler);
    
    return () => {
      socket.off(event, eventHandler);
    };
  }, [event, isAuthenticated, token]);
}

export function useSocketEmit() {
  return useCallback(<T>(event: string, data: T) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit(event, data);
    }
  }, []);
}
```

### 9.2 API Client

**File: `lib/api.ts`**

```typescript
import { useAuthStore } from '@/stores/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }
  
  return response.json();
}

export const api = {
  // Auth
  auth: {
    login: (data: { wallet: string; signature: string }) =>
      request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: { wallet: string; email?: string }) =>
      request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },
  
  // Dashboard
  dashboard: {
    overview: () => request('/api/v1/dashboard/overview'),
  },
  
  // Workers
  workers: {
    list: (params?: { status?: string }) =>
      request(`/api/v1/workers?${new URLSearchParams(params as Record<string, string>)}`),
    get: (id: string) => request(`/api/v1/workers/${id}`),
  },
  
  // Stats
  stats: {
    pool: () => request('/api/v1/stats/pool'),
    hashrate: (params: { range: string }) =>
      request(`/api/v1/stats/hashrate?${new URLSearchParams(params)}`),
  },
  
  // Blocks
  blocks: {
    list: (params: { page?: number; search?: string }) =>
      request(`/api/v1/blocks?${new URLSearchParams(params as Record<string, string>)}`),
  },
  
  // Leaderboard
  leaderboard: {
    get: (params: { timeRange: string; sortBy: string }) =>
      request(`/api/v1/leaderboard?${new URLSearchParams(params)}`),
  },
  
  // Payouts
  payouts: {
    list: () => request('/api/v1/payouts'),
    request: (amount: number) =>
      request('/api/v1/payouts', { method: 'POST', body: JSON.stringify({ amount }) }),
  },
  
  // AI
  ai: {
    projection: () => request('/api/v1/ai/projection'),
    optimizeWorkers: (workerIds: string[]) =>
      request('/api/v1/ai/optimize', { method: 'POST', body: JSON.stringify({ workerIds }) }),
  },
};
```

---

## 10. 3D Visualizations

### 10.1 Globe Component

**File: `components/3d/globe.tsx`**

```typescript
'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function GlobeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  // Generate random points on sphere for "nodes"
  const nodePositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 200; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2.1;
      
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    }
    return new Float32Array(positions);
  }, []);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001;
    }
  });
  
  return (
    <group>
      {/* Main globe */}
      <Sphere ref={meshRef} args={[2, 64, 64]}>
        <meshBasicMaterial
          color="#0A0A0F"
          wireframe
          transparent
          opacity={0.1}
        />
      </Sphere>
      
      {/* Wireframe overlay */}
      <Sphere args={[2.02, 32, 32]}>
        <meshBasicMaterial
          color="#00FFFF"
          wireframe
          transparent
          opacity={0.15}
        />
      </Sphere>
      
      {/* Node points */}
      <Points ref={pointsRef} positions={nodePositions}>
        <PointMaterial
          color="#00FFFF"
          size={0.05}
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </Points>
    </group>
  );
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.5} />
      <GlobeMesh />
    </Canvas>
  );
}
```

---

## Implementation Checklist

### Phase 1 (MVP)
- [ ] Setup Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS with design system
- [ ] Implement base UI components (Button, Card, Table, etc.)
- [ ] Create Guest Zone pages (Home, Pools, Blocks, Leaderboard)
- [ ] Setup Socket.io client integration
- [ ] Implement live stats ticker
- [ ] Create responsive layouts

### Phase 2 (User Zone)
- [ ] Implement authentication flow (Web3 + Email)
- [ ] Create Dashboard with HUD display
- [ ] Build Workers management page
- [ ] Implement Mining statistics page
- [ ] Create Payouts & Finance page
- [ ] Add Settings page with 2FA setup

### Phase 3 (Advanced)
- [ ] Integrate 3D globe visualization
- [ ] Add Prometheus AI projection component
- [ ] Implement License management
- [ ] Create Support ticket system
- [ ] Add Stratum config generator tool
- [ ] Performance optimization (lazy loading, code splitting)

---

## References

- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [TanStack Query](https://tanstack.com/query/latest)
- [Socket.io Client](https://socket.io/docs/v4/client-api/)
