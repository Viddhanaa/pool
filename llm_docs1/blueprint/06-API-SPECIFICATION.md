# VIDDHANA POOL - API Specification

> **Document ID:** 06-API-SPECIFICATION  
> **Priority:** P1 - High  
> **Dependencies:** 01-INFRASTRUCTURE, 05-SECURITY

---

## Table of Contents
1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [REST API Endpoints](#3-rest-api-endpoints)
4. [WebSocket Events](#4-websocket-events)
5. [Error Handling](#5-error-handling)
6. [Rate Limits](#6-rate-limits)

---

## 1. Overview

### 1.1 Base URL
```
Production: https://api.viddhana.io/api/v1
Staging:    https://staging-api.viddhana.io/api/v1
```

### 1.2 Content Type
All requests and responses use JSON:
```
Content-Type: application/json
```

### 1.3 Authentication Methods
| Method | Header | Use Case |
|--------|--------|----------|
| JWT Bearer | `Authorization: Bearer <token>` | User sessions |
| API Key | `X-API-Key: <key>` | Programmatic access |

---

## 2. Authentication

### 2.1 POST /auth/login

Login with Web3 wallet signature.

**Request:**
```typescript
interface LoginRequest {
  walletAddress: string;  // Ethereum address
  signature: string;      // Signed message
  message: string;        // Original message that was signed
}
```

**Response:**
```typescript
interface LoginResponse {
  user: {
    id: string;
    walletAddress: string;
    email?: string;
    twoFactorEnabled: boolean;
  };
  token: string;         // JWT access token (if 2FA not required)
  refreshToken: string;  // Refresh token
  require2FA?: boolean;  // True if 2FA verification needed
}
```

**Example:**
```bash
curl -X POST https://api.viddhana.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f1e3B1",
    "signature": "0x...",
    "message": "Sign in to VIDDHANA Pool\n\nTimestamp: 1699123456789"
  }'
```

---

### 2.2 POST /auth/register

Register new user account.

**Request:**
```typescript
interface RegisterRequest {
  walletAddress: string;
  email?: string;
  signature: string;
  message: string;
}
```

**Response:**
```typescript
interface RegisterResponse {
  user: {
    id: string;
    walletAddress: string;
    email?: string;
  };
  token: string;
  refreshToken: string;
}
```

---

### 2.3 POST /auth/refresh

Refresh access token.

**Request:**
```typescript
interface RefreshRequest {
  refreshToken: string;
}
```

**Response:**
```typescript
interface RefreshResponse {
  token: string;
}
```

---

### 2.4 POST /auth/2fa/setup

Initialize 2FA setup.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface TwoFactorSetupResponse {
  secret: string;      // Base32 encoded secret
  qrCodeUrl: string;   // Data URL for QR code image
  backupCodes: string[]; // One-time backup codes
}
```

---

### 2.5 POST /auth/2fa/verify

Verify 2FA code and complete login or enable 2FA.

**Request:**
```typescript
interface TwoFactorVerifyRequest {
  code: string;  // 6-digit TOTP or backup code
}
```

**Response:**
```typescript
interface TwoFactorVerifyResponse {
  success: boolean;
  token?: string;        // Full access token (if completing login)
  refreshToken?: string;
}
```

---

### 2.6 POST /auth/logout

Logout and revoke refresh token.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface LogoutRequest {
  refreshToken: string;
}
```

**Response:**
```typescript
{ success: true }
```

---

## 3. REST API Endpoints

### 3.1 Dashboard

#### GET /dashboard/overview

Get dashboard overview statistics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface DashboardOverview {
  currentHashrate: number;      // H/s
  avgHashrate24h: number;       // H/s
  hashrateTrend: number;        // Percentage change
  onlineWorkers: number;
  totalWorkers: number;
  offlineWorkers: number;
  unpaidBalance: string;        // In smallest unit
  estimated24h: string;         // Estimated earnings
  estimatedMonthly: string;
  nextPayout: string;           // ISO date or null
  totalEarned: string;
  blocksFound: number;
}
```

---

### 3.2 Workers

#### GET /workers

List all workers for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | `all\|online\|offline` | `all` | Filter by status |
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| sort | `hashrate\|name\|lastSeen` | `hashrate` | Sort field |
| order | `asc\|desc` | `desc` | Sort order |

**Response:**
```typescript
interface WorkersListResponse {
  workers: Worker[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Worker {
  id: string;
  name: string;
  isOnline: boolean;
  currentHashrate: number;
  avgHashrate24h: number;
  currentDifficulty: number;
  sharesValid: number;
  sharesStale: number;
  sharesInvalid: number;
  lastSeen: string;         // ISO date
  createdAt: string;
}
```

---

#### GET /workers/:id

Get detailed worker information.

**Response:**
```typescript
interface WorkerDetail extends Worker {
  hashrateHistory: {
    timestamp: string;
    hashrate: number;
  }[];
  shareHistory: {
    timestamp: string;
    valid: number;
    stale: number;
    invalid: number;
  }[];
}
```

---

#### PUT /workers/:id

Update worker settings.

**Request:**
```typescript
interface UpdateWorkerRequest {
  name?: string;
}
```

---

#### DELETE /workers/:id

Remove worker from tracking.

**Response:**
```typescript
{ success: true }
```

---

### 3.3 Statistics

#### GET /stats/pool

Get pool-wide statistics.

**Response:**
```typescript
interface PoolStats {
  hashrate: number;           // Pool hashrate (H/s)
  networkHashrate: number;    // Network hashrate
  activeMiners: number;
  activeWorkers: number;
  difficulty: number;         // Current network difficulty
  blockHeight: number;
  lastBlockTime: string;      // ISO date
  blocksFound24h: number;
  poolFee: number;            // Percentage
  payoutScheme: string;       // "PPS+" or "PPLNS"
  minimumPayout: string;
}
```

---

#### GET /stats/hashrate

Get hashrate history.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| range | `1h\|24h\|7d\|30d` | `24h` | Time range |
| interval | `1m\|5m\|1h\|1d` | auto | Data interval |

**Response:**
```typescript
interface HashrateHistoryResponse {
  data: {
    timestamp: string;
    poolHashrate: number;
    userHashrate?: number;  // If authenticated
    networkHashrate: number;
  }[];
  range: string;
  interval: string;
}
```

---

#### GET /stats/earnings

Get earnings statistics (authenticated).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| range | `24h\|7d\|30d\|all` | `30d` |

**Response:**
```typescript
interface EarningsResponse {
  totalEarned: string;
  totalPaidOut: string;
  unpaidBalance: string;
  earnings: {
    date: string;
    amount: string;
    blocksContributed: number;
  }[];
}
```

---

### 3.4 Payouts

#### GET /payouts

Get payout history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| page | number | 1 |
| limit | number | 50 |
| status | `all\|pending\|completed\|failed` | `all` |

**Response:**
```typescript
interface PayoutsResponse {
  payouts: Payout[];
  pagination: Pagination;
}

interface Payout {
  id: string;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
  processedAt?: string;
}
```

---

#### POST /payouts

Request a payout.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface PayoutRequest {
  amount?: string;  // Optional, defaults to full balance
}
```

**Response:**
```typescript
interface PayoutRequestResponse {
  id: string;
  amount: string;
  status: 'pending';
  estimatedProcessingTime: string;
}
```

---

#### GET /payouts/thresholds

Get payout thresholds and settings.

**Response:**
```typescript
interface PayoutThresholds {
  minimum: string;
  userThreshold: string;    // User's configured threshold
  poolFee: number;
  transactionFee: string;
  nextPayoutRound: string;  // ISO date
}
```

---

#### PUT /payouts/threshold

Update user's payout threshold.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface UpdateThresholdRequest {
  threshold: string;
}
```

---

### 3.5 Blocks

#### GET /blocks

Get block explorer data.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| page | number | 1 |
| limit | number | 50 |
| search | string | - |

**Response:**
```typescript
interface BlocksResponse {
  blocks: Block[];
  pagination: Pagination;
}

interface Block {
  id: string;
  height: number;
  hash: string;
  minerAddress: string;     // Anonymized
  reward: string;
  difficulty: number;
  status: 'pending' | 'confirmed' | 'orphaned';
  confirmations: number;
  foundAt: string;
}
```

---

#### GET /blocks/:id

Get block details.

**Response:**
```typescript
interface BlockDetail extends Block {
  transactionCount: number;
  size: number;
  nonce: string;
  explorerUrl: string;
}
```

---

### 3.6 Leaderboard

#### GET /leaderboard

Get mining leaderboard.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| timeRange | `day\|week\|month\|all` | `day` |
| sortBy | `hashrate\|blocks\|earnings` | `hashrate` |
| limit | number | 100 |

**Response:**
```typescript
interface LeaderboardResponse {
  miners: LeaderboardEntry[];
  timeRange: string;
  sortBy: string;
  userRank?: number;  // If authenticated
}

interface LeaderboardEntry {
  rank: number;
  address: string;          // Anonymized (0x742d...1e3B)
  hashrate: number;
  blocksFound: number;
  totalEarnings: string;
  badges: string[];         // Achievement badges
  isUser?: boolean;         // True if this is the current user
}
```

---

### 3.7 AI Endpoints

#### GET /ai/projection

Get AI-powered earnings projection.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface AIProjectionResponse {
  estimated24h: string;
  estimated30d: string;
  lowerBound24h: string;
  upperBound24h: string;
  confidence: number;       // 0-1
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
  generatedAt: string;
}
```

---

#### POST /ai/optimize

Get worker optimization suggestions.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface OptimizeRequest {
  workerIds: string[];
}
```

**Response:**
```typescript
interface OptimizeResponse {
  optimizations: {
    workerId: string;
    workerName: string;
    currentEfficiency: number;
    optimizedEfficiency: number;
    improvementPct: number;
    suggestions: {
      type: string;
      currentValue: string;
      suggestedValue: string;
      expectedImpact: string;
      priority: 'high' | 'medium' | 'low';
    }[];
    riskLevel: 'low' | 'medium' | 'high';
  }[];
}
```

---

### 3.8 Settings

#### GET /settings

Get user settings.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface SettingsResponse {
  profile: {
    walletAddress: string;
    email?: string;
    emailVerified: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange?: string;
    activeSessions: number;
  };
  notifications: {
    workerOffline: NotificationChannels;
    paymentSent: NotificationChannels;
    blockFound: NotificationChannels;
    securityAlert: NotificationChannels;
  };
  payout: {
    threshold: string;
    autoSwapEnabled: boolean;
    autoSwapToken?: string;
  };
}

interface NotificationChannels {
  email: boolean;
  sms: boolean;
  telegram: boolean;
}
```

---

#### PUT /settings

Update user settings.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface UpdateSettingsRequest {
  email?: string;
  notifications?: Partial<SettingsResponse['notifications']>;
  payout?: Partial<SettingsResponse['payout']>;
}
```

---

### 3.9 API Keys

#### GET /api-keys

List user's API keys.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
interface APIKeysResponse {
  keys: {
    id: string;
    name: string;
    keyPrefix: string;      // "vdh_abc123_****"
    permissions: {
      read: boolean;
      write: boolean;
      payouts: boolean;
      workers: boolean;
    };
    lastUsed?: string;
    createdAt: string;
    expiresAt?: string;
  }[];
}
```

---

#### POST /api-keys

Create new API key.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```typescript
interface CreateAPIKeyRequest {
  name: string;
  permissions: {
    read: boolean;
    write: boolean;
    payouts: boolean;
    workers: boolean;
  };
  expiresInDays?: number;
}
```

**Response:**
```typescript
interface CreateAPIKeyResponse {
  key: string;              // Full key (only shown once!)
  id: string;
  name: string;
  keyPrefix: string;
  permissions: Permissions;
  expiresAt?: string;
}
```

---

#### DELETE /api-keys/:id

Revoke an API key.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```typescript
{ success: true }
```

---

## 4. WebSocket Events

### 4.1 Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://api.viddhana.io', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### 4.2 Events

#### pool:stats

Real-time pool statistics (public).

```typescript
socket.on('pool:stats', (data: PoolStatsEvent) => {
  console.log(data);
});

interface PoolStatsEvent {
  hashrate: number;
  networkHashrate: number;
  activeMiners: number;
  difficulty: number;
  timestamp: string;
}
```

---

#### user:stats

User-specific statistics (authenticated).

```typescript
socket.on('user:stats', (data: UserStatsEvent) => {
  console.log(data);
});

interface UserStatsEvent {
  hashrate: number;
  onlineWorkers: number;
  unpaidBalance: string;
  timestamp: string;
}
```

---

#### worker:update

Individual worker status changes.

```typescript
socket.on('worker:update', (data: WorkerUpdateEvent) => {
  console.log(data);
});

interface WorkerUpdateEvent {
  workerId: string;
  workerName: string;
  hashrate: number;
  isOnline: boolean;
  lastSeen: string;
}
```

---

#### block:found

New block found notification.

```typescript
socket.on('block:found', (data: BlockFoundEvent) => {
  console.log(data);
});

interface BlockFoundEvent {
  height: number;
  hash: string;
  reward: string;
  foundAt: string;
  isUserBlock?: boolean;  // True if user contributed
}
```

---

#### payout:processed

Payout processed notification.

```typescript
socket.on('payout:processed', (data: PayoutProcessedEvent) => {
  console.log(data);
});

interface PayoutProcessedEvent {
  payoutId: string;
  amount: string;
  txHash: string;
  status: 'completed' | 'failed';
}
```

---

### 4.3 Client Events

#### subscribe

Subscribe to specific channels.

```typescript
socket.emit('subscribe', {
  channels: ['pool:stats', 'block:found']
});
```

---

#### unsubscribe

Unsubscribe from channels.

```typescript
socket.emit('unsubscribe', {
  channels: ['pool:stats']
});
```

---

## 5. Error Handling

### 5.1 Error Response Format

```typescript
interface ErrorResponse {
  error: string;       // Human-readable message
  code: string;        // Machine-readable code
  details?: any;       // Additional context
  requestId?: string;  // For support reference
}
```

### 5.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `INVALID_TOKEN` | 401 | JWT token is malformed |
| `REQUIRE_2FA` | 403 | 2FA verification required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INSUFFICIENT_BALANCE` | 400 | Not enough balance for operation |
| `PAYOUT_BELOW_MINIMUM` | 400 | Payout amount below minimum |
| `WORKER_NOT_FOUND` | 404 | Worker ID not found |
| `INTERNAL_ERROR` | 500 | Server error |

### 5.3 Example Error Response

```json
{
  "error": "Payout amount is below the minimum threshold",
  "code": "PAYOUT_BELOW_MINIMUM",
  "details": {
    "minimum": "0.001",
    "requested": "0.0001"
  },
  "requestId": "req_abc123xyz"
}
```

---

## 6. Rate Limits

### 6.1 Default Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Standard API | 100 requests | 1 minute |
| Authentication | 10 requests | 15 minutes |
| Payouts | 5 requests | 1 hour |
| WebSocket connections | 10 connections | 1 minute |

### 6.2 Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123456
```

### 6.3 Rate Limit Response

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

---

## TypeScript SDK Example

```typescript
// packages/sdk/src/client.ts
import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

class ViddhanaPoolClient {
  private http: AxiosInstance;
  private socket: Socket | null = null;
  private token: string | null = null;

  constructor(baseURL: string = 'https://api.viddhana.io/api/v1') {
    this.http = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.http.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  // Auth
  async login(walletAddress: string, signature: string, message: string) {
    const { data } = await this.http.post('/auth/login', {
      walletAddress,
      signature,
      message,
    });
    this.token = data.token;
    return data;
  }

  // Dashboard
  async getDashboard() {
    const { data } = await this.http.get('/dashboard/overview');
    return data;
  }

  // Workers
  async getWorkers(params?: { status?: string; page?: number }) {
    const { data } = await this.http.get('/workers', { params });
    return data;
  }

  // Payouts
  async requestPayout(amount?: string) {
    const { data } = await this.http.post('/payouts', { amount });
    return data;
  }

  // WebSocket
  connectWebSocket() {
    this.socket = io('wss://api.viddhana.io', {
      auth: { token: this.token },
    });
    return this.socket;
  }

  onPoolStats(callback: (data: any) => void) {
    this.socket?.on('pool:stats', callback);
  }

  onWorkerUpdate(callback: (data: any) => void) {
    this.socket?.on('worker:update', callback);
  }
}

export default ViddhanaPoolClient;
```

---

## Implementation Checklist

- [ ] Implement all authentication endpoints
- [ ] Create dashboard endpoints
- [ ] Build worker management API
- [ ] Implement statistics endpoints
- [ ] Create payout system API
- [ ] Build block explorer endpoints
- [ ] Implement leaderboard API
- [ ] Add AI integration endpoints
- [ ] Create settings management
- [ ] Implement API key system
- [ ] Setup WebSocket server
- [ ] Add rate limiting
- [ ] Implement error handling
- [ ] Generate OpenAPI specification
- [ ] Create TypeScript SDK

---

## References

- [OpenAPI Specification](https://swagger.io/specification/)
- [JSON:API](https://jsonapi.org/)
- [Socket.io Documentation](https://socket.io/docs/v4/)
