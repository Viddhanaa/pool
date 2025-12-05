# VIDDHANA POOL - Deployment & Operations Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Service Details](#service-details)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Development](#development)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDDHANA POOL ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Web App    │────▶│   API Server │────▶│  PostgreSQL  │                 │
│  │  (Next.js)   │     │  (Fastify)   │     │ (TimescaleDB)│                 │
│  │  Port: 3004  │     │  Port: 4444  │     │  Port: 5432  │                 │
│  └──────────────┘     └──────┬───────┘     └──────────────┘                 │
│                              │                                               │
│                              ▼                                               │
│                       ┌──────────────┐     ┌──────────────┐                 │
│                       │    Redis     │     │ Prometheus AI│                 │
│                       │  Port: 6379  │     │  Port: 8000  │                 │
│                       └──────┬───────┘     └──────────────┘                 │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Miners     │────▶│   Stratum    │────▶│  Blockchain  │                 │
│  │  (Workers)   │     │  Port: 3333  │     │    Node      │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Frontend | Next.js 14 | User dashboard, pool stats, miner management |
| API Server | Fastify + TypeScript | REST API, WebSocket, authentication |
| Stratum Server | Go | Mining protocol, share validation, job distribution |
| Prometheus AI | Python + PyTorch | Earnings prediction, difficulty forecasting, anomaly detection |
| PostgreSQL | TimescaleDB | Persistent storage, time-series data |
| Redis | Redis 7 | Caching, real-time data, session storage |

---

## Prerequisites

### Required Software
- Docker & Docker Compose
- Node.js 18+ with pnpm
- Go 1.21+ (for local Stratum development)
- Python 3.10+ (for local AI development)

### System Requirements
- CPU: 4+ cores recommended
- RAM: 8GB minimum, 16GB recommended
- Storage: 50GB+ SSD

---

## Quick Start

### 1. Start Infrastructure (PostgreSQL + Redis)

```bash
cd /home/realcodes/Chocochoco/infrastructure/docker

# Start database services
docker-compose up -d viddhana-postgres viddhana-redis

# Verify containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 2. Initialize Database

```bash
cd /home/realcodes/Chocochoco/apps/api

# Push Prisma schema to database
npx prisma db push --force-reset

# (Optional) Generate Prisma client
npx prisma generate
```

### 3. Start API Server

```bash
cd /home/realcodes/Chocochoco/apps/api

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Start server (port 4444)
PORT=4444 pnpm start
```

### 4. Start Web Frontend

```bash
cd /home/realcodes/Chocochoco/apps/web

# Install dependencies
pnpm install

# Start dev server (port 3004)
PORT=3004 pnpm dev
```

### 5. Start Stratum Server

```bash
# Build Docker image
cd /home/realcodes/Chocochoco/apps/stratum
docker build -t viddhana-stratum:latest .

# Run container
docker run -d --name viddhana-stratum \
  -p 3333:3333 \
  -p 9091:9090 \
  --add-host=host.docker.internal:172.17.0.1 \
  -v $(pwd)/configs/config.local.yaml:/app/configs/config.yaml:ro \
  viddhana-stratum:latest
