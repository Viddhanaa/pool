'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { truncateAddress } from '@/lib/utils';
import { Wallet, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="font-mono">{truncateAddress(address)}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>

        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-48 rounded-lg bg-background-secondary border border-white/10 shadow-lg z-50">
              <div className="p-2">
                <button
                  onClick={() => {
                    disconnect();
                    setIsDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-white/5 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="glow"
        size="sm"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isConnecting}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      {isDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-lg bg-background-secondary border border-white/10 shadow-lg z-50">
            <div className="p-2">
              <p className="px-3 py-2 text-tiny text-foreground-subtle">
                Select a wallet
              </p>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setIsDropdownOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground hover:bg-white/5 rounded-md transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4" />
                  </span>
                  {connector.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
