'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Cpu,
  BarChart3,
  Wallet,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workers', href: '/dashboard/workers', icon: Cpu },
  { name: 'Payouts', href: '/dashboard/payouts', icon: Wallet },
  { name: 'Mining Stats', href: '/dashboard/stats', icon: Activity },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// Mock user data - replace with actual user context
const mockUser = {
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
};

function truncateAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    // Handle logout logic here
    console.log('Logout clicked');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-cyan-500/10">
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow duration-300">
              <span className="text-white font-bold text-sm tracking-wider">VP</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 blur-sm" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                VIDDHANA
              </span>
              <span className="text-[10px] text-cyan-500/60 tracking-widest uppercase">
                Mining Pool
              </span>
            </div>
          </Link>
        )}
        {isCollapsed && (
          <div className="mx-auto relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <span className="text-white font-bold text-sm tracking-wider">VP</span>
          </div>
        )}
      </div>

      {/* Collapse Toggle - Desktop */}
      <div className="hidden md:flex justify-end px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/5 border border-transparent',
                isCollapsed && 'justify-center px-2'
              )}
            >
              {/* Active glow effect */}
              {isActive && (
                <>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 blur-sm" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-cyan-400 to-purple-500 rounded-r-full shadow-lg shadow-cyan-500/50" />
                </>
              )}
              <item.icon
                className={cn(
                  'relative z-10 h-5 w-5 flex-shrink-0 transition-all duration-300',
                  isActive
                    ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                    : 'text-gray-500 group-hover:text-cyan-400'
                )}
              />
              {!isCollapsed && (
                <span className="relative z-10 transition-colors">{item.name}</span>
              )}
              {/* Hover glow */}
              {!isActive && (
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 transition-opacity duration-300" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="mt-auto border-t border-cyan-500/10">
        {/* User Info */}
        <div className={cn('p-4', isCollapsed && 'p-2')}>
          {!isCollapsed ? (
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/20">
              <p className="text-[10px] text-cyan-500/60 uppercase tracking-wider mb-1">
                Connected Wallet
              </p>
              <p className="text-sm font-mono text-cyan-400 truncate">
                {truncateAddress(mockUser.walletAddress)}
              </p>
            </div>
          ) : (
            <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-cyan-500/60" />
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div className={cn('px-3 pb-4', isCollapsed && 'px-2')}>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all duration-300',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden h-10 w-10 bg-gray-900/90 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 backdrop-blur-sm"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-gray-900/95 backdrop-blur-xl border-r border-cyan-500/10 transition-transform duration-300 md:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen bg-gray-900/80 backdrop-blur-xl border-r border-cyan-500/10 transition-all duration-300',
          isCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
