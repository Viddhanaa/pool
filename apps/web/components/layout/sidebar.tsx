'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Server,
  BarChart3,
  Wallet,
  Shield,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workers', href: '/dashboard/workers', icon: Server },
  { name: 'Statistics', href: '/dashboard/stats', icon: BarChart3 },
  { name: 'Payouts', href: '/dashboard/payouts', icon: Wallet },
  { name: 'Licenses', href: '/dashboard/licenses', icon: Shield },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Support', href: '/dashboard/support', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-background-secondary border-r border-white/5 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
        <Link href="/" className={cn("flex items-center gap-3", isCollapsed && "mx-auto")}>
          <Image
            src="/logo/logo.png"
            alt="VIDDHANA POOL Logo"
            width={36}
            height={36}
            className="object-contain"
          />
          {!isCollapsed && (
            <span className="font-bold text-lg">
              <span className="text-accent">VIDDHANA</span>
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-3 right-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground-muted hover:text-foreground hover:bg-white/5',
                isCollapsed && 'justify-center'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-accent')} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      {!isCollapsed && (
        <div className="p-4 border-t border-white/5">
          <div className="p-3 rounded-lg bg-purple/10 border border-purple/20">
            <p className="text-tiny text-purple font-medium mb-1">Prometheus AI</p>
            <p className="text-tiny text-foreground-subtle">
              Optimizing your mining efficiency
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
