import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { createValidationPreHandler } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createChildLogger } from '../lib/logger.js';
import crypto from 'crypto';

const logger = createChildLogger('auth-routes');

// Validation schemas
const loginSchema = z.object({
  body: z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    message: z.string().min(1),
    signature: z.string().min(1),
  }),
});

const registerSchema = z.object({
  body: z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    username: z.string().min(3).max(30).optional(),
    email: z.string().email().optional(),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

const twoFactorVerifySchema = z.object({
  body: z.object({
    token: z.string().length(6),
  }),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Get nonce for wallet signature
   */
  fastify.get<{
    Querystring: { walletAddress: string };
  }>('/nonce', async (request, reply) => {
    const { walletAddress } = request.query;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid wallet address',
      });
    }

    const nonce = await authService.generateNonce(walletAddress);
    const message = `Sign this message to authenticate with ViddhanaPool.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

    return reply.send({
      nonce,
      message,
    });
  });

  /**
   * Login with wallet signature
   */
  fastify.post<{
    Body: z.infer<typeof loginSchema>['body'];
  }>(
    '/login',
    {
      preHandler: createValidationPreHandler(loginSchema),
    },
    async (request, reply) => {
      const { walletAddress, message, signature } = request.body;

      const result = await authService.loginWithWallet(
        walletAddress,
        message,
        signature
      );

      if (!result) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid signature',
        });
      }

      // If 2FA is enabled, return partial auth
      if (result.requiresTwoFactor) {
        const tempToken = crypto.randomBytes(32).toString('hex');
        
        // Store temp token for 2FA verification
        await fastify.redis.set(
          `2fa:pending:${tempToken}`,
          result.user.id,
          'EX',
          300
        );

        return reply.send({
          requiresTwoFactor: true,
          tempToken,
        });
      }

      // Generate tokens
      const accessToken = fastify.jwt.sign(
        {
          userId: result.user.id,
          walletAddress: result.user.walletAddress,
        },
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
      );

      const refreshToken = crypto.randomBytes(64).toString('hex');

      // Store session
      await authService.createSession(
        result.user.id,
        refreshToken,
        request.headers['user-agent'],
        request.ip
      );

      logger.info({ userId: result.user.id }, 'User logged in');

      return reply.send({
        user: result.user,
        accessToken,
        refreshToken,
      });
    }
  );

  /**
   * Register new user
   */
  fastify.post<{
    Body: z.infer<typeof registerSchema>['body'];
  }>(
    '/register',
    {
      preHandler: createValidationPreHandler(registerSchema),
    },
    async (request, reply) => {
      const { walletAddress, username, email } = request.body;

      try {
        const user = await authService.register(walletAddress, username, email);

        if (!user) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'User already exists',
          });
        }

        return reply.status(201).send({
          user,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * Refresh access token
   */
  fastify.post<{
    Body: z.infer<typeof refreshSchema>['body'];
  }>(
    '/refresh',
    {
      preHandler: createValidationPreHandler(refreshSchema),
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      const user = await authService.validateRefreshToken(refreshToken);

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
        });
      }

      // Generate new access token
      const accessToken = fastify.jwt.sign(
        {
          userId: user.id,
          walletAddress: user.walletAddress,
        },
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
      );

      return reply.send({
        accessToken,
      });
    }
  );

  /**
   * Setup 2FA
   */
  fastify.post(
    '/2fa/setup',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const userId = request.user!.userId;

      try {
        const { secret, otpAuthUrl } = await authService.setupTwoFactor(userId);

        return reply.send({
          secret,
          otpAuthUrl,
        });
      } catch (error) {
        logger.error({ error, userId }, 'Failed to setup 2FA');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to setup 2FA',
        });
      }
    }
  );

  /**
   * Verify and enable 2FA
   */
  fastify.post<{
    Body: z.infer<typeof twoFactorVerifySchema>['body'];
  }>(
    '/2fa/verify',
    {
      preHandler: [authenticate, createValidationPreHandler(twoFactorVerifySchema)],
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { token } = request.body;

      try {
        const success = await authService.verifyAndEnableTwoFactor(userId, token);

        if (!success) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid verification code',
          });
        }

        return reply.send({
          message: '2FA enabled successfully',
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * Complete login with 2FA
   */
  fastify.post<{
    Body: { tempToken: string; token: string };
  }>('/2fa/login', async (request, reply) => {
    const { tempToken, token } = request.body;

    if (!tempToken || !token) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing required fields',
      });
    }

    const userId = await fastify.redis.get(`2fa:pending:${tempToken}`);

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired temp token',
      });
    }

    // Verify 2FA token
    const user = await authService.getUserById(userId);
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      {
        userId: user.id,
        walletAddress: user.walletAddress,
      },
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Store session
    await authService.createSession(
      user.id,
      refreshToken,
      request.headers['user-agent'],
      request.ip
    );

    // Delete temp token
    await fastify.redis.del(`2fa:pending:${tempToken}`);

    return reply.send({
      user,
      accessToken,
      refreshToken,
    });
  });

  /**
   * Logout
   */
  fastify.post<{
    Body: { refreshToken?: string };
  }>(
    '/logout',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      logger.info({ userId: request.user!.userId }, 'User logged out');

      return reply.send({
        message: 'Logged out successfully',
      });
    }
  );

  /**
   * Logout from all devices
   */
  fastify.post(
    '/logout/all',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      await authService.revokeAllUserSessions(request.user!.userId);

      return reply.send({
        message: 'Logged out from all devices',
      });
    }
  );

  /**
   * Get current user
   */
  fastify.get(
    '/me',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const user = await authService.getUserById(request.user!.userId);

      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return reply.send({ user });
    }
  );
}

export default authRoutes;
