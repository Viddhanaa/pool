import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VIDDHANA POOL | Next-Gen Mining',
  description: 'Next-generation mining powered by AI optimization and Layer 3 instant payouts',
  keywords: ['mining', 'pool', 'cryptocurrency', 'AI', 'blockchain'],
  authors: [{ name: 'VIDDHANA POOL' }],
  openGraph: {
    title: 'VIDDHANA POOL | Next-Gen Mining',
    description: 'Next-generation mining powered by AI optimization and Layer 3 instant payouts',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
