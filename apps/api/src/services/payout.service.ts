import { db } from '../lib/db.js';
import { cache } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { ethers } from 'ethers';
import { PayoutStatus } from '@prisma/client';

const logger = createChildLogger('payout-service');

export interface PayoutRequest {
  userId: string;
  amount: number;
  toAddress: string;
}

export interface PayoutData {
  id: string;
  amount: number;
  fee: number;
  txHash: string | null;
  toAddress: string;
  status: PayoutStatus;
  errorMessage: string | null;
  processedAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface PayoutThresholds {
  minimum: number;
  default: number;
  maximum: number;
}

export interface PayoutListParams {
  userId: string;
  page: number;
  limit: number;
  status?: PayoutStatus;
}

export class PayoutService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.initializeBlockchain();
  }

  private initializeBlockchain(): void {
    const rpcUrl = process.env.ETH_RPC_URL;
    const privateKey = process.env.POOL_WALLET_PRIVATE_KEY;

    if (rpcUrl && privateKey) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.info('Blockchain connection initialized');
      } catch (error) {
        logger.error({ error }, 'Failed to initialize blockchain connection');
      }
    } else {
      logger.warn('Blockchain configuration missing');
    }
  }

  /**
   * Get payout thresholds
   */
  getThresholds(): PayoutThresholds {
    return {
      minimum: 0.01,
      default: 0.1,
      maximum: 100,
    };
  }

  /**
   * Get user's current payout threshold
   */
  async getUserThreshold(userId: string): Promise<number> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { payoutThreshold: true },
    });

    return user ? Number(user.payoutThreshold) : this.getThresholds().default;
  }

  /**
   * Update user's payout threshold
   */
  async updateUserThreshold(userId: string, threshold: number): Promise<void> {
    const thresholds = this.getThresholds();

    if (threshold < thresholds.minimum || threshold > thresholds.maximum) {
      throw new Error(
        `Threshold must be between ${thresholds.minimum} and ${thresholds.maximum}`
      );
    }

    await db.user.update({
      where: { id: userId },
      data: { payoutThreshold: threshold },
    });

    logger.info({ userId, threshold }, 'Payout threshold updated');
  }

  /**
   * Get payout history for a user
   */
  async getPayoutHistory(params: PayoutListParams): Promise<{
    payouts: PayoutData[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, page, limit, status } = params;

    const where = {
      userId,
      ...(status && { status }),
    };

    const [payouts, total] = await Promise.all([
      db.payout.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.payout.count({ where }),
    ]);

    return {
      payouts: payouts.map(this.mapPayoutToData),
      total,
      page,
      limit,
    };
  }

  /**
   * Request a payout
   */
  async requestPayout(request: PayoutRequest): Promise<PayoutData> {
    const { userId, amount, toAddress } = request;

    // Validate address
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid payout address');
    }

    // Check minimum threshold
    const thresholds = this.getThresholds();
    if (amount < thresholds.minimum) {
      throw new Error(`Minimum payout amount is ${thresholds.minimum}`);
    }

    // Check user balance
    const balance = await this.getUserBalance(userId);
    if (balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Check for pending payouts
    const pendingCount = await db.payout.count({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (pendingCount > 0) {
      throw new Error('You already have a pending payout');
    }

    // Calculate fee
    const fee = this.calculateFee(amount);

    // Create payout request
    const payout = await db.payout.create({
      data: {
        userId,
        amount,
        fee,
        toAddress: toAddress.toLowerCase(),
        status: 'PENDING',
      },
    });

    logger.info({ payoutId: payout.id, userId, amount }, 'Payout requested');

    // Trigger async processing
    this.processPayout(payout.id).catch((error) => {
      logger.error({ error, payoutId: payout.id }, 'Failed to process payout');
    });

    return this.mapPayoutToData(payout);
  }

  /**
   * Process a payout
   */
  async processPayout(payoutId: string): Promise<void> {
    const payout = await db.payout.findUnique({ where: { id: payoutId } });

    if (!payout || payout.status !== 'PENDING') {
      return;
    }

    // Update status to processing
    await db.payout.update({
      where: { id: payoutId },
      data: { status: 'PROCESSING' },
    });

    try {
      if (!this.wallet || !this.provider) {
        throw new Error('Blockchain not configured');
      }

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

      // Send transaction
      const tx = await this.wallet.sendTransaction({
        to: payout.toAddress,
        value: ethers.parseEther(
          (Number(payout.amount) - Number(payout.fee)).toString()
        ),
        gasPrice,
      });

      logger.info({ payoutId, txHash: tx.hash }, 'Transaction sent');

      // Update with tx hash
      await db.payout.update({
        where: { id: payoutId },
        data: {
          txHash: tx.hash,
          processedAt: new Date(),
        },
      });

      // Wait for confirmation
      const receipt = await tx.wait(1);

      if (receipt?.status === 1) {
        await db.payout.update({
          where: { id: payoutId },
          data: {
            status: 'COMPLETED',
            confirmedAt: new Date(),
          },
        });

        logger.info({ payoutId, txHash: tx.hash }, 'Payout completed');

        // Publish event for real-time updates
        await cache.publish('payout:completed', {
          payoutId,
          userId: payout.userId,
          amount: Number(payout.amount),
          txHash: tx.hash,
        });
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await db.payout.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });

      logger.error({ error, payoutId }, 'Payout failed');
    }
  }

  /**
   * Get user's current balance
   */
  async getUserBalance(userId: string): Promise<number> {
    const cacheKey = `balance:${userId}`;
    const cached = await cache.get<number>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    // Calculate balance from shares and payouts
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        shares: {
          where: { isValid: true },
          select: { difficulty: true },
        },
        payouts: {
          where: { status: 'COMPLETED' },
          select: { amount: true },
        },
      },
    });

    if (!user) {
      return 0;
    }

    // Calculate earnings from shares (simplified)
    const totalDifficulty = user.shares.reduce(
      (sum, s) => sum + Number(s.difficulty),
      0
    );
    const rewardPerDifficulty = 0.000001;
    const totalEarned = totalDifficulty * rewardPerDifficulty * 0.99; // 1% pool fee

    // Subtract completed payouts
    const totalPaid = user.payouts.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const balance = Math.max(0, totalEarned - totalPaid);

    await cache.set(cacheKey, balance, 30); // 30 second cache

    return balance;
  }

  /**
   * Calculate transaction fee
   */
  calculateFee(amount: number): number {
    // Base fee + percentage
    const baseFee = 0.0001;
    const percentageFee = amount * 0.001; // 0.1%
    return Math.min(baseFee + percentageFee, amount * 0.01); // Max 1%
  }

  /**
   * Process automatic payouts
   */
  async processAutomaticPayouts(): Promise<void> {
    logger.info('Processing automatic payouts');

    // Find users who are above their threshold
    const users = await db.user.findMany({
      where: {
        isActive: true,
        payoutAddress: { not: null },
      },
      select: {
        id: true,
        payoutThreshold: true,
        payoutAddress: true,
      },
    });

    for (const user of users) {
      try {
        const balance = await this.getUserBalance(user.id);
        const threshold = Number(user.payoutThreshold);

        if (balance >= threshold && user.payoutAddress) {
          // Check for existing pending payouts
          const pendingCount = await db.payout.count({
            where: {
              userId: user.id,
              status: { in: ['PENDING', 'PROCESSING'] },
            },
          });

          if (pendingCount === 0) {
            await this.requestPayout({
              userId: user.id,
              amount: balance,
              toAddress: user.payoutAddress,
            });
          }
        }
      } catch (error) {
        logger.error({ error, userId: user.id }, 'Auto-payout failed');
      }
    }
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(): Promise<void> {
    const failedPayouts = await db.payout.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    for (const payout of failedPayouts) {
      // Reset to pending for retry
      await db.payout.update({
        where: { id: payout.id },
        data: {
          status: 'PENDING',
          errorMessage: null,
        },
      });

      await this.processPayout(payout.id);
    }
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string, userId: string): Promise<boolean> {
    const payout = await db.payout.findFirst({
      where: {
        id: payoutId,
        userId,
        status: 'PENDING',
      },
    });

    if (!payout) {
      return false;
    }

    await db.payout.update({
      where: { id: payoutId },
      data: { status: 'CANCELLED' },
    });

    logger.info({ payoutId, userId }, 'Payout cancelled');

    return true;
  }

  /**
   * Get pool wallet balance
   */
  async getPoolWalletBalance(): Promise<number> {
    if (!this.provider) {
      return 0;
    }

    const address = process.env.POOL_WALLET_ADDRESS;
    if (!address) {
      return 0;
    }

    const balance = await this.provider.getBalance(address);
    return Number(ethers.formatEther(balance));
  }

  /**
   * Map Prisma payout to PayoutData
   */
  private mapPayoutToData(payout: {
    id: string;
    amount: any;
    fee: any;
    txHash: string | null;
    toAddress: string;
    status: PayoutStatus;
    errorMessage: string | null;
    processedAt: Date | null;
    confirmedAt: Date | null;
    createdAt: Date;
  }): PayoutData {
    return {
      id: payout.id,
      amount: Number(payout.amount),
      fee: Number(payout.fee),
      txHash: payout.txHash,
      toAddress: payout.toAddress,
      status: payout.status,
      errorMessage: payout.errorMessage,
      processedAt: payout.processedAt,
      confirmedAt: payout.confirmedAt,
      createdAt: payout.createdAt,
    };
  }
}

export const payoutService = new PayoutService();
export default payoutService;
