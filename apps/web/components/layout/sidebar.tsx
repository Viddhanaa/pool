'use client';

import Link from 'next/link';
import Image from 'next/image';
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 1e6793ea15282deec4c2d47a86393c6dab9a34db
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
            const sidebarContent = (
              <>
                {/* Logo + Collapse Toggle */}
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
