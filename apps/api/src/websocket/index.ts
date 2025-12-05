import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createChildLogger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import Redis from 'ioredis';

const logger = createChildLogger('websocket');

export interface SocketUser {
  userId: string;
  walletAddress: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export class WebSocketManager {
  private io: SocketIOServer | null = null;
  private subscriber: Redis | null = null;

  /**
   * Initialize Socket.io server
   */
  initialize(httpServer: HttpServer, jwtSecret: string): SocketIOServer {
    // Parse CORS origins - support comma-separated list or '*' for all
    const parseCorsOrigin = (): string | string[] | boolean => {
      const origin = process.env.CORS_ORIGIN;
      if (!origin) {
        // Default: allow common development origins
        return ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
      }
      if (origin === '*' || origin === 'true') {
        return true; // Allow all origins
      }
      // Support comma-separated origins
      if (origin.includes(',')) {
        return origin.split(',').map(o => o.trim());
      }
      return origin;
    };

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: parseCorsOrigin(),
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      allowEIO3: true, // Allow Engine.IO v3 clients
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // In production, verify JWT token here
        // For now, we'll accept the token as user info
        const decoded = this.verifyToken(token as string, jwtSecret);
        
        if (!decoded) {
          return next(new Error('Invalid token'));
        }

        socket.user = decoded;
        next();
      } catch (error) {
        logger.warn({ error }, 'WebSocket authentication failed');
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Setup Redis pub/sub for cluster support
    this.setupRedisPubSub();

    logger.info('WebSocket server initialized');

    return this.io;
  }

  /**
   * Verify JWT token (simplified)
   */
  private verifyToken(token: string, _secret: string): SocketUser | null {
    try {
      // In production, use proper JWT verification
      // This is a simplified implementation
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
      };
    } catch {
      return null;
    }
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: Socket): void {
    const user = socket.user;
    
    if (!user) {
      socket.disconnect();
      return;
    }

    logger.info({ userId: user.userId, socketId: socket.id }, 'Client connected');

    // Join user-specific room
    socket.join(`user:${user.userId}`);

    // Handle room subscriptions
    socket.on('subscribe', (rooms: string[]) => {
      this.handleSubscribe(socket, rooms);
    });

    socket.on('unsubscribe', (rooms: string[]) => {
      this.handleUnsubscribe(socket, rooms);
    });

    // Handle worker events
    socket.on('worker:status', (data) => {
      this.handleWorkerStatus(socket, data);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info(
        { userId: user.userId, socketId: socket.id, reason },
        'Client disconnected'
      );
    });

    // Send initial connection acknowledgment
    socket.emit('connected', {
      userId: user.userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle room subscriptions
   */
  private handleSubscribe(socket: Socket, rooms: string[]): void {
    const user = socket.user;
    if (!user) return;

    for (const room of rooms) {
      // Validate room access
      if (this.canAccessRoom(user.userId, room)) {
        socket.join(room);
        logger.debug({ userId: user.userId, room }, 'Subscribed to room');
      }
    }
  }

  /**
   * Handle room unsubscriptions
   */
  private handleUnsubscribe(socket: Socket, rooms: string[]): void {
    for (const room of rooms) {
      socket.leave(room);
    }
  }

  /**
   * Check if user can access a room
   */
  private canAccessRoom(userId: string, room: string): boolean {
    // Public rooms
    if (room === 'pool:stats' || room === 'blocks' || room === 'network') {
      return true;
    }

    // User-specific rooms
    if (room.startsWith(`user:${userId}`)) {
      return true;
    }

    return false;
  }

  /**
   * Handle worker status updates
   */
  private handleWorkerStatus(
    socket: Socket,
    data: { workerId: string; status: string }
  ): void {
    const user = socket.user;
    if (!user) return;

    // Broadcast to user's room
    this.io?.to(`user:${user.userId}`).emit('worker:update', {
      workerId: data.workerId,
      status: data.status,
      timestamp: Date.now(),
    });
  }

  /**
   * Setup Redis pub/sub for cross-instance communication
   */
  private setupRedisPubSub(): void {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.subscriber = new Redis(redisUrl);

    // Subscribe to channels
    this.subscriber.subscribe(
      'worker:status',
      'payout:completed',
      'block:found',
      'pool:stats'
    );

    this.subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });

    logger.info('Redis pub/sub initialized for WebSocket');
  }

  /**
   * Handle messages from Redis pub/sub
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      switch (channel) {
        case 'worker:status':
          if (data.userId) {
            this.io?.to(`user:${data.userId}`).emit('worker:status', data);
          }
          break;

        case 'payout:completed':
          if (data.userId) {
            this.io?.to(`user:${data.userId}`).emit('payout:completed', data);
          }
          break;

        case 'block:found':
          this.io?.to('blocks').emit('block:found', data);
          break;

        case 'pool:stats':
          this.io?.to('pool:stats').emit('pool:stats', data);
          break;
      }
    } catch (error) {
      logger.error({ error, channel }, 'Failed to handle Redis message');
    }
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.io?.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to room
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    this.io?.to(room).emit(event, data);
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, data: unknown): void {
    this.io?.emit(event, data);
  }

  /**
   * Get connected socket count
   */
  getConnectedCount(): number {
    return this.io?.engine.clientsCount || 0;
  }

  /**
   * Get sockets for a user
   */
  async getUserSockets(userId: string): Promise<Socket[]> {
    if (!this.io) return [];
    
    const sockets = await this.io.in(`user:${userId}`).fetchSockets();
    return sockets as unknown as Socket[];
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    
    if (this.io) {
      this.io.close();
    }
    
    logger.info('WebSocket server closed');
  }
}

export const wsManager = new WebSocketManager();
export default wsManager;
