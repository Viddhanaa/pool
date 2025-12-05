'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAccount } from 'wagmi';
import { WalletConnect } from '@/components/shared/wallet-connect';
import { 
  Pickaxe, 
  Server, 
  Copy, 
  Check, 
  ArrowRight,
  Shield,
  Zap,
  Sparkles
} from 'lucide-react';

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState('worker1');

  const stratumHost = process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.viddhana.com';
  const stratumPort = process.env.NEXT_PUBLIC_STRATUM_PORT || '3333';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const minerConfigs = [
    {
      name: 'T-Rex Miner',
      command: `t-rex -a ethash -o stratum+tcp://${stratumHost}:${stratumPort} -u ${address || 'YOUR_WALLET_ADDRESS'}.${workerName} -p x`,
    },
    {
      name: 'lolMiner',
      command: `lolMiner --algo ETHASH --pool stratum+tcp://${stratumHost}:${stratumPort} --user ${address || 'YOUR_WALLET_ADDRESS'}.${workerName}`,
    },
    {
      name: 'NBMiner',
      command: `nbminer -a ethash -o stratum+tcp://${stratumHost}:${stratumPort} -u ${address || 'YOUR_WALLET_ADDRESS'}.${workerName}`,
    },
    {
      name: 'TeamRedMiner',
      command: `teamredminer -a ethash -o stratum+tcp://${stratumHost}:${stratumPort} -u ${address || 'YOUR_WALLET_ADDRESS'}.${workerName} -p x`,
    },
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-h1 mb-4">
              <span className="text-accent">Start Mining</span>
            </h1>
            <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
              Connect your wallet and configure your miner to start earning rewards
            </p>
          </div>

          {/* Step 1: Connect Wallet */}
          <Card variant="glass" padding="lg" className="mb-6 overflow-visible relative z-20">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20 text-accent font-bold">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
                <p className="text-foreground-muted mb-4">
                  Connect your Ethereum wallet to receive mining rewards directly
                </p>
                {isConnected ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <Check className="h-5 w-5 text-success" />
                    <span className="text-success font-mono">{address}</span>
                  </div>
                ) : (
                  <WalletConnect />
                )}
              </div>
            </div>
          </Card>

          {/* Step 2: Worker Name */}
          <Card variant="glass" padding="lg" className="mb-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20 text-accent font-bold">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Set Worker Name</h2>
                <p className="text-foreground-muted mb-4">
                  Give your miner a unique name to track it on the dashboard
                </p>
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="worker1"
                  className="w-full max-w-xs px-4 py-2 rounded-lg bg-background border border-white/10 text-foreground focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          </Card>

          {/* Step 3: Configure Miner */}
          <Card variant="glass" padding="lg" className="mb-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20 text-accent font-bold">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Configure Your Miner</h2>
                <p className="text-foreground-muted mb-4">
                  Copy the command for your mining software and run it
                </p>

                {/* Pool Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-2 text-tiny text-foreground-subtle mb-1">
                      <Server className="h-4 w-4" />
                      Stratum Server
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-accent font-mono">{stratumHost}:{stratumPort}</code>
                      <button
                        onClick={() => copyToClipboard(`${stratumHost}:${stratumPort}`, 'server')}
                        className="text-foreground-muted hover:text-foreground transition-colors"
                      >
                        {copied === 'server' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-background-secondary">
                    <div className="flex items-center gap-2 text-tiny text-foreground-subtle mb-1">
                      <Pickaxe className="h-4 w-4" />
                      Algorithm
                    </div>
                    <code className="text-accent font-mono">Ethash</code>
                  </div>
                </div>

                {/* Miner Configs */}
                <div className="space-y-3">
                  {minerConfigs.map((config) => (
                    <div key={config.name} className="p-4 rounded-lg bg-background-secondary">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{config.name}</span>
                        <button
                          onClick={() => copyToClipboard(config.command, config.name)}
                          className="flex items-center gap-1 text-sm text-accent hover:text-accent/80 transition-colors"
                        >
                          {copied === config.name ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <code className="block text-sm text-foreground-muted font-mono bg-background p-3 rounded overflow-x-auto">
                        {config.command}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4: Start Mining */}
          <Card variant="glass" padding="lg" className="mb-8">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/20 text-accent font-bold">
                4
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Start Mining & Monitor</h2>
                <p className="text-foreground-muted mb-4">
                  Run the miner command and visit your dashboard to monitor progress
                </p>
                <Button asChild variant="glow" size="lg" className="gap-2">
                  <a href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="glass" padding="default" className="text-center">
              <div className="inline-flex p-3 rounded-lg bg-purple/10 text-purple mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">AI Optimized</h3>
              <p className="text-sm text-foreground-muted">
                Prometheus AI automatically adjusts difficulty
              </p>
            </Card>
            <Card variant="glass" padding="default" className="text-center">
              <div className="inline-flex p-3 rounded-lg bg-accent/10 text-accent mb-3">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">Instant Payouts</h3>
              <p className="text-sm text-foreground-muted">
                Layer 3 enables real-time micro-payments
              </p>
            </Card>
            <Card variant="glass" padding="default" className="text-center">
              <div className="inline-flex p-3 rounded-lg bg-success/10 text-success mb-3">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-1">Secure & Fair</h3>
              <p className="text-sm text-foreground-muted">
                DePIN verified hardware distribution
              </p>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
