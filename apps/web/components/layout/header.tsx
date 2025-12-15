'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WalletConnect } from '@/components/shared/wallet-connect';

const guestNavigation = [
    { name: 'Home', href: '/' },
    { name: 'Pools', href: '/pools' },
    { name: 'Blocks', href: '/blocks' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Guide', href: '/guide' },
];

export function Header() {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/logo/logo.png"
                            alt="VIDDHANA POOL Logo"
                            width={40}
                            height={40}
                            className="object-contain"
                        />
                        <span className="font-bold text-lg hidden sm:block">
              <span className="text-accent">VIDDHANA</span>{' '}
                            <span className="text-foreground">POOL</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {guestNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'text-accent bg-accent/10'
                                            : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                                    )}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="hidden sm:flex">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <WalletConnect />

                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden py-4 border-t border-white/5">
                        {guestNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        'block px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'text-accent bg-accent/10'
                                            : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                                    )}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </div>
        </header>
    );
}