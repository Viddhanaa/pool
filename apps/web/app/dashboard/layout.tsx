'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse text-foreground-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Dashboard Header */}
        <header className="h-16 border-b border-white/5 bg-background-secondary/50 backdrop-blur-sm flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <p className="text-tiny text-foreground-subtle">
              Welcome back{user?.walletAddress ? `, ${user.walletAddress.slice(0, 6)}...` : ', Miner'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
              <span className="text-sm text-foreground-muted">Connected</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
