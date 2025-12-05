/**
 * Formatting utilities for display values
 */

// =============================================================================
// Hashrate Formatting
// =============================================================================

/**
 * Hash unit definitions with their multipliers
 */
const HASH_UNITS = [
  { unit: "H/s", multiplier: 1 },
  { unit: "KH/s", multiplier: 1e3 },
  { unit: "MH/s", multiplier: 1e6 },
  { unit: "GH/s", multiplier: 1e9 },
  { unit: "TH/s", multiplier: 1e12 },
  { unit: "PH/s", multiplier: 1e15 },
  { unit: "EH/s", multiplier: 1e18 },
] as const;

export type HashUnit = (typeof HASH_UNITS)[number]["unit"];

/**
 * Format hashrate to human-readable string
 *
 * @param hashrate - Hashrate in H/s
 * @param decimals - Number of decimal places (default: 2)
 * @param targetUnit - Force a specific unit (optional)
 * @returns Formatted hashrate string (e.g., "1.23 TH/s")
 *
 * @example
 * formatHashrate(1234567890123) // "1.23 TH/s"
 * formatHashrate(1500000000, 3) // "1.500 GH/s"
 * formatHashrate(1500000000, 2, "MH/s") // "1500.00 MH/s"
 */
export function formatHashrate(
  hashrate: number,
  decimals = 2,
  targetUnit?: HashUnit
): string {
  if (hashrate === 0) return `0 H/s`;
  if (!Number.isFinite(hashrate)) return "N/A";

  // If target unit specified, use it
  if (targetUnit) {
    const unit = HASH_UNITS.find((u) => u.unit === targetUnit);
    if (unit) {
      const value = hashrate / unit.multiplier;
      return `${value.toFixed(decimals)} ${unit.unit}`;
    }
  }

  // Find appropriate unit automatically
  for (let i = HASH_UNITS.length - 1; i >= 0; i--) {
    const unit = HASH_UNITS[i]!;
    if (hashrate >= unit.multiplier) {
      const value = hashrate / unit.multiplier;
      return `${value.toFixed(decimals)} ${unit.unit}`;
    }
  }

  return `${hashrate.toFixed(decimals)} H/s`;
}

/**
 * Parse hashrate string back to H/s
 *
 * @param hashrateStr - Formatted hashrate string (e.g., "1.23 TH/s")
 * @returns Hashrate in H/s
 */
export function parseHashrate(hashrateStr: string): number {
  const match = hashrateStr.match(/^([\d.]+)\s*(\w+\/s)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]!);
  const unit = match[2] as HashUnit;

  const unitDef = HASH_UNITS.find((u) => u.unit === unit);
  if (!unitDef) return 0;

  return value * unitDef.multiplier;
}

// =============================================================================
// Currency Formatting
// =============================================================================

/**
 * Supported currencies
 */
export type Currency = "USD" | "EUR" | "GBP" | "JPY" | "ETH";

/**
 * Currency configuration
 */
const CURRENCY_CONFIG: Record<Currency, { symbol: string; decimals: number }> = {
  USD: { symbol: "$", decimals: 2 },
  EUR: { symbol: "€", decimals: 2 },
  GBP: { symbol: "£", decimals: 2 },
  JPY: { symbol: "¥", decimals: 0 },
  ETH: { symbol: "Ξ", decimals: 6 },
};

/**
 * Format currency value
 *
 * @param amount - Amount to format
 * @param currency - Currency type
 * @param options - Additional formatting options
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234.56, "USD") // "$1,234.56"
 * formatCurrency(0.000123, "ETH") // "Ξ0.000123"
 */
export function formatCurrency(
  amount: number | string,
  currency: Currency = "USD",
  options: { compact?: boolean; showSymbol?: boolean } = {}
): string {
  const { compact = false, showSymbol = true } = options;
  const config = CURRENCY_CONFIG[currency];
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (!Number.isFinite(numAmount)) return "N/A";

  let formatted: string;

  if (compact && Math.abs(numAmount) >= 1000) {
    const units = ["", "K", "M", "B", "T"];
    let unitIndex = 0;
    let scaledAmount = numAmount;

    while (Math.abs(scaledAmount) >= 1000 && unitIndex < units.length - 1) {
      scaledAmount /= 1000;
      unitIndex++;
    }

    formatted = `${scaledAmount.toFixed(2)}${units[unitIndex]}`;
  } else {
    formatted = numAmount.toLocaleString("en-US", {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    });
  }

  return showSymbol ? `${config.symbol}${formatted}` : formatted;
}

/**
 * Format wei value to ETH
 *
 * @param wei - Amount in wei (as string or bigint)
 * @param decimals - Number of decimal places (default: 6)
 * @returns Formatted ETH string
 *
 * @example
 * formatWei("1000000000000000000") // "1.000000 ETH"
 * formatWei(BigInt("500000000000000000"), 4) // "0.5000 ETH"
 */
export function formatWei(wei: string | bigint, decimals = 6): string {
  const weiBigInt = typeof wei === "string" ? BigInt(wei) : wei;
  const eth = Number(weiBigInt) / 1e18;
  return `${eth.toFixed(decimals)} ETH`;
}

