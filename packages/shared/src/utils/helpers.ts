/**
 * General helper functions for common operations
 */

// =============================================================================
// Async Helpers
// =============================================================================

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 *
 * @example
 * await sleep(1000); // Wait 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 (default: 0.1) */
  jitter?: number;
  /** Custom retry condition */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of the function
 *
 * @example
 * const result = await retry(
 *   async () => fetchData(),
 *   { maxAttempts: 5, initialDelay: 1000 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = 0.1,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with jitter
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      const actualDelay = Math.min(delay + jitterAmount, maxDelay);

      onRetry?.(error, attempt, actualDelay);

      await sleep(actualDelay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

// =============================================================================
// Array Helpers
// =============================================================================

/**
 * Split array into chunks of specified size
 *
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 *
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be positive");

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get unique values from an array
 *
 * @param array - Array with potential duplicates
 * @param keyFn - Optional key function for complex objects
 * @returns Array with unique values
 *
 * @example
 * unique([1, 2, 2, 3]) // [1, 2, 3]
 * unique(users, u => u.id) // unique by id
 */
export function unique<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }

  const seen = new Set<unknown>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Group array items by a key
 *
 * @param array - Array to group
 * @param keyFn - Function to get group key
 * @returns Object with grouped items
 *
 * @example
 * groupBy(users, u => u.role) // { admin: [...], user: [...] }
 */
export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Sort array by multiple criteria
 *
 * @param array - Array to sort
 * @param comparators - Array of comparator functions
 * @returns Sorted array (new array, doesn't mutate)
 */
export function sortBy<T>(
  array: T[],
  ...comparators: ((a: T, b: T) => number)[]
): T[] {
  return [...array].sort((a, b) => {
    for (const comparator of comparators) {
      const result = comparator(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

// =============================================================================
// Function Helpers
// =============================================================================

/**
 * Debounce a function
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce(search, 300);
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in ms
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = throttle(onScroll, 100);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Memoize a function
 *
 * @param fn - Function to memoize
 * @param keyFn - Optional function to generate cache key
 * @returns Memoized function
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return function (this: unknown, ...args: Parameters<T>) {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  } as T;
}

// =============================================================================
// Object Helpers
// =============================================================================

/**
 * Deep clone an object
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as T;
  if (typeof obj === "object") {
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Deep merge objects
 *
 * @param target - Target object
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target;

  const result = deepClone(target);

  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const targetValue = result[key];
        const sourceValue = source[key];

        if (
          typeof targetValue === "object" &&
          targetValue !== null &&
          typeof sourceValue === "object" &&
          sourceValue !== null &&
          !Array.isArray(targetValue) &&
          !Array.isArray(sourceValue)
        ) {
          (result as Record<string, unknown>)[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          );
        } else {
          (result as Record<string, unknown>)[key] = deepClone(sourceValue);
        }
      }
    }
  }

  return result;
}

/**
 * Pick specific keys from an object
 *
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with only picked keys
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 *
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without omitted keys
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

// =============================================================================
// String Helpers
// =============================================================================

/**
 * Generate a random string
 *
 * @param length - Length of the string
 * @param charset - Character set to use
 * @returns Random string
 */
export function randomString(
  length: number,
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Truncate string with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Ellipsis string (default: "...")
 * @returns Truncated string
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis = "..."
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Convert string to slug
 *
 * @param str - String to slugify
 * @returns URL-friendly slug
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (isNullish(value)) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Assert a condition and throw if false
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
