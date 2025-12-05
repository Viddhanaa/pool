'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { useState, useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';

// Wagmi configuration - created lazily to avoid SSR issues
function getConfig() {
  const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  
  // Only include WalletConnect on client-side with valid project ID
  const connectors = typeof window !== 'undefined' && 
    walletConnectProjectId && 
    walletConnectProjectId !== 'your_project_id_here'
    ? [
        injected(),
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
        }),
      ]
    : [injected()];

  return createConfig({
    chains: [mainnet, sepolia],
    connectors,
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },
    ssr: true,
  });
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render nothing until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#12121A',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#FFFFFF',
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
