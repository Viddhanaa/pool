'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { Copy, Check, ChevronDown, Wallet, Settings, Play, DollarSign, Terminal, HelpCircle } from 'lucide-react';

// Connection details
const POOL_CONFIG = {
  pool: 'stratum.viddhana.com:3333',
  user: 'YOUR_WALLET_ADDRESS.WORKER_NAME',
  password: 'x',
};

// Miner configurations
const MINERS = [
  {
    name: 'T-Rex Miner',
    command: `t-rex -a ethash -o stratum+tcp://${POOL_CONFIG.pool} -u ${POOL_CONFIG.user} -p ${POOL_CONFIG.password}`,
    description: 'High-performance NVIDIA GPU miner',
  },
  {
    name: 'lolMiner',
    command: `lolMiner --algo ETHASH --pool stratum+tcp://${POOL_CONFIG.pool} --user ${POOL_CONFIG.user} --pass ${POOL_CONFIG.password}`,
    description: 'Multi-algorithm AMD & NVIDIA miner',
  },
  {
    name: 'NBMiner',
    command: `nbminer -a ethash -o stratum+tcp://${POOL_CONFIG.pool} -u ${POOL_CONFIG.user}`,
    description: 'Efficient NVIDIA & AMD GPU miner',
  },
];

// FAQ items
const FAQ_ITEMS = [
  {
    question: 'What is the minimum payout?',
    answer: 'The minimum payout threshold is 0.1 VID. Payouts are processed automatically once you reach this threshold.',
  },
  {
    question: 'How are rewards calculated?',
    answer: 'Rewards are distributed using the PPLNS (Pay Per Last N Shares) system, ensuring fair distribution based on your contribution.',
  },
  {
    question: 'What mining software should I use?',
    answer: 'We recommend T-Rex Miner for NVIDIA GPUs and lolMiner for AMD GPUs. Both offer excellent performance and stability.',
  },
  {
    question: 'How do I check my mining stats?',
    answer: 'Enter your wallet address on the dashboard to view real-time hashrate, shares, and estimated earnings.',
  },
  {
    question: 'Is there a pool fee?',
    answer: 'Viddhana Pool charges a competitive 1% fee, which covers server infrastructure and development costs.',
  },
];

// Steps data
const STEPS = [
  {
    number: 1,
    title: 'Create/Connect Wallet',
    description: 'Set up a compatible wallet to receive mining rewards',
    icon: Wallet,
    color: 'accent',
  },
  {
    number: 2,
    title: 'Configure Your Miner',
    description: 'Set up your mining software with pool connection details',
    icon: Settings,
    color: 'purple',
  },
  {
    number: 3,
    title: 'Start Mining',
    description: 'Launch your miner and begin contributing hashpower',
    icon: Play,
    color: 'accent',
  },
  {
    number: 4,
    title: 'Monitor & Get Paid',
    description: 'Track your stats and receive automatic payouts',
    icon: DollarSign,
    color: 'purple',
  },
];

// Copy button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      className="shrink-0 hover:bg-accent/10 hover:text-accent"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

// FAQ Item component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={false}
      className="border-b border-white/5 last:border-0"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:text-accent transition-colors"
      >
        <span className="font-medium">{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-foreground-muted" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-foreground-muted text-sm leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

export default function GuidePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-accent">Getting</span> Started
            </h1>
            <p className="text-foreground-muted text-lg">
              Start mining in minutes with our simple setup guide
            </p>
          </motion.div>
        </section>

        {/* Steps Section */}
        <section className="container mx-auto px-4 mb-16">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {STEPS.map((step) => (
              <motion.div key={step.number} variants={itemVariants}>
                <Card
                  variant={step.color === 'accent' ? 'glow' : 'glow-purple'}
                  hover="glow"
                  className="p-6 h-full relative overflow-hidden group"
                >
                  {/* Step number background */}
                  <div className="absolute -top-4 -right-4 text-8xl font-bold text-white/5 group-hover:text-white/10 transition-colors">
                    {step.number}
                  </div>
                  
                  <div className="relative z-10">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                        step.color === 'accent'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-purple/20 text-purple'
                      }`}
                    >
                      <step.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                    <p className="text-foreground-muted text-sm">
                      {step.description}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Connection Details */}
        <section className="container mx-auto px-4 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card variant="glow" className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-accent" />
                </div>
                <h2 className="text-2xl font-bold">Connection Details</h2>
              </div>

              <div className="grid gap-4">
                {/* Pool Address */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4 border border-white/5">
                  <div>
                    <span className="text-foreground-muted text-sm block mb-1">Pool</span>
                    <code className="text-accent font-mono">{POOL_CONFIG.pool}</code>
                  </div>
                  <CopyButton text={POOL_CONFIG.pool} />
                </div>

                {/* User */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4 border border-white/5">
                  <div>
                    <span className="text-foreground-muted text-sm block mb-1">User</span>
                    <code className="text-purple font-mono">{POOL_CONFIG.user}</code>
                  </div>
                  <CopyButton text={POOL_CONFIG.user} />
                </div>

                {/* Password */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4 border border-white/5">
                  <div>
                    <span className="text-foreground-muted text-sm block mb-1">Password</span>
                    <code className="text-foreground font-mono">{POOL_CONFIG.password}</code>
                  </div>
                  <CopyButton text={POOL_CONFIG.password} />
                </div>
              </div>
            </Card>
          </motion.div>
        </section>

        {/* Miner Configuration Examples */}
        <section className="container mx-auto px-4 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Settings className="h-6 w-6 text-purple" />
              Miner Configuration
            </h2>

            <div className="grid gap-4">
              {MINERS.map((miner, index) => (
                <motion.div
                  key={miner.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card
                    variant="glass"
                    hover="glow"
                    className="p-6"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{miner.name}</h3>
                        <p className="text-foreground-muted text-sm">
                          {miner.description}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="bg-background/80 rounded-lg p-4 pr-12 border border-white/5 overflow-x-auto">
                        <code className="text-sm font-mono text-accent whitespace-pre">
                          {miner.command}
                        </code>
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CopyButton text={miner.command} />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <p className="text-foreground-muted text-sm mt-4 text-center">
              Replace <code className="text-accent">YOUR_WALLET_ADDRESS</code> with your wallet and{' '}
              <code className="text-purple">WORKER_NAME</code> with your rig identifier
            </p>
          </motion.div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card variant="glow-purple" className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple/20 flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-purple" />
                </div>
                <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
              </div>

              <div className="divide-y divide-white/5">
                {FAQ_ITEMS.map((item, index) => (
                  <FAQItem key={index} question={item.question} answer={item.answer} />
                ))}
              </div>
            </Card>
          </motion.div>
        </section>
      </main>
    </>
  );
}
