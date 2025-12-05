import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format hashrate with appropriate unit
 */
export function formatHashrate(hashrate: number): string {
  if (hashrate === 0) return '0 H/s';

  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  let unitIndex = 0;
  let value = hashrate;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format currency value
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  decimals: number = 2
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format crypto amount
 */
export function formatCrypto(value: number, symbol: string = 'BTC', decimals: number = 8): string {
  return `${value.toFixed(decimals)} ${symbol}`;
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (value === 0) return '0';

  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const tier = Math.floor(Math.log10(Math.abs(value)) / 3);

  if (tier === 0) return value.toFixed(decimals);

  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = value / scale;

  return `${scaled.toFixed(decimals)}${suffix}`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return target.toLocaleDateString();
}

/**
 * Truncate wallet address
 */
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Delay utility for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}
