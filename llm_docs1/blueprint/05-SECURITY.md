# VIDDHANA POOL - Security Implementation Guide

> **Document ID:** 05-SECURITY  
> **Priority:** P0 - Critical  
> **Dependencies:** 01-INFRASTRUCTURE, 04-BLOCKCHAIN

---

## Table of Contents
1. [Overview](#1-overview)
2. [Zero-Trust Architecture](#2-zero-trust-architecture)
3. [Authentication System](#3-authentication-system)
4. [Two-Factor Authentication](#4-two-factor-authentication)
5. [API Security](#5-api-security)
6. [DDoS Protection](#6-ddos-protection)
7. [Payout Protection](#7-payout-protection)
8. [Notification System](#8-notification-system)
9. [Security Monitoring](#9-security-monitoring)
10. [Audit Checklist](#10-audit-checklist)

---

## 1. Overview

VIDDHANA POOL implements a **Zero-Trust Security Architecture** with:
- Multi-layer authentication (Web3 + 2FA)
- Circuit Breaker AI for anomaly response
- Multi-sig wallets for fund protection
- Enterprise-grade DDoS protection
- Comprehensive audit logging

---

## 2. Zero-Trust Architecture

### 2.1 Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZERO-TRUST SECURITY MODEL                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Never Trust, Always Verify                                  │
│     - Every request authenticated                               │
│     - Every action authorized                                   │
│     - Every connection encrypted                                │
│                                                                 │
│  2. Least Privilege Access                                      │
│     - Minimal permissions by default                            │
│     - Role-based access control (RBAC)                          │
│     - Time-limited sessions                                     │
│                                                                 │
│  3. Assume Breach                                               │
│     - Segment networks                                          │
│     - Encrypt data at rest                                      │
│     - Monitor all activity                                      │
│                                                                 │
│  4. Verify Explicitly                                           │
│     - Multi-factor authentication                               │
│     - Device verification                                       │
│     - Continuous validation                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Security Layers

| Layer | Protection | Implementation |
|-------|------------|----------------|
| Network | DDoS, WAF | Cloudflare Enterprise |
| Transport | TLS 1.3 | nginx/HAProxy |
| Application | Auth, RBAC | JWT + 2FA |
| Data | Encryption | AES-256, bcrypt |
| Infrastructure | Isolation | Docker, K8s namespaces |

---

## 3. Authentication System

### 3.1 Web3 Wallet Authentication

**File: `apps/api/src/services/auth.service.ts`**

```typescript
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

interface AuthResult {
  user: {
    id: string;
    walletAddress: string;
    email?: string;
    twoFactorEnabled: boolean;
  };
  token: string;
  refreshToken: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private redis: Redis;
  
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_EXPIRES_IN = '15m';
  private readonly REFRESH_EXPIRES_IN = '7d';
  
  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }
  
  /**
   * Authenticate user with Web3 wallet signature
   */
  async authenticateWithWallet(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<AuthResult> {
    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Invalid signature');
    }
    
    // Verify message timestamp (prevent replay attacks)
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[1]);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (Math.abs(now - timestamp) > fiveMinutes) {
        throw new Error('Signature expired');
      }
    }
    
    // Check if signature was already used (nonce)
    const signatureKey = `auth:signature:${signature}`;
    const used = await this.redis.get(signatureKey);
    if (used) {
      throw new Error('Signature already used');
    }
    
    // Mark signature as used
    await this.redis.setex(signatureKey, 600, '1'); // 10 minute expiry
    
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
        },
      });
    }
    
    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      // Return partial auth, require 2FA
      const partialToken = jwt.sign(
        { userId: user.id, require2FA: true },
        this.JWT_SECRET,
        { expiresIn: '5m' }
      );
      
      return {
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email || undefined,
          twoFactorEnabled: true,
        },
        token: partialToken,
        refreshToken: '',
      };
    }
    
    // Generate tokens
    return this.generateTokens(user);
  }
  
  /**
   * Authenticate with email/password
   */
  async authenticateWithEmail(
    email: string,
    password: string,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Track failed attempts
      await this.trackFailedAttempt(email);
      throw new Error('Invalid credentials');
    }
    
    // Check if account is locked
    const isLocked = await this.isAccountLocked(email);
    if (isLocked) {
      throw new Error('Account temporarily locked. Try again later.');
    }
    
    // Clear failed attempts on success
    await this.clearFailedAttempts(email);
    
    if (user.twoFactorEnabled) {
      const partialToken = jwt.sign(
        { userId: user.id, require2FA: true },
        this.JWT_SECRET,
        { expiresIn: '5m' }
      );
      
      return {
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email || undefined,
          twoFactorEnabled: true,
        },
        token: partialToken,
        refreshToken: '',
      };
    }
    
    return this.generateTokens(user);
  }
  
  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: any): Promise<AuthResult> {
    const payload = {
      userId: user.id,
      walletAddress: user.walletAddress,
    };
    
    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
    
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      this.JWT_SECRET,
      { expiresIn: this.REFRESH_EXPIRES_IN }
    );
    
    // Store refresh token
    await this.redis.setex(
      `refresh:${user.id}:${refreshToken}`,
      7 * 24 * 60 * 60,
      '1'
    );
    
    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email || undefined,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token,
      refreshToken,
    };
  }
  
  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET) as {
        userId: string;
        type: string;
      };
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      // Verify refresh token exists in Redis
      const exists = await this.redis.get(
        `refresh:${decoded.userId}:${refreshToken}`
      );
      
      if (!exists) {
        throw new Error('Refresh token revoked');
      }
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const newToken = jwt.sign(
        { userId: user.id, walletAddress: user.walletAddress },
        this.JWT_SECRET,
        { expiresIn: this.JWT_EXPIRES_IN }
      );
      
      return { token: newToken };
      
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
  
  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.redis.del(`refresh:${userId}:${refreshToken}`);
  }
  
  /**
   * Revoke all sessions for user
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // Account lockout helpers
  private async trackFailedAttempt(identifier: string): Promise<void> {
    const key = `auth:failed:${identifier}`;
    const attempts = await this.redis.incr(key);
    await this.redis.expire(key, 900); // 15 minutes
    
    if (attempts >= 5) {
      await this.redis.setex(`auth:locked:${identifier}`, 900, '1');
    }
  }
  
  private async isAccountLocked(identifier: string): Promise<boolean> {
    return !!(await this.redis.get(`auth:locked:${identifier}`));
  }
  
  private async clearFailedAttempts(identifier: string): Promise<void> {
    await this.redis.del(`auth:failed:${identifier}`);
  }
}
```

### 3.2 JWT Authentication Middleware

**File: `apps/api/src/middleware/auth.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  walletAddress: string;
  require2FA?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JWTPayload;
    
    // Check if 2FA is required but not completed
    if (decoded.require2FA) {
      return reply.status(403).send({
        error: '2FA verification required',
        code: 'REQUIRE_2FA',
      });
    }
    
    request.user = decoded;
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    
    return reply.status(401).send({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
}

// Optional auth - doesn't fail if no token
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as JWTPayload;
      
      request.user = decoded;
    }
  } catch {
    // Ignore errors - user remains undefined
  }
}
```

---

## 4. Two-Factor Authentication

### 4.1 TOTP Implementation

**File: `apps/api/src/services/twoFactor.service.ts`**

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import crypto from 'crypto';

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export class TwoFactorService {
  private prisma: PrismaClient;
  private redis: Redis;
  
  private readonly ISSUER = 'VIDDHANA Pool';
  private readonly BACKUP_CODE_COUNT = 10;
  
  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }
  
  /**
   * Generate 2FA setup for user
   */
  async generateSetup(userId: string): Promise<TwoFactorSetup> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.twoFactorEnabled) {
      throw new Error('2FA already enabled');
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${this.ISSUER} (${user.walletAddress.slice(0, 8)}...)`,
      issuer: this.ISSUER,
      length: 32,
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    
    // Store pending setup (expires in 10 minutes)
    await this.redis.setex(
      `2fa:setup:${userId}`,
      600,
      JSON.stringify({
        secret: secret.base32,
        backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
      })
    );
    
    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }
  
  /**
   * Verify and enable 2FA
   */
  async enableTwoFactor(userId: string, token: string): Promise<boolean> {
    const setupData = await this.redis.get(`2fa:setup:${userId}`);
    
    if (!setupData) {
      throw new Error('2FA setup expired. Please generate a new setup.');
    }
    
    const { secret, backupCodes } = JSON.parse(setupData);
    
    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step tolerance
    });
    
    if (!isValid) {
      throw new Error('Invalid verification code');
    }
    
    // Encrypt secret before storing
    const encryptedSecret = this.encryptSecret(secret);
    
    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
        backupCodes: backupCodes,
      },
    });
    
    // Clear setup data
    await this.redis.del(`2fa:setup:${userId}`);
    
    return true;
  }
  
  /**
   * Verify 2FA token
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new Error('2FA not enabled');
    }
    
    // Check rate limiting
    const attempts = await this.redis.incr(`2fa:attempts:${userId}`);
    await this.redis.expire(`2fa:attempts:${userId}`, 300);
    
    if (attempts > 5) {
      throw new Error('Too many attempts. Please try again later.');
    }
    
    // Decrypt secret
    const secret = this.decryptSecret(user.twoFactorSecret);
    
    // Try TOTP token first
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
    
    if (isValid) {
      await this.redis.del(`2fa:attempts:${userId}`);
      return true;
    }
    
    // Try backup code
    const isBackupCode = await this.verifyBackupCode(userId, token);
    
    if (isBackupCode) {
      await this.redis.del(`2fa:attempts:${userId}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Disable 2FA
   */
  async disableTwoFactor(userId: string, token: string): Promise<boolean> {
    const isValid = await this.verifyToken(userId, token);
    
    if (!isValid) {
      throw new Error('Invalid verification code');
    }
    
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });
    
    return true;
  }
  
  // Helper methods
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    
    return codes;
  }
  
  private hashBackupCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code.replace('-', '').toUpperCase())
      .digest('hex');
  }
  
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { backupCodes: true },
    });
    
    if (!user || !user.backupCodes) {
      return false;
    }
    
    const hashedCode = this.hashBackupCode(code);
    const codeIndex = (user.backupCodes as string[]).indexOf(hashedCode);
    
    if (codeIndex === -1) {
      return false;
    }
    
    // Remove used backup code
    const updatedCodes = [...(user.backupCodes as string[])];
    updatedCodes.splice(codeIndex, 1);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { backupCodes: updatedCodes },
    });
    
    return true;
  }
  
  private encryptSecret(secret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  private decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

---

## 5. API Security

### 5.1 Rate Limiting

**File: `apps/api/src/middleware/rateLimit.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  keyGenerator?: (request: FastifyRequest) => string;
  skip?: (request: FastifyRequest) => boolean;
  handler?: (request: FastifyRequest, reply: FastifyReply) => void;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'rl:',
};

export function createRateLimiter(
  redis: Redis,
  config: Partial<RateLimitConfig> = {},
) {
  const opts = { ...defaultConfig, ...config };
  
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    // Check if should skip
    if (opts.skip && opts.skip(request)) {
      return;
    }
    
    // Generate key
    const keyGenerator = opts.keyGenerator || ((req) => req.ip);
    const identifier = keyGenerator(request);
    const key = `${opts.keyPrefix}${identifier}`;
    
    // Get current count
    const current = await redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.pexpire(key, opts.windowMs);
    }
    
    // Get TTL for headers
    const ttl = await redis.pttl(key);
    
    // Set rate limit headers
    reply.header('X-RateLimit-Limit', opts.max);
    reply.header('X-RateLimit-Remaining', Math.max(0, opts.max - current));
    reply.header('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + ttl / 1000));
    
    // Check if exceeded
    if (current > opts.max) {
      reply.header('Retry-After', Math.ceil(ttl / 1000));
      
      if (opts.handler) {
        return opts.handler(request, reply);
      }
      
      return reply.status(429).send({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(ttl / 1000),
      });
    }
  };
}

// Preset rate limiters
export const rateLimiters = {
  // Standard API rate limit
  standard: (redis: Redis) => createRateLimiter(redis, {
    windowMs: 60 * 1000,
    max: 100,
    keyPrefix: 'rl:std:',
  }),
  
  // Strict limit for auth endpoints
  auth: (redis: Redis) => createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    keyPrefix: 'rl:auth:',
  }),
  
  // Limit for sensitive operations
  sensitive: (redis: Redis) => createRateLimiter(redis, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyPrefix: 'rl:sens:',
  }),
  
  // WebSocket connection limit
  websocket: (redis: Redis) => createRateLimiter(redis, {
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'rl:ws:',
  }),
};
```

### 5.2 API Key System

**File: `apps/api/src/services/apiKey.service.ts`**

```typescript
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

interface APIKeyPermissions {
  read: boolean;
  write: boolean;
  payouts: boolean;
  workers: boolean;
}

interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: APIKeyPermissions;
  lastUsed: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export class APIKeyService {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  /**
   * Generate a new API key
   */
  async generateKey(
    userId: string,
    name: string,
    permissions: APIKeyPermissions,
    expiresInDays?: number,
  ): Promise<{ key: string; apiKey: APIKey }> {
    // Generate key components
    const prefix = 'vdh';
    const keyId = crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Full key format: vdh_keyId_secret
    const fullKey = `${prefix}_${keyId}_${secret}`;
    
    // Hash the secret for storage
    const hashedSecret = await bcrypt.hash(secret, 12);
    
    // Calculate expiry
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    
    // Store in database
    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        keyId,
        hashedSecret,
        permissions: permissions as any,
        expiresAt,
      },
    });
    
    return {
      key: fullKey,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: `${prefix}_${keyId}_****`,
        permissions: apiKey.permissions as unknown as APIKeyPermissions,
        lastUsed: apiKey.lastUsed,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      },
    };
  }
  
  /**
   * Validate API key and return user/permissions
   */
  async validateKey(fullKey: string): Promise<{
    userId: string;
    permissions: APIKeyPermissions;
  } | null> {
    // Parse key
    const parts = fullKey.split('_');
    if (parts.length !== 3 || parts[0] !== 'vdh') {
      return null;
    }
    
    const [, keyId, secret] = parts;
    
    // Find key
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyId },
    });
    
    if (!apiKey) {
      return null;
    }
    
    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }
    
    // Check if revoked
    if (apiKey.revokedAt) {
      return null;
    }
    
    // Verify secret
    const isValid = await bcrypt.compare(secret, apiKey.hashedSecret);
    if (!isValid) {
      return null;
    }
    
    // Update last used
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });
    
    return {
      userId: apiKey.userId,
      permissions: apiKey.permissions as unknown as APIKeyPermissions,
    };
  }
  
  /**
   * List user's API keys
   */
  async listKeys(userId: string): Promise<APIKey[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return keys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: `vdh_${key.keyId}_****`,
      permissions: key.permissions as unknown as APIKeyPermissions,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    }));
  }
  
  /**
   * Revoke an API key
   */
  async revokeKey(userId: string, keyId: string): Promise<boolean> {
    const result = await this.prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    
    return result.count > 0;
  }
}
```

### 5.3 API Key Middleware

**File: `apps/api/src/middleware/apiKey.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { APIKeyService } from '../services/apiKey.service';

interface APIKeyPayload {
  userId: string;
  permissions: {
    read: boolean;
    write: boolean;
    payouts: boolean;
    workers: boolean;
  };
  isAPIKey: true;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: APIKeyPayload;
  }
}

export function createAPIKeyMiddleware(apiKeyService: APIKeyService) {
  return async function apiKeyMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return; // Fall through to JWT auth
    }
    
    const result = await apiKeyService.validateKey(apiKey);
    
    if (!result) {
      return reply.status(401).send({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }
    
    request.apiKey = {
      ...result,
      isAPIKey: true,
    };
  };
}

// Permission check middleware
export function requirePermission(permission: keyof APIKeyPayload['permissions']) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (request.apiKey) {
      if (!request.apiKey.permissions[permission]) {
        return reply.status(403).send({
          error: `API key lacks '${permission}' permission`,
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
    }
  };
}
```

### 5.4 Security Headers

**File: `apps/api/src/middleware/securityHeaders.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export async function securityHeadersMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  reply.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss:;"
  );
  
  // Strict Transport Security (HSTS)
  reply.header(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Permissions Policy
  reply.header(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
}
```

---

## 6. DDoS Protection

### 6.1 Cloudflare Configuration

```yaml
# cloudflare-config.yaml
security_level: high
challenge_ttl: 3600

firewall_rules:
  - name: "Block Bad Bots"
    expression: "(cf.client.bot) and not (cf.client.bot)"
    action: block
    
  - name: "Rate Limit API"
    expression: "(http.request.uri.path contains \"/api/\")"
    action: challenge
    
  - name: "Block Known Attack Patterns"
    expression: |
      (http.request.uri.query contains "UNION SELECT") or
      (http.request.uri.query contains "DROP TABLE") or
      (http.request.uri.query contains "<script>")
    action: block

rate_limiting:
  - name: "API Endpoints"
    expression: "(http.request.uri.path matches \"^/api/\")"
    characteristics:
      - cf.colo.id
      - ip.src
    period: 60
    requests_per_period: 100
    action: challenge
    
  - name: "Auth Endpoints"
    expression: "(http.request.uri.path matches \"^/api/v1/auth/\")"
    characteristics:
      - ip.src
    period: 300
    requests_per_period: 10
    action: block

waf_rules:
  - package: OWASP
    enabled: true
    sensitivity: high
```

### 6.2 Application-Level Protection

**File: `apps/api/src/middleware/ddosProtection.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';

interface DDoSConfig {
  requestsPerSecond: number;
  burstLimit: number;
  blockDuration: number;
}

export function createDDoSProtection(redis: Redis, config: DDoSConfig) {
  return async function ddosMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const ip = request.ip;
    const now = Date.now();
    const windowKey = `ddos:window:${ip}`;
    const blockKey = `ddos:block:${ip}`;
    
    // Check if IP is blocked
    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
      return reply.status(429).send({
        error: 'Too many requests. Please try again later.',
        code: 'IP_BLOCKED',
        retryAfter: await redis.ttl(blockKey),
      });
    }
    
    // Sliding window rate limiting
    const windowStart = now - 1000;
    
    // Add current request
    await redis.zadd(windowKey, now, `${now}:${Math.random()}`);
    
    // Remove old entries
    await redis.zremrangebyscore(windowKey, 0, windowStart);
    
    // Set expiry
    await redis.expire(windowKey, 60);
    
    // Count requests in window
    const requestCount = await redis.zcard(windowKey);
    
    // Check burst limit
    if (requestCount > config.burstLimit) {
      // Block IP
      await redis.setex(blockKey, config.blockDuration, '1');
      
      // Log potential attack
      console.warn(`DDoS protection triggered for IP: ${ip}`);
      
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        code: 'DDOS_PROTECTION',
      });
    }
    
    // Check sustained rate
    if (requestCount > config.requestsPerSecond * 2) {
      reply.header('X-RateLimit-Warning', 'true');
    }
  };
}
```

---

## 7. Payout Protection

### 7.1 Multi-Sig Integration

See `04-BLOCKCHAIN.md` for multi-sig wallet implementation.

### 7.2 Circuit Breaker Integration

**File: `apps/api/src/services/payoutSecurity.service.ts`**

```typescript
import { Redis } from 'ioredis';
import { SentinelAI } from '@viddhana/ai-models';

interface PayoutSecurityConfig {
  maxPayoutPerHour: bigint;
  maxPayoutPerDay: bigint;
  suspiciousThreshold: number;
  requireApprovalAbove: bigint;
}

export class PayoutSecurityService {
  private redis: Redis;
  private sentinelAI: SentinelAI;
  private config: PayoutSecurityConfig;
  
  constructor(
    redis: Redis,
    sentinelAI: SentinelAI,
    config: PayoutSecurityConfig,
  ) {
    this.redis = redis;
    this.sentinelAI = sentinelAI;
    this.config = config;
  }
  
  /**
   * Validate payout before processing
   */
  async validatePayout(
    userId: string,
    amount: bigint,
    walletAddress: string,
  ): Promise<{
    approved: boolean;
    requiresManualApproval: boolean;
    reason?: string;
  }> {
    // Check circuit breaker
    const circuitOpen = await this.redis.get('circuit:payouts');
    if (circuitOpen) {
      return {
        approved: false,
        requiresManualApproval: false,
        reason: 'Payouts temporarily suspended',
      };
    }
    
    // Check hourly limit
    const hourlyTotal = await this.getHourlyTotal();
    if (hourlyTotal + amount > this.config.maxPayoutPerHour) {
      return {
        approved: false,
        requiresManualApproval: true,
        reason: 'Hourly payout limit reached',
      };
    }
    
    // Check daily limit
    const dailyTotal = await this.getDailyTotal();
    if (dailyTotal + amount > this.config.maxPayoutPerDay) {
      return {
        approved: false,
        requiresManualApproval: true,
        reason: 'Daily payout limit reached',
      };
    }
    
    // Check if amount requires manual approval
    if (amount > this.config.requireApprovalAbove) {
      return {
        approved: false,
        requiresManualApproval: true,
        reason: 'Large payout requires manual approval',
      };
    }
    
    // Run AI anomaly detection
    const anomalyScore = await this.checkAnomaly(userId, amount, walletAddress);
    
    if (anomalyScore > this.config.suspiciousThreshold) {
      // Trigger alert
      await this.triggerAlert(userId, amount, anomalyScore);
      
      return {
        approved: false,
        requiresManualApproval: true,
        reason: 'Suspicious activity detected',
      };
    }
    
    return {
      approved: true,
      requiresManualApproval: false,
    };
  }
  
  /**
   * Check for anomalies using Sentinel AI
   */
  private async checkAnomaly(
    userId: string,
    amount: bigint,
    walletAddress: string,
  ): Promise<number> {
    // Get user history
    const history = await this.getUserPayoutHistory(userId);
    
    const result = await this.sentinelAI.detect({
      payout_amount: Number(amount),
      time_since_last_payout: history.timeSinceLastPayout,
      average_payout: history.averagePayout,
      payout_frequency: history.frequency,
      wallet_age: 0, // Would check on-chain
      unique_workers: history.workerCount,
    });
    
    return result.ensemble_score;
  }
  
  /**
   * Trigger circuit breaker
   */
  async triggerCircuitBreaker(reason: string): Promise<void> {
    await this.redis.setex('circuit:payouts', 3600, reason);
    
    // Notify admins
    // await notificationService.sendAlert('circuit_breaker', { reason });
  }
  
  /**
   * Reset circuit breaker
   */
  async resetCircuitBreaker(): Promise<void> {
    await this.redis.del('circuit:payouts');
  }
  
  // Helper methods
  private async getHourlyTotal(): Promise<bigint> {
    const total = await this.redis.get('payouts:hourly:total');
    return BigInt(total || '0');
  }
  
  private async getDailyTotal(): Promise<bigint> {
    const total = await this.redis.get('payouts:daily:total');
    return BigInt(total || '0');
  }
  
  private async getUserPayoutHistory(userId: string) {
    // Fetch from database
    return {
      timeSinceLastPayout: 0,
      averagePayout: 0,
      frequency: 0,
      workerCount: 0,
    };
  }
  
  private async triggerAlert(
    userId: string,
    amount: bigint,
    score: number,
  ): Promise<void> {
    console.warn('Suspicious payout detected', { userId, amount: amount.toString(), score });
    // Send notifications
  }
}
```

---

## 8. Notification System

### 8.1 Notification Service

**File: `apps/api/src/services/notification.service.ts`**

```typescript
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';

type NotificationType = 
  | 'worker_offline'
  | 'payment_sent'
  | 'security_alert'
  | 'block_found';

interface NotificationChannels {
  email?: boolean;
  sms?: boolean;
  telegram?: boolean;
}

export class NotificationService {
  private prisma: PrismaClient;
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: twilio.Twilio;
  private telegramBot: Telegraf;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Initialize email
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    // Initialize Twilio
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Initialize Telegram
    this.telegramBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
  }
  
  /**
   * Send notification to user
   */
  async notify(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
  ): Promise<void> {
    // Get user preferences
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { notificationSettings: true },
    });
    
    if (!user) return;
    
    const settings = user.notificationSettings;
    const channels = this.getEnabledChannels(settings, type);
    
    const message = this.formatMessage(type, data);
    
    // Send to enabled channels
    const promises: Promise<void>[] = [];
    
    if (channels.email && user.email) {
      promises.push(this.sendEmail(user.email, message));
    }
    
    if (channels.sms && settings?.phoneNumber) {
      promises.push(this.sendSMS(settings.phoneNumber, message));
    }
    
    if (channels.telegram && settings?.telegramChatId) {
      promises.push(this.sendTelegram(settings.telegramChatId, message));
    }
    
    await Promise.allSettled(promises);
  }
  
  private getEnabledChannels(
    settings: any,
    type: NotificationType,
  ): NotificationChannels {
    if (!settings) {
      return { email: true }; // Default to email only
    }
    
    const typeSettings = settings[type] || {};
    
    return {
      email: typeSettings.email ?? true,
      sms: typeSettings.sms ?? false,
      telegram: typeSettings.telegram ?? false,
    };
  }
  
  private formatMessage(
    type: NotificationType,
    data: Record<string, any>,
  ): { subject: string; body: string } {
    const templates: Record<NotificationType, (data: any) => { subject: string; body: string }> = {
      worker_offline: (d) => ({
        subject: `Worker Offline: ${d.workerName}`,
        body: `Your worker "${d.workerName}" has been offline since ${d.offlineSince}. Last hashrate: ${d.lastHashrate}`,
      }),
      payment_sent: (d) => ({
        subject: `Payment Sent: ${d.amount} ATL`,
        body: `Your payout of ${d.amount} ATL has been sent. Transaction: ${d.txHash}`,
      }),
      security_alert: (d) => ({
        subject: `Security Alert: ${d.alertType}`,
        body: `A security event was detected on your account: ${d.description}. Time: ${d.timestamp}`,
      }),
      block_found: (d) => ({
        subject: `Block Found! Height: ${d.blockHeight}`,
        body: `Congratulations! Your worker contributed to finding block ${d.blockHeight}. Reward: ${d.reward} ATL`,
      }),
    };
    
    return templates[type](data);
  }
  
  private async sendEmail(
    to: string,
    message: { subject: string; body: string },
  ): Promise<void> {
    await this.emailTransporter.sendMail({
      from: '"VIDDHANA Pool" <notifications@viddhana.io>',
      to,
      subject: message.subject,
      text: message.body,
      html: this.formatEmailHTML(message),
    });
  }
  
  private async sendSMS(
    to: string,
    message: { subject: string; body: string },
  ): Promise<void> {
    await this.twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body: `[VIDDHANA] ${message.subject}: ${message.body}`.substring(0, 160),
    });
  }
  
  private async sendTelegram(
    chatId: string,
    message: { subject: string; body: string },
  ): Promise<void> {
    await this.telegramBot.telegram.sendMessage(
      chatId,
      `*${message.subject}*\n\n${message.body}`,
      { parse_mode: 'Markdown' }
    );
  }
  
  private formatEmailHTML(message: { subject: string; body: string }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #0A0A0F; color: #fff; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { color: #00FFFF; font-size: 24px; margin-bottom: 20px; }
            .content { line-height: 1.6; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">VIDDHANA Pool</div>
            <div class="content">
              <h2>${message.subject}</h2>
              <p>${message.body}</p>
            </div>
            <div class="footer">
              This is an automated notification from VIDDHANA Pool.
              <br>To manage notifications, visit your dashboard settings.
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
```

---

## 9. Security Monitoring

### 9.1 Audit Logging

**File: `apps/api/src/services/auditLog.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'payout.requested'
  | 'payout.processed'
  | 'payout.failed'
  | 'worker.created'
  | 'worker.deleted'
  | 'settings.updated'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'security.suspicious_activity';

interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  success: boolean;
}

export class AuditLogService {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details || {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        success: entry.success,
        timestamp: new Date(),
      },
    });
  }
  
  async getLogsForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      actions?: AuditAction[];
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const { limit = 50, offset = 0, actions, startDate, endDate } = options;
    
    return this.prisma.auditLog.findMany({
      where: {
        userId,
        ...(actions && { action: { in: actions } }),
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  }
  
  async getSecurityEvents(
    options: {
      limit?: number;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    } = {},
  ) {
    const securityActions: AuditAction[] = [
      'auth.failed_login',
      'security.suspicious_activity',
      'payout.failed',
    ];
    
    return this.prisma.auditLog.findMany({
      where: {
        action: { in: securityActions },
        success: false,
      },
      orderBy: { timestamp: 'desc' },
      take: options.limit || 100,
    });
  }
}
```

---

## 10. Audit Checklist

### 10.1 Pre-Launch Security Checklist

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| **Authentication** | | | |
| | JWT secret is cryptographically random (256+ bits) | [ ] | |
| | Token expiry is configured (15min access, 7d refresh) | [ ] | |
| | Refresh token rotation implemented | [ ] | |
| | Session invalidation on password change | [ ] | |
| | Account lockout after failed attempts | [ ] | |
| **2FA** | | | |
| | TOTP implementation uses speakeasy/similar | [ ] | |
| | Backup codes are hashed before storage | [ ] | |
| | 2FA secrets are encrypted at rest | [ ] | |
| | Rate limiting on 2FA verification | [ ] | |
| **API Security** | | | |
| | Rate limiting on all endpoints | [ ] | |
| | Input validation on all inputs | [ ] | |
| | SQL injection prevention (parameterized queries) | [ ] | |
| | XSS prevention (output encoding) | [ ] | |
| | CSRF protection (tokens or SameSite cookies) | [ ] | |
| | Security headers configured | [ ] | |
| | API keys are hashed in database | [ ] | |
| **Infrastructure** | | | |
| | TLS 1.3 enforced | [ ] | |
| | HSTS enabled | [ ] | |
| | DDoS protection configured | [ ] | |
| | WAF rules deployed | [ ] | |
| | Secrets in environment variables (not code) | [ ] | |
| | Database connections encrypted | [ ] | |
| **Blockchain** | | | |
| | Smart contracts audited | [ ] | |
| | Multi-sig for pool funds | [ ] | |
| | Circuit breaker implemented | [ ] | |
| | Payout limits configured | [ ] | |
| **Monitoring** | | | |
| | Audit logging enabled | [ ] | |
| | Anomaly detection active | [ ] | |
| | Alert notifications configured | [ ] | |
| | Log retention policy set | [ ] | |

### 10.2 Regular Security Tasks

| Frequency | Task |
|-----------|------|
| Daily | Review security alerts |
| Daily | Check failed login attempts |
| Weekly | Review audit logs |
| Weekly | Check rate limit triggers |
| Monthly | Rotate API keys |
| Monthly | Review user permissions |
| Quarterly | Security penetration test |
| Quarterly | Dependency vulnerability scan |
| Annually | Full security audit |

---

## Implementation Checklist

- [ ] Implement Web3 wallet authentication
- [ ] Add email/password authentication option
- [ ] Implement TOTP 2FA with backup codes
- [ ] Configure JWT with refresh tokens
- [ ] Add rate limiting middleware
- [ ] Implement API key system
- [ ] Configure security headers
- [ ] Setup Cloudflare DDoS protection
- [ ] Implement payout security checks
- [ ] Add circuit breaker integration
- [ ] Setup notification system
- [ ] Implement audit logging
- [ ] Configure security monitoring
- [ ] Complete security checklist

---

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [JWT Best Practices](https://auth0.com/docs/secure/tokens/json-web-tokens)
- [TOTP RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238)
- [Cloudflare Security](https://developers.cloudflare.com/fundamentals/security/)
