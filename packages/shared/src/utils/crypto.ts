/**
 * Cryptographic utilities for wallet authentication and security
 *
 * Note: This module provides lightweight crypto utilities that work in both
 * browser and Node.js environments. For full Ethereum signature verification,
 * use ethers.js or viem on the backend.
 */

// =============================================================================
// Nonce Generation
// =============================================================================

/**
 * Generate a cryptographically secure random nonce
 *
 * @param length - Length of the nonce in bytes (default: 32)
 * @returns Hex-encoded nonce string
 *
 * @example
 * const nonce = generateNonce(); // "a1b2c3d4e5f6..."
 * const shortNonce = generateNonce(16);
 */
export function generateNonce(length = 32): string {
  // Use crypto API available in both browser and Node.js
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback for older environments (less secure)
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return result;
}

/**
 * Generate a unique request ID
 *
 * @returns UUID-like string
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = generateNonce(8);
  return `${timestamp}-${randomPart}`;
}

// =============================================================================
// Message Hashing
// =============================================================================

/**
 * Hash a message using SHA-256
 *
 * @param message - Message to hash
 * @returns Promise resolving to hex-encoded hash
 *
 * @example
 * const hash = await hashMessage("Hello, World!");
 */
export async function hashMessage(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Web Crypto API not available");
}

/**
 * Hash message synchronously using a simple algorithm
 * Note: Use hashMessage for cryptographic purposes
 *
 * @param message - Message to hash
 * @returns Simple hash string
 */
export function simpleHash(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// Signature Verification
// =============================================================================

/**
 * Ethereum signature components
 */
export interface SignatureComponents {
  r: string;
  s: string;
  v: number;
}

/**
 * Parse an Ethereum signature into its components
 *
 * @param signature - Full signature hex string
 * @returns Signature components (r, s, v)
 *
 * @example
 * const { r, s, v } = parseSignature("0x...");
 */
export function parseSignature(signature: string): SignatureComponents {
  // Remove 0x prefix if present
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (sig.length !== 130) {
    throw new Error("Invalid signature length");
  }

  const r = "0x" + sig.slice(0, 64);
  const s = "0x" + sig.slice(64, 128);
  let v = parseInt(sig.slice(128, 130), 16);

  // Handle legacy v values
  if (v < 27) {
    v += 27;
  }

  return { r, s, v };
}

/**
 * Verify an Ethereum signature (client-side pre-validation)
 *
 * Note: Full verification should be done server-side using ethers.js or viem.
 * This function only performs basic format validation.
 *
 * @param message - Original message that was signed
 * @param signature - Signature hex string
 * @param address - Expected signer address
 * @returns Basic validation result
 */
export function validateSignatureFormat(
  message: string,
  signature: string,
  address: string
): { valid: boolean; error?: string } {
  // Validate message
  if (!message || typeof message !== "string") {
    return { valid: false, error: "Message is required" };
  }

  // Validate signature format
  if (!signature || typeof signature !== "string") {
    return { valid: false, error: "Signature is required" };
  }

  const cleanSig = signature.startsWith("0x") ? signature : `0x${signature}`;
  if (!/^0x[a-fA-F0-9]{130}$/.test(cleanSig)) {
    return { valid: false, error: "Invalid signature format" };
  }

  // Validate address format
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Address is required" };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { valid: false, error: "Invalid address format" };
  }

  // Try parsing signature components
  try {
    const { v } = parseSignature(cleanSig);
    if (v !== 27 && v !== 28) {
      return { valid: false, error: "Invalid recovery id" };
    }
  } catch {
    return { valid: false, error: "Failed to parse signature" };
  }

  return { valid: true };
}

/**
 * Create the message to be signed for authentication
 *
 * @param params - Message parameters
 * @returns Formatted message string
 */
export function createAuthMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt?: Date;
  expiresAt?: Date;
  statement?: string;
}): string {
  const {
    domain,
    address,
    nonce,
    issuedAt = new Date(),
    expiresAt,
    statement = "Sign this message to authenticate with Viddhana Pool",
  } = params;

  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: https://${domain}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ];

  if (expiresAt) {
    lines.push(`Expiration Time: ${expiresAt.toISOString()}`);
  }

  return lines.join("\n");
}

// =============================================================================
// Hex Utilities
// =============================================================================

/**
 * Convert bytes to hex string
 *
 * @param bytes - Uint8Array of bytes
 * @returns Hex string with 0x prefix
 */
export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Convert hex string to bytes
 *
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array of bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Check if string is valid hex
 *
 * @param value - String to check
 * @param requirePrefix - Whether 0x prefix is required
 * @returns True if valid hex
 */
export function isHex(value: string, requirePrefix = false): boolean {
  if (typeof value !== "string") return false;

  if (requirePrefix) {
    return /^0x[a-fA-F0-9]*$/.test(value);
  }

  return /^(0x)?[a-fA-F0-9]*$/.test(value);
}

/**
 * Pad hex string to specified length
 *
 * @param hex - Hex string to pad
 * @param length - Target length in bytes
 * @param direction - Pad left or right
 * @returns Padded hex string
 */
export function padHex(
  hex: string,
  length: number,
  direction: "left" | "right" = "left"
): string {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const targetLength = length * 2; // 2 hex chars per byte

  if (cleanHex.length >= targetLength) {
    return "0x" + cleanHex;
  }

  const padding = "0".repeat(targetLength - cleanHex.length);

  if (direction === "left") {
    return "0x" + padding + cleanHex;
  } else {
    return "0x" + cleanHex + padding;
  }
}

// =============================================================================
// Keccak256 (for Ethereum)
// =============================================================================

/**
 * Note: For actual Keccak256 hashing used in Ethereum, use a library like
 * ethers.js or viem. This is a placeholder that indicates where Keccak256
 * would be used.
 *
 * @param _data - Data to hash
 * @returns Placeholder - implement with crypto library
 */
export function keccak256Placeholder(_data: string | Uint8Array): string {
  throw new Error(
    "Keccak256 requires a crypto library. Use ethers.js keccak256 or viem's keccak256."
  );
}