/**
 * Convert ETH to wei
 *
 * @param eth - Amount in ETH
 * @returns Amount in wei as string
 */
export function ethToWei(eth: number | string): string {
  const ethNum = typeof eth === "string" ? parseFloat(eth) : eth;
  return (BigInt(Math.floor(ethNum * 1e18))).toString();
}

// =============================================================================
// Address Formatting
// =============================================================================

/**
 * Format Ethereum address with ellipsis
 *
 * @param address - Full Ethereum address
 * @param startChars - Characters to show at start (default: 6)
 * @param endChars - Characters to show at end (default: 4)
 * @returns Truncated address (e.g., "0x742d...1e3B")
 *
 * @example
 * formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f1e3B1") // "0x742d...1e3B"
 * formatAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f1e3B1", 10, 8) // "0x742d35Cc...95f1e3B1"
 */
export function formatAddress(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (!address || address.length < startChars + endChars) {
    return address || "";
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Check if address is valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Checksum an Ethereum address
 *
 * @param address - Ethereum address
 * @returns Checksummed address
 */
export function checksumAddress(address: string): string {
  // This is a simplified version - for production, use ethers or viem
  if (!isValidAddress(address)) return address;
  return address; // In production, implement proper checksum
}

// =============================================================================
// Date/Time Formatting
// =============================================================================

/**
 * Format date to readable string
 *
 * @param date - Date to format
 * @param format - Format type
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(), "short") // "Dec 4, 2024"
 * formatDate(new Date(), "long") // "December 4, 2024 at 3:30 PM"
 * formatDate(new Date(), "relative") // "2 hours ago"
 */
export function formatDate(
  date: Date | string | number,
  format: "short" | "long" | "time" | "iso" | "relative" = "short"
): string {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return "Invalid date";

  switch (format) {
    case "short":
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "long":
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    case "time":
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    case "iso":
      return d.toISOString();
    case "relative":
      return formatRelativeTime(d);
    default:
      return d.toLocaleDateString();
  }
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 0) return "in the future";
  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

// =============================================================================
// Number Formatting
// =============================================================================

/**
 * Format number with thousands separators
 *
 * @param num - Number to format
 * @param options - Formatting options
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234567.89, { decimals: 2 }) // "1,234,567.89"
 * formatNumber(1234567, { compact: true }) // "1.23M"
 */
export function formatNumber(
  num: number,
  options: { decimals?: number; compact?: boolean } = {}
): string {
  const { decimals, compact = false } = options;

  if (!Number.isFinite(num)) return "N/A";

  if (compact) {
    const units = ["", "K", "M", "B", "T"];
    let unitIndex = 0;
    let scaledNum = num;

    while (Math.abs(scaledNum) >= 1000 && unitIndex < units.length - 1) {
      scaledNum /= 1000;
      unitIndex++;
    }

    return `${scaledNum.toFixed(decimals ?? 2)}${units[unitIndex]}`;
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 *
 * @param value - Value to format as percentage (0-100 or 0-1)
 * @param options - Formatting options
 * @returns Formatted percentage string
 *
 * @example
 * formatPercent(75) // "75%"
 * formatPercent(0.75, { isDecimal: true }) // "75%"
 * formatPercent(75.5, { decimals: 1 }) // "75.5%"
 */
export function formatPercent(
  value: number,
  options: { decimals?: number; isDecimal?: boolean; showSign?: boolean } = {}
): string {
  const { decimals = 0, isDecimal = false, showSign = false } = options;

  if (!Number.isFinite(value)) return "N/A";

  const percent = isDecimal ? value * 100 : value;
  const sign = showSign && percent > 0 ? "+" : "";

  return `${sign}${percent.toFixed(decimals)}%`;
}

// =============================================================================
// Duration Formatting
// =============================================================================

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @param format - Format type
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(3661) // "1h 1m 1s"
 * formatDuration(3661, "long") // "1 hour, 1 minute, 1 second"
 * formatDuration(86400) // "1d 0h 0m"
 */
export function formatDuration(
  seconds: number,
  format: "short" | "long" | "compact" = "short"
): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "N/A";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  switch (format) {
    case "compact":
      if (days > 0) return `${days}d`;
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return `${secs}s`;

    case "long": {
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
      if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
      if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
      if (secs > 0 || parts.length === 0) {
        parts.push(`${secs} second${secs === 1 ? "" : "s"}`);
      }
      return parts.join(", ");
    }

    case "short":
    default:
      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
      if (minutes > 0) return `${minutes}m ${secs}s`;
      return `${secs}s`;
  }
}

/**
 * Format uptime as percentage
 *
 * @param uptimeSeconds - Uptime in seconds
 * @param totalSeconds - Total period in seconds
 * @returns Formatted uptime percentage
 */
export function formatUptime(uptimeSeconds: number, totalSeconds: number): string {
  if (totalSeconds === 0) return "N/A";
  const percentage = (uptimeSeconds / totalSeconds) * 100;
  return formatPercent(percentage, { decimals: 2 });
}