```

---

## Service Details

### API Server (Fastify)

**Location:** `apps/api/`

**Port:** 4444 (configurable via `PORT` env)

**Key Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with DB/Redis status |
| `/ready` | GET | Kubernetes readiness probe |
| `/api` | GET | API version info |
| `/api/auth/*` | ALL | Authentication routes |
| `/api/stats/*` | GET | Pool and user statistics |
| `/api/workers/*` | ALL | Worker management |
| `/api/blocks/*` | GET | Block information |
| `/api/payouts/*` | ALL | Payout management |
| `/api/dashboard/*` | GET | Dashboard data |
| `/api/ai/*` | ALL | AI predictions |

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://viddhana:viddhana_secret_2024@localhost:5432/viddhana_pool

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server
PORT=4444
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:3004
```

---

### Web Frontend (Next.js)

**Location:** `apps/web/`

**Port:** 3004 (configurable via `PORT` env)

**Key Pages:**
| Route | Description |
|-------|-------------|
| `/` | Home page with hero section |
| `/pools` | Available mining pools |
| `/blocks` | Recent blocks found |
| `/leaderboard` | Top miners |
| `/dashboard` | User dashboard (authenticated) |
| `/dashboard/workers` | Worker management |

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:4444
NEXT_PUBLIC_WS_URL=ws://localhost:4444
NEXT_PUBLIC_CHAIN_ID=1
```

---

### Stratum Server (Go)

**Location:** `apps/stratum/`

**Ports:**
- 3333: Stratum mining protocol (TCP)
- 9090/9091: Prometheus metrics (HTTP)

**Configuration (`configs/config.local.yaml`):**
```yaml
server:
  host: "0.0.0.0"
  port: 3333
  max_connections: 10000
  
mining:
  initial_difficulty: 1.0
  min_difficulty: 0.001
  max_difficulty: 1000000.0
  target_share_time: 10s

redis:
  host: "172.17.0.1"  # Docker host
  port: 6379

postgres:
  host: "172.17.0.1"
  port: 5432
  database: "viddhana_pool"
  user: "viddhana"
  password: "viddhana_secret_2024"
```

**Database Tables (prefixed with `stratum_`):**
- `stratum_workers` - Connected mining workers
- `stratum_shares` - Submitted shares
- `stratum_blocks` - Found blocks
- `stratum_payouts` - Payout records

---

### Prometheus AI (Python)

**Location:** `packages/ai-models/`

**Port:** 8000

**Key Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health |
| `/api/v1/predict/earnings` | POST | Predict worker earnings |
| `/api/v1/predict/difficulty` | POST | Predict network difficulty |
| `/api/v1/sentinel/detect` | POST | Anomaly detection |
| `/api/v1/optimize/worker` | POST | Worker optimization suggestions |

**Environment Variables:**
```bash
PROMETHEUS_ENVIRONMENT=development
PROMETHEUS_DB_HOST=localhost
PROMETHEUS_DB_PORT=5432
PROMETHEUS_DB_NAME=viddhana_pool
PROMETHEUS_DB_USER=viddhana
PROMETHEUS_DB_PASSWORD=viddhana_secret_2024
PROMETHEUS_REDIS_HOST=localhost
PROMETHEUS_REDIS_PORT=6379
```

---

## Configuration

### Database Credentials

**PostgreSQL:**
- Host: `localhost` (or `172.17.0.1` from Docker)
- Port: `5432`
- Database: `viddhana_pool`
- User: `viddhana`
- Password: `viddhana_secret_2024`

**Redis:**
- Host: `localhost` (or `172.17.0.1` from Docker)
- Port: `6379`
- No password (development)

### Docker Network

When running services in Docker that need to connect to host services:
- Use `172.17.0.1` as the host IP (Docker bridge network gateway)
- Or use `--add-host=host.docker.internal:172.17.0.1`

---

## API Reference

### Authentication

**Register/Login with Wallet:**
```bash
curl -X POST http://localhost:4444/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "...", "message": "..."}'
```

**Get Pool Stats:**
```bash
curl http://localhost:4444/api/stats/pool
```

Response:
```json
{
  "stats": {
    "hashrate": 0,
    "activeWorkers": 0,
    "activeMiners": 0,
    "blocksFound": 0,
    "totalPaid": 0,
    "difficulty": 0,
    "networkHashrate": 0,
    "lastBlockTime": null,
    "poolFee": 1
  }
}
```

**Get Leaderboard:**
```bash
curl http://localhost:4444/api/stats/leaderboard
```

---

## Troubleshooting

### Common Issues

**1. API can't connect to database**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it viddhana-postgres psql -U viddhana -d viddhana_pool -c "SELECT 1"
```

**2. Stratum server fails to start**
```bash
# Check logs
docker logs viddhana-stratum

# Common fix: regenerate go.sum
cd apps/stratum
rm go.sum
docker run --rm -v "$(pwd)":/app -w /app golang:1.21-alpine go mod tidy
```

**3. Web frontend can't reach API**
```bash
# Verify API is running
curl http://localhost:4444/health

# Check CORS settings in API
# Ensure CORS_ORIGIN includes frontend URL
```

**4. Redis connection refused**
```bash
# Check Redis container
docker ps | grep redis

# Test connection
docker exec -it viddhana-redis redis-cli ping
```

### Logs

**API Logs:**
```bash
# If running directly
pnpm start 2>&1 | tee api.log

# Check for errors
grep -i error api.log
```

**Stratum Logs:**
```bash
docker logs -f viddhana-stratum
```

**Database Logs:**
```bash
docker logs viddhana-postgres
```

---

## Development

### Project Structure

```
Chocochoco/
├── apps/
│   ├── api/              # Fastify API server
│   │   ├── prisma/       # Database schema
│   │   ├── src/
│   │   │   ├── lib/      # Database, Redis, Logger
│   │   │   ├── middleware/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   └── websocket/
│   │   └── package.json
│   ├── stratum/          # Go Stratum server
│   │   ├── cmd/stratum/  # Entry point
│   │   ├── internal/     # Core logic
│   │   └── configs/      # YAML configs
│   └── web/              # Next.js frontend
│       ├── app/          # Pages (App Router)
│       ├── components/   # React components
│       └── hooks/        # Custom hooks
├── packages/
│   ├── ai-models/        # Prometheus AI (Python)
│   ├── contracts/        # Solidity smart contracts
│   └── shared/           # Shared TypeScript utilities
├── infrastructure/
│   ├── docker/           # Docker configs
│   ├── k8s/              # Kubernetes manifests
│   └── terraform/        # Infrastructure as code
└── llm_docs/             # Project documentation
```

### Running Tests

**API Tests:**
```bash
cd apps/api
pnpm test
```

**Contract Tests:**
```bash
cd packages/contracts
npx hardhat test
```

**AI Model Tests:**
```bash
cd packages/ai-models
pytest tests/
```

### Building for Production

**API:**
```bash
cd apps/api
pnpm build
docker build -t viddhana-api:latest -f ../../infrastructure/docker/Dockerfile.api ../..
```

**Web:**
```bash
cd apps/web
pnpm build
docker build -t viddhana-web:latest -f ../../infrastructure/docker/Dockerfile.web ../..
```

**Stratum:**
```bash
cd apps/stratum
docker build -t viddhana-stratum:latest .
```

---

## Current Service Status

| Service | Container/Process | Port | Status |
|---------|------------------|------|--------|
| PostgreSQL | `viddhana-postgres` | 5432 | Running |
| Redis | `viddhana-redis` | 6379 | Running |
| API | Local process | 4444 | Running |
| Web | Local process | 3004 | Running |
| Stratum | `viddhana-stratum` | 3333, 9091 | Running |
| Prometheus AI | Not started | 8000 | Pending |

### Quick Health Check

```bash
# All services
curl -s http://localhost:4444/health && echo " API OK"
curl -s http://localhost:9091/health && echo " Stratum OK"
curl -s http://localhost:3004 > /dev/null && echo "Web OK"
docker exec viddhana-redis redis-cli ping
docker exec viddhana-postgres pg_isready -U viddhana
```

---

## Next Steps

1. **Prometheus AI** - Build and deploy the AI service for predictions
2. **Smart Contracts** - Deploy to testnet (packages/contracts)
3. **Production Deployment** - Use Kubernetes manifests in infrastructure/k8s/
4. **Monitoring** - Set up Prometheus + Grafana for metrics

---

*Last Updated: December 4, 2025*
