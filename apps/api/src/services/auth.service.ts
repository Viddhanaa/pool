import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { ethers } from 'ethers';
import crypto from 'crypto';

const logger = createChildLogger('auth-service');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

export interface SignaturePayload {
  message: string;
  signature: string;
  walletAddress: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserData {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export class AuthService {
  /**
   * Verify Ethereum wallet signature
   */
  async verifyWalletSignature(payload: SignaturePayload): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(
        payload.message,
        payload.signature
      );
      return recoveredAddress.toLowerCase() === payload.walletAddress.toLowerCase();
    } catch (error) {
      logger.error({ error }, 'Failed to verify wallet signature');
      return false;
    }
  }

  /**
   * Generate a nonce for wallet authentication
   */
  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = crypto.randomBytes(32).toString('hex');
    const cacheKey = `auth:nonce:${walletAddress.toLowerCase()}`;
    
    await cache.set(cacheKey, nonce, 300); // 5 minutes expiry
    
    return nonce;
  }

  /**
   * Verify nonce for wallet authentication
   */
  async verifyNonce(walletAddress: string, nonce: string): Promise<boolean> {
    const cacheKey = `auth:nonce:${walletAddress.toLowerCase()}`;
    const storedNonce = await cache.get<string>(cacheKey);
    
    if (!storedNonce || storedNonce !== nonce) {
      return false;
    }
    
    // Delete nonce after use
    await cache.del(cacheKey);
    return true;
  }

  /**
   * Login with wallet signature
   */
  async loginWithWallet(
    walletAddress: string,
    message: string,
    signature: string
  ): Promise<{ user: UserData; requiresTwoFactor: boolean } | null> {
    // Verify signature
    const isValid = await this.verifyWalletSignature({
      message,
      signature,
      walletAddress,
    });

    if (!isValid) {
      logger.warn({ walletAddress }, 'Invalid wallet signature');
      return null;
    }

    // Find or create user
    let user = await db.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          payoutAddress: walletAddress.toLowerCase(),
        },
      });
      logger.info({ userId: user.id, walletAddress }, 'New user created');
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
      requiresTwoFactor: user.twoFactorEnabled,
    };
  }

  /**
   * Register a new user
   */
  async register(
    walletAddress: string,
    username?: string,
    email?: string
  ): Promise<UserData | null> {
    const normalizedAddress = walletAddress.toLowerCase();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (existingUser) {
      logger.warn({ walletAddress }, 'User already exists');
      return null;
    }

    // Check for existing username or email
    if (username) {
      const existingUsername = await db.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        throw new Error('Username already taken');
      }
    }

    if (email) {
      const existingEmail = await db.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new Error('Email already registered');
      }
    }

    const user = await db.user.create({
      data: {
        walletAddress: normalizedAddress,
        username,
        email,
        payoutAddress: normalizedAddress,
      },
    });

    logger.info({ userId: user.id, walletAddress }, 'User registered');

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    };
  }

  /**
   * Setup 2FA for a user
   */
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpAuthUrl: string }> {
    const user = await db.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Generate a secret
    const secret = crypto.randomBytes(20).toString('hex');
    
    // Store secret temporarily
    await cache.set(`2fa:setup:${userId}`, secret, 600); // 10 minutes

    const issuer = process.env.TWO_FA_ISSUER || 'ViddhanaPool';
    const otpAuthUrl = `otpauth://totp/${issuer}:${user.walletAddress}?secret=${secret}&issuer=${issuer}`;

    return { secret, otpAuthUrl };
  }

  /**
   * Verify and enable 2FA
   */
  async verifyAndEnableTwoFactor(userId: string, token: string): Promise<boolean> {
    const secret = await cache.get<string>(`2fa:setup:${userId}`);
    
    if (!secret) {
      throw new Error('2FA setup expired. Please start again.');
    }

    // In production, you would verify the TOTP token here
    // For now, we'll simulate verification
    const isValid = this.verifyTOTP(secret, token);
    
    if (!isValid) {
      return false;
    }

    // Enable 2FA
    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
      },
    });

    await cache.del(`2fa:setup:${userId}`);
    
    logger.info({ userId }, '2FA enabled');
    return true;
  }

  /**
   * Verify TOTP token (simplified implementation)
   */
  private verifyTOTP(secret: string, token: string): boolean {
    // This is a simplified verification
    // In production, use a proper TOTP library like 'otplib'
    const timeStep = Math.floor(Date.now() / 30000);
    const expectedToken = this.generateTOTP(secret, timeStep);
    const previousToken = this.generateTOTP(secret, timeStep - 1);
    
    return token === expectedToken || token === previousToken;
  }

  /**
   * Generate TOTP (simplified implementation)
   */
  private generateTOTP(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
    hmac.update(buffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Create a session
   */
  async createSession(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.session.create({
      data: {
        userId,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(refreshToken: string): Promise<UserData | null> {
    const session = await db.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await db.session.delete({ where: { id: session.id } });
      }
      return null;
    }

    return {
      id: session.user.id,
      walletAddress: session.user.walletAddress,
      username: session.user.username,
      email: session.user.email,
      twoFactorEnabled: session.user.twoFactorEnabled,
      createdAt: session.user.createdAt,
    };
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await db.session.deleteMany({
      where: { refreshToken },
    });
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await db.session.deleteMany({
      where: { userId },
    });
    logger.info({ userId }, 'All sessions revoked');
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserData | null> {
    const user = await db.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
export default authService;
