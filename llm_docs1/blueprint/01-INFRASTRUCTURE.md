# VIDDHANA POOL - Infrastructure Implementation Guide

> **Document ID:** 01-INFRASTRUCTURE  
> **Priority:** P0 - Critical  
> **Dependencies:** None (Foundation Layer)

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Monorepo Setup](#3-monorepo-setup)
4. [Stratum Server Implementation](#4-stratum-server-implementation)
5. [Database Architecture](#5-database-architecture)
6. [Backend API Server](#6-backend-api-server)
7. [Deployment Infrastructure](#7-deployment-infrastructure)
8. [Monitoring & Observability](#8-monitoring--observability)

---

## 1. Overview

The infrastructure layer is the foundation of VIDDHANA POOL, handling:
- High-concurrency mining connections (10k-100k+ simultaneous workers)
- Real-time share processing and validation
- Persistent data storage with time-series optimization
- API services for frontend consumption

---

## 2. Technology Stack

### 2.1 Core Technologies

| Component | Technology | Justification |
|-----------|------------|---------------|
| Stratum Server | **Golang 1.21+** | High concurrency, low latency, goroutines |
| Backend API | **Node.js 20 LTS + Fastify** | Fast JSON, WebSocket support |
| Primary Database | **PostgreSQL 16** | ACID compliance, JSON support |
| Time-Series DB | **TimescaleDB** | Hashrate history, automatic partitioning |
| Cache Layer | **Redis 7 Cluster** | Real-time share counts, sessions |
| Message Queue | **Redis Streams / NATS** | Job distribution, events |
| Load Balancer | **HAProxy 2.8** | TCP/SSL termination for Stratum |

### 2.2 Development Tools

```yaml
Package Manager: pnpm (for JS/TS)
Monorepo Tool: Turborepo
Container Runtime: Docker + Docker Compose
Infrastructure as Code: Terraform
CI/CD: GitHub Actions
```

---

## 3. Monorepo Setup

### 3.1 Initialize Turborepo

```bash
# Create project
npx create-turbo@latest viddhana-pool
cd viddhana-pool

# Directory structure
mkdir -p apps/{web,api,stratum}
mkdir -p packages/{shared,contracts,ai-models}
mkdir -p infrastructure/{docker,k8s,terraform}
```

### 3.2 Root package.json

```json
{
  "name": "viddhana-pool",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "stratum:dev": "cd apps/stratum && go run cmd/stratum/main.go",
    "db:migrate": "turbo run db:migrate --filter=api",
    "docker:up": "docker-compose -f infrastructure/docker/docker-compose.yml up -d"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

### 3.3 turbo.json Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

---

## 4. Stratum Server Implementation

### 4.1 Project Structure (apps/stratum/)

```
apps/stratum/
├── cmd/
│   └── stratum/
│       └── main.go           # Entry point
├── internal/
│   ├── server/
│   │   ├── server.go         # TCP server
│   │   ├── handler.go        # Connection handler
│   │   └── pool.go           # Connection pool
│   ├── protocol/
│   │   ├── stratum.go        # Stratum V1 protocol
│   │   ├── message.go        # JSON-RPC messages
│   │   └── difficulty.go     # VarDiff implementation
│   ├── mining/
│   │   ├── share.go          # Share validation
│   │   ├── job.go            # Job management
│   │   └── block.go          # Block submission
│   ├── worker/
│   │   ├── worker.go         # Worker tracking
│   │   ├── auth.go           # Worker authentication
│   │   └── stats.go          # Worker statistics
│   └── storage/
│       ├── redis.go          # Redis client
│       └── postgres.go       # Database client
├── pkg/
│   └── crypto/
│       └── pow.go            # Proof of Work verification
├── configs/
│   └── config.yaml
├── go.mod
└── go.sum
```

### 4.2 Core Stratum Implementation

**File: `internal/server/server.go`**

```go
package server

import (
    "context"
    "net"
    "sync"
    "time"
    
    "github.com/viddhana/pool/internal/protocol"
    "github.com/viddhana/pool/internal/worker"
    "go.uber.org/zap"
)

type Config struct {
    ListenAddr     string        `yaml:"listen_addr"`
    MaxConnections int           `yaml:"max_connections"`
    ReadTimeout    time.Duration `yaml:"read_timeout"`
    WriteTimeout   time.Duration `yaml:"write_timeout"`
    TLSEnabled     bool          `yaml:"tls_enabled"`
    TLSCertFile    string        `yaml:"tls_cert_file"`
    TLSKeyFile     string        `yaml:"tls_key_file"`
}

type Server struct {
    config     Config
    listener   net.Listener
    workers    *worker.Manager
    protocol   *protocol.Handler
    logger     *zap.Logger
    
    mu         sync.RWMutex
    conns      map[string]*Connection
    shutdown   chan struct{}
}

func New(cfg Config, logger *zap.Logger) *Server {
    return &Server{
        config:   cfg,
        logger:   logger,
        conns:    make(map[string]*Connection),
        shutdown: make(chan struct{}),
    }
}

func (s *Server) Start(ctx context.Context) error {
    var err error
    
    if s.config.TLSEnabled {
        // TLS listener for SSL stratum
        s.listener, err = s.createTLSListener()
    } else {
        s.listener, err = net.Listen("tcp", s.config.ListenAddr)
    }
    
    if err != nil {
        return err
    }
    
    s.logger.Info("Stratum server started",
        zap.String("addr", s.config.ListenAddr),
        zap.Bool("tls", s.config.TLSEnabled))
    
    go s.acceptLoop(ctx)
    return nil
}

func (s *Server) acceptLoop(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case <-s.shutdown:
            return
        default:
        }
        
        conn, err := s.listener.Accept()
        if err != nil {
            s.logger.Error("Accept error", zap.Error(err))
            continue
        }
        
        // Check connection limit
        s.mu.RLock()
        connCount := len(s.conns)
        s.mu.RUnlock()
        
        if connCount >= s.config.MaxConnections {
            s.logger.Warn("Max connections reached, rejecting")
            conn.Close()
            continue
        }
        
        // Handle connection in goroutine
        go s.handleConnection(ctx, conn)
    }
}

func (s *Server) handleConnection(ctx context.Context, conn net.Conn) {
    c := NewConnection(conn, s.config, s.logger)
    
    s.mu.Lock()
    s.conns[c.ID] = c
    s.mu.Unlock()
    
    defer func() {
        s.mu.Lock()
        delete(s.conns, c.ID)
        s.mu.Unlock()
        c.Close()
    }()
    
    c.Handle(ctx, s.protocol)
}

func (s *Server) Shutdown(ctx context.Context) error {
    close(s.shutdown)
    s.listener.Close()
    
    // Gracefully close all connections
    s.mu.Lock()
    for _, c := range s.conns {
        c.Close()
    }
    s.mu.Unlock()
    
    return nil
}

func (s *Server) Stats() ServerStats {
    s.mu.RLock()
    defer s.mu.RUnlock()
    
    return ServerStats{
        ActiveConnections: len(s.conns),
    }
}
```

### 4.3 Stratum Protocol Handler

**File: `internal/protocol/stratum.go`**

```go
package protocol

import (
    "encoding/json"
    "fmt"
)

// Stratum JSON-RPC Methods
const (
    MethodSubscribe       = "mining.subscribe"
    MethodAuthorize       = "mining.authorize"
    MethodSubmit          = "mining.submit"
    MethodSetDifficulty   = "mining.set_difficulty"
    MethodNotify          = "mining.notify"
    MethodSetExtranonce   = "mining.set_extranonce"
)

// Request represents a Stratum JSON-RPC request
type Request struct {
    ID     interface{}   `json:"id"`
    Method string        `json:"method"`
    Params []interface{} `json:"params"`
}

// Response represents a Stratum JSON-RPC response
type Response struct {
    ID     interface{} `json:"id"`
    Result interface{} `json:"result,omitempty"`
    Error  *Error      `json:"error,omitempty"`
}

// Notification for server-push messages
type Notification struct {
    ID     interface{}   `json:"id"`
    Method string        `json:"method"`
    Params []interface{} `json:"params"`
}

type Error struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

type Handler struct {
    jobManager    *JobManager
    shareHandler  *ShareHandler
    difficultyMgr *DifficultyManager
}

func (h *Handler) HandleRequest(req *Request) (*Response, error) {
    switch req.Method {
    case MethodSubscribe:
        return h.handleSubscribe(req)
    case MethodAuthorize:
        return h.handleAuthorize(req)
    case MethodSubmit:
        return h.handleSubmit(req)
    default:
        return &Response{
            ID:    req.ID,
            Error: &Error{Code: -1, Message: "Unknown method"},
        }, nil
    }
}

func (h *Handler) handleSubscribe(req *Request) (*Response, error) {
    // Generate extranonce for this worker
    extranonce1 := h.jobManager.GenerateExtranonce()
    extranonce2Size := 4
    
    // Get current job for notification
    subscriptionID := generateSubscriptionID()
    
    result := []interface{}{
        [][]string{
            {"mining.set_difficulty", subscriptionID},
            {"mining.notify", subscriptionID},
        },
        extranonce1,
        extranonce2Size,
    }
    
    return &Response{ID: req.ID, Result: result}, nil
}

func (h *Handler) handleAuthorize(req *Request) (*Response, error) {
    if len(req.Params) < 2 {
        return &Response{
            ID:    req.ID,
            Error: &Error{Code: -1, Message: "Invalid params"},
        }, nil
    }
    
    // Parse wallet.worker_name format
    username := req.Params[0].(string)
    password := req.Params[1].(string)
    
    wallet, workerName, err := parseWorkerCredentials(username)
    if err != nil {
        return &Response{ID: req.ID, Result: false}, nil
    }
    
    // Validate wallet address format
    if !isValidWalletAddress(wallet) {
        return &Response{ID: req.ID, Result: false}, nil
    }
    
    // Authorization successful
    return &Response{ID: req.ID, Result: true}, nil
}

func (h *Handler) handleSubmit(req *Request) (*Response, error) {
    // Params: [worker_name, job_id, extranonce2, ntime, nonce]
    if len(req.Params) < 5 {
        return &Response{
            ID:    req.ID,
            Error: &Error{Code: -1, Message: "Invalid params"},
        }, nil
    }
    
    share := &Share{
        WorkerName:  req.Params[0].(string),
        JobID:       req.Params[1].(string),
        Extranonce2: req.Params[2].(string),
        NTime:       req.Params[3].(string),
        Nonce:       req.Params[4].(string),
    }
    
    result, err := h.shareHandler.ProcessShare(share)
    if err != nil {
        return &Response{
            ID:    req.ID,
            Error: &Error{Code: -1, Message: err.Error()},
        }, nil
    }
    
    return &Response{ID: req.ID, Result: result}, nil
}
```

### 4.4 Variable Difficulty (VarDiff)

**File: `internal/protocol/difficulty.go`**

```go
package protocol

import (
    "sync"
    "time"
)

type DifficultyConfig struct {
    InitialDiff    float64       `yaml:"initial_diff"`
    MinDiff        float64       `yaml:"min_diff"`
    MaxDiff        float64       `yaml:"max_diff"`
    TargetTime     time.Duration `yaml:"target_time"`      // Target time between shares
    RetargetTime   time.Duration `yaml:"retarget_time"`    // Time between adjustments
    VariancePercent float64      `yaml:"variance_percent"` // Acceptable variance
}

type DifficultyManager struct {
    config  DifficultyConfig
    workers map[string]*WorkerDifficulty
    mu      sync.RWMutex
}

type WorkerDifficulty struct {
    CurrentDiff   float64
    ShareCount    int64
    LastShareTime time.Time
    LastRetarget  time.Time
    ShareTimes    []time.Duration // Rolling window
}

func NewDifficultyManager(cfg DifficultyConfig) *DifficultyManager {
    return &DifficultyManager{
        config:  cfg,
        workers: make(map[string]*WorkerDifficulty),
    }
}

func (dm *DifficultyManager) GetDifficulty(workerID string) float64 {
    dm.mu.RLock()
    defer dm.mu.RUnlock()
    
    if w, ok := dm.workers[workerID]; ok {
        return w.CurrentDiff
    }
    return dm.config.InitialDiff
}

func (dm *DifficultyManager) RegisterShare(workerID string) *float64 {
    dm.mu.Lock()
    defer dm.mu.Unlock()
    
    now := time.Now()
    
    w, ok := dm.workers[workerID]
    if !ok {
        dm.workers[workerID] = &WorkerDifficulty{
            CurrentDiff:   dm.config.InitialDiff,
            LastShareTime: now,
            LastRetarget:  now,
            ShareTimes:    make([]time.Duration, 0, 10),
        }
        return nil
    }
    
    // Record share time
    shareTime := now.Sub(w.LastShareTime)
    w.LastShareTime = now
    w.ShareCount++
    
    // Keep rolling window of last 10 share times
    w.ShareTimes = append(w.ShareTimes, shareTime)
    if len(w.ShareTimes) > 10 {
        w.ShareTimes = w.ShareTimes[1:]
    }
    
    // Check if retarget is needed
    if now.Sub(w.LastRetarget) < dm.config.RetargetTime {
        return nil
    }
    
    // Calculate average share time
    avgShareTime := dm.calculateAverageShareTime(w.ShareTimes)
    
    // Adjust difficulty
    newDiff := dm.calculateNewDifficulty(w.CurrentDiff, avgShareTime)
    
    if newDiff != w.CurrentDiff {
        w.CurrentDiff = newDiff
        w.LastRetarget = now
        return &newDiff
    }
    
    return nil
}

func (dm *DifficultyManager) calculateAverageShareTime(times []time.Duration) time.Duration {
    if len(times) == 0 {
        return dm.config.TargetTime
    }
    
    var total time.Duration
    for _, t := range times {
        total += t
    }
    return total / time.Duration(len(times))
}

func (dm *DifficultyManager) calculateNewDifficulty(current float64, avgTime time.Duration) float64 {
    target := dm.config.TargetTime
    variance := dm.config.VariancePercent / 100
    
    // Within acceptable variance, no change
    lowerBound := target.Seconds() * (1 - variance)
    upperBound := target.Seconds() * (1 + variance)
    
    if avgTime.Seconds() >= lowerBound && avgTime.Seconds() <= upperBound {
        return current
    }
    
    // Calculate adjustment ratio
    ratio := target.Seconds() / avgTime.Seconds()
    newDiff := current * ratio
    
    // Clamp to min/max
    if newDiff < dm.config.MinDiff {
        newDiff = dm.config.MinDiff
    }
    if newDiff > dm.config.MaxDiff {
        newDiff = dm.config.MaxDiff
    }
    
    return newDiff
}
```

### 4.5 Share Validation

**File: `internal/mining/share.go`**

```go
package mining

import (
    "encoding/hex"
    "errors"
    "math/big"
    
    "github.com/viddhana/pool/pkg/crypto"
)

var (
    ErrDuplicateShare  = errors.New("duplicate share")
    ErrInvalidJob      = errors.New("invalid job")
    ErrStaleShare      = errors.New("stale share")
    ErrLowDifficulty   = errors.New("low difficulty share")
    ErrInvalidNonce    = errors.New("invalid nonce")
)

type ShareResult int

const (
    ShareValid ShareResult = iota
    ShareBlock
    ShareInvalid
    ShareDuplicate
    ShareStale
)

type Share struct {
    WorkerName  string
    JobID       string
    Extranonce2 string
    NTime       string
    Nonce       string
}

type ShareHandler struct {
    jobManager     *JobManager
    duplicateCheck *DuplicateChecker
    blockSubmitter *BlockSubmitter
}

func (sh *ShareHandler) ProcessShare(share *Share) (bool, error) {
    // 1. Get job
    job, err := sh.jobManager.GetJob(share.JobID)
    if err != nil {
        return false, ErrInvalidJob
    }
    
    // 2. Check for stale job
    if job.IsStale() {
        return false, ErrStaleShare
    }
    
    // 3. Check for duplicate
    shareKey := sh.generateShareKey(share)
    if sh.duplicateCheck.IsDuplicate(shareKey) {
        return false, ErrDuplicateShare
    }
    
    // 4. Build block header
    header := sh.buildBlockHeader(job, share)
    
    // 5. Calculate hash
    hash := crypto.DoubleHash(header)
    
    // 6. Check against share difficulty
    shareDiff := sh.calculateDifficulty(hash)
    workerDiff := sh.getWorkerDifficulty(share.WorkerName)
    
    if shareDiff < workerDiff {
        return false, ErrLowDifficulty
    }
    
    // 7. Check if block solution
    if shareDiff >= job.NetworkDifficulty {
        // Submit block to network!
        go sh.blockSubmitter.Submit(job, share, header)
        return true, nil
    }
    
    // 8. Record valid share
    sh.duplicateCheck.Add(shareKey)
    
    return true, nil
}

func (sh *ShareHandler) buildBlockHeader(job *Job, share *Share) []byte {
    // Construct block header from job template and share data
    header := make([]byte, 80)
    
    // Version (4 bytes)
    copy(header[0:4], job.Version)
    
    // Previous block hash (32 bytes)
    copy(header[4:36], job.PrevHash)
    
    // Merkle root (32 bytes) - calculated with extranonce
    merkleRoot := sh.calculateMerkleRoot(job, share.Extranonce2)
    copy(header[36:68], merkleRoot)
    
    // Time (4 bytes)
    ntime, _ := hex.DecodeString(share.NTime)
    copy(header[68:72], ntime)
    
    // Bits (4 bytes)
    copy(header[72:76], job.NBits)
    
    // Nonce (4 bytes)
    nonce, _ := hex.DecodeString(share.Nonce)
    copy(header[76:80], nonce)
    
    return header
}

func (sh *ShareHandler) calculateDifficulty(hash []byte) float64 {
    // Convert hash to big.Int and calculate difficulty
    hashInt := new(big.Int).SetBytes(hash)
    
    // Difficulty 1 target
    diff1Target := new(big.Int)
    diff1Target.SetString("00000000ffff0000000000000000000000000000000000000000000000000000", 16)
    
    if hashInt.Sign() == 0 {
        return 0
    }
    
    difficulty := new(big.Float).Quo(
        new(big.Float).SetInt(diff1Target),
        new(big.Float).SetInt(hashInt),
    )
    
    result, _ := difficulty.Float64()
    return result
}
```

---

## 5. Database Architecture

### 5.1 PostgreSQL Schema

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    two_factor_secret VARCHAR(64),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Workers table
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    last_seen TIMESTAMPTZ,
    is_online BOOLEAN DEFAULT FALSE,
    current_hashrate BIGINT DEFAULT 0,
    current_difficulty FLOAT DEFAULT 1.0,
    shares_valid BIGINT DEFAULT 0,
    shares_stale BIGINT DEFAULT 0,
    shares_invalid BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

CREATE INDEX idx_workers_user ON workers(user_id);
CREATE INDEX idx_workers_online ON workers(is_online);

-- Hashrate history (TimescaleDB hypertable)
CREATE TABLE hashrate_history (
    time TIMESTAMPTZ NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    hashrate BIGINT NOT NULL,
    shares_count INT DEFAULT 0
);

SELECT create_hypertable('hashrate_history', 'time');
CREATE INDEX idx_hashrate_worker ON hashrate_history(worker_id, time DESC);

-- Shares table (for detailed tracking)
CREATE TABLE shares (
    id BIGSERIAL PRIMARY KEY,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    job_id VARCHAR(64) NOT NULL,
    difficulty FLOAT NOT NULL,
    is_valid BOOLEAN NOT NULL,
    is_block BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('shares', 'created_at');
CREATE INDEX idx_shares_worker ON shares(worker_id, created_at DESC);

-- Blocks found
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    height BIGINT NOT NULL,
    hash VARCHAR(128) NOT NULL UNIQUE,
    worker_id UUID REFERENCES workers(id),
    reward NUMERIC(30, 18) NOT NULL,
    difficulty FLOAT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, orphaned
    confirmations INT DEFAULT 0,
    found_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocks_status ON blocks(status);
CREATE INDEX idx_blocks_height ON blocks(height);

-- Payouts
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(30, 18) NOT NULL,
    tx_hash VARCHAR(128),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payouts_user ON payouts(user_id, created_at DESC);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Pool statistics (aggregated)
CREATE TABLE pool_stats (
    time TIMESTAMPTZ NOT NULL,
    total_hashrate BIGINT NOT NULL,
    active_workers INT NOT NULL,
    active_miners INT NOT NULL,
    blocks_found_24h INT DEFAULT 0,
    network_difficulty FLOAT NOT NULL
);

SELECT create_hypertable('pool_stats', 'time');
```

### 5.2 Redis Data Structures

```
# Real-time share tracking
HASH pool:shares:current
  - {worker_id}: {count}

# Worker online status
SET pool:workers:online
  - {worker_id1}
  - {worker_id2}

# Share rate limiting (per worker)
SORTED_SET pool:worker:{id}:shares
  - score: timestamp
  - member: share_hash

# Current jobs
HASH pool:jobs:current
  - {job_id}: {job_json}

# Duplicate share check (Bloom filter alternative)
SET pool:shares:recent:{minute}
  - {share_hash}

# Real-time hashrate (sliding window)
SORTED_SET pool:hashrate:global
  - score: timestamp
  - member: {share_difficulty}

# Session storage
HASH session:{id}
  - user_id
  - wallet
  - expires_at
```

---

## 6. Backend API Server

### 6.1 Project Structure (apps/api/)

```
apps/api/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Fastify app setup
│   ├── routes/
│   │   ├── auth.ts           # Authentication routes
│   │   ├── workers.ts        # Worker management
│   │   ├── stats.ts          # Statistics endpoints
│   │   ├── payouts.ts        # Payout endpoints
│   │   └── blocks.ts         # Block explorer
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── worker.service.ts
│   │   ├── stats.service.ts
│   │   └── payout.service.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── worker.model.ts
│   │   └── payout.model.ts
│   ├── websocket/
│   │   ├── index.ts          # Socket.io setup
│   │   └── handlers.ts       # WS event handlers
│   ├── middleware/
│   │   ├── auth.ts           # JWT validation
│   │   ├── rateLimit.ts      # Rate limiting
│   │   └── validate.ts       # Request validation
│   ├── lib/
│   │   ├── db.ts             # Database client
│   │   ├── redis.ts          # Redis client
│   │   └── logger.ts         # Logging
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── package.json
└── tsconfig.json
```

### 6.2 Fastify App Setup

**File: `src/app.ts`**

```typescript
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { Server } from 'socket.io';

import { authRoutes } from './routes/auth';
import { workerRoutes } from './routes/workers';
import { statsRoutes } from './routes/stats';
import { payoutRoutes } from './routes/payouts';
import { blockRoutes } from './routes/blocks';
import { setupWebSocket } from './websocket';
import { redis } from './lib/redis';
import { logger } from './lib/logger';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Security
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: redis,
    keyGenerator: (req) => req.ip,
  });

  // JWT Authentication
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  // WebSocket support
  await app.register(websocket);
  
  // Socket.io for real-time updates
  const io = new Server(app.server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(','),
      credentials: true,
    },
  });
  setupWebSocket(io);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(workerRoutes, { prefix: '/api/v1/workers' });
  await app.register(statsRoutes, { prefix: '/api/v1/stats' });
  await app.register(payoutRoutes, { prefix: '/api/v1/payouts' });
  await app.register(blockRoutes, { prefix: '/api/v1/blocks' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error('Request error', { error, path: request.url });
    
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_ERROR',
    });
  });

  return app;
}
```

---

## 7. Deployment Infrastructure

### 7.1 Docker Compose (Development)

**File: `infrastructure/docker/docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: viddhana-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: viddhana
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-devpassword}
      POSTGRES_DB: viddhana_pool
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U viddhana"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: viddhana-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: viddhana-redis-ui
    ports:
      - "8081:8081"
    environment:
      REDIS_HOSTS: local:redis:6379
    depends_on:
      - redis

  api:
    build:
      context: ../../
      dockerfile: infrastructure/docker/Dockerfile.api
    container_name: viddhana-api
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://viddhana:${POSTGRES_PASSWORD:-devpassword}@postgres:5432/viddhana_pool
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../../apps/api:/app/apps/api
      - /app/node_modules

  stratum:
    build:
      context: ../../apps/stratum
      dockerfile: Dockerfile
    container_name: viddhana-stratum
    ports:
      - "3333:3333"   # Stratum TCP
      - "3334:3334"   # Stratum SSL
    environment:
      POSTGRES_URL: postgresql://viddhana:${POSTGRES_PASSWORD:-devpassword}@postgres:5432/viddhana_pool
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: debug
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: ../../
      dockerfile: infrastructure/docker/Dockerfile.web
    container_name: viddhana-web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NEXT_PUBLIC_WS_URL: ws://localhost:4000
    depends_on:
      - api
    volumes:
      - ../../apps/web:/app/apps/web
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

### 7.2 Kubernetes (Production)

**File: `infrastructure/k8s/stratum-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stratum-server
  labels:
    app: viddhana-stratum
spec:
  replicas: 3
  selector:
    matchLabels:
      app: viddhana-stratum
  template:
    metadata:
      labels:
        app: viddhana-stratum
    spec:
      containers:
      - name: stratum
        image: viddhana/stratum:latest
        ports:
        - containerPort: 3333
          name: stratum-tcp
        - containerPort: 3334
          name: stratum-ssl
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        env:
        - name: POSTGRES_URL
          valueFrom:
            secretKeyRef:
              name: viddhana-secrets
              key: postgres-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: viddhana-secrets
              key: redis-url
        livenessProbe:
          tcpSocket:
            port: 3333
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          tcpSocket:
            port: 3333
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: stratum-service
spec:
  type: LoadBalancer
  selector:
    app: viddhana-stratum
  ports:
  - name: stratum-tcp
    port: 3333
    targetPort: 3333
  - name: stratum-ssl
    port: 3334
    targetPort: 3334
```

---

## 8. Monitoring & Observability

### 8.1 Prometheus Metrics (Go Stratum)

```go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    ConnectionsTotal = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "stratum_connections_total",
        Help: "Total number of active stratum connections",
    })
    
    SharesProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "stratum_shares_processed_total",
        Help: "Total shares processed by result type",
    }, []string{"result"}) // valid, stale, invalid, duplicate
    
    BlocksFound = promauto.NewCounter(prometheus.CounterOpts{
        Name: "stratum_blocks_found_total",
        Help: "Total blocks found",
    })
    
    ShareProcessingDuration = promauto.NewHistogram(prometheus.HistogramOpts{
        Name:    "stratum_share_processing_seconds",
        Help:    "Time spent processing shares",
        Buckets: prometheus.DefBuckets,
    })
    
    PoolHashrate = promauto.NewGauge(prometheus.GaugeOpts{
        Name: "stratum_pool_hashrate",
        Help: "Estimated pool hashrate",
    })
)
```

### 8.2 Grafana Dashboard (JSON Export)

```json
{
  "title": "VIDDHANA Pool - Stratum Metrics",
  "panels": [
    {
      "title": "Active Connections",
      "type": "stat",
      "targets": [
        { "expr": "stratum_connections_total" }
      ]
    },
    {
      "title": "Shares Per Second",
      "type": "graph",
      "targets": [
        { "expr": "rate(stratum_shares_processed_total[1m])" }
      ]
    },
    {
      "title": "Pool Hashrate",
      "type": "stat",
      "targets": [
        { "expr": "stratum_pool_hashrate" }
      ]
    },
    {
      "title": "Share Processing Latency",
      "type": "heatmap",
      "targets": [
        { "expr": "stratum_share_processing_seconds_bucket" }
      ]
    }
  ]
}
```

---

## Implementation Checklist

- [ ] Initialize monorepo with Turborepo
- [ ] Setup Docker development environment
- [ ] Create PostgreSQL + TimescaleDB schema
- [ ] Configure Redis cluster
- [ ] Implement basic Stratum V1 server
- [ ] Add share validation logic
- [ ] Implement VarDiff algorithm
- [ ] Create worker authentication
- [ ] Setup Fastify API server
- [ ] Implement core API endpoints
- [ ] Add WebSocket real-time updates
- [ ] Configure HAProxy load balancer
- [ ] Setup Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Write integration tests
- [ ] Document API endpoints

---

## References

- [Stratum Protocol Spec](https://slushpool.com/help/stratum-protocol)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
