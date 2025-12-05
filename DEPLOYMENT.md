# VIDDHANA POOL - Deployment & Operations Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Service Details](#service-details)
5. [Configuration](#configuration)
6. [CORS Configuration](#cors-configuration)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Development](#development)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDDHANA POOL ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Web App    │────▶│ Nginx Proxy  │────▶│   API Server │                 │
│  │  (Next.js)   │     │  (Container) │     │  (Fastify)   │                 │
│  │   Static     │     │  Port: 80    │     │  Port: 5001  │                 │
│  └──────────────┘     └──────┬───────┘     └──────┬───────┘                 │
│                              │                     │                         │
│                              │              ┌──────┴───────┐                 │
│                              │              │  PostgreSQL  │                 │
│                              │              │ (TimescaleDB)│                 │
│                              │              │  Port: 5432  │                 │
│                              │              └──────────────┘                 │
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
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        CLOUDFLARE TUNNEL                                 ││
│  │  pool.viddhana.com -> nginx:80 -> frontend + /api -> API:5001           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Purpose | Port |
|-----------|------------|---------|------|
| Web Frontend | Next.js 14 (Static Export) | User dashboard, pool stats, miner management | nginx:80 |
| Nginx Proxy | Nginx (Docker) | Reverse proxy, CORS handling, static files | 80 |
| API Server | Fastify + TypeScript | REST API, WebSocket, authentication | 5001 |
| Stratum Server | Go | Mining protocol, share validation, job distribution | 3333 |
| Prometheus AI | Python + PyTorch | Earnings prediction, difficulty forecasting, anomaly detection | 8000 |
| PostgreSQL | TimescaleDB | Persistent storage, time-series data | 5432 |
| Redis | Redis 7 | Caching, real-time data, session storage | 6379 |
| Cloudflare Tunnel | cloudflared | Public access via pool.viddhana.com | - |

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
cd /home/realcodes/Viddhana_pool/infrastructure/docker

# Start database services
docker-compose up -d postgres redis

# Verify containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### 2. Initialize Database

```bash
cd /home/realcodes/Viddhana_pool/apps/api

# Push Prisma schema to database
npx prisma db push --force-reset

# (Optional) Generate Prisma client
npx prisma generate
```

### 3. Start API Server with PM2

```bash
cd /home/realcodes/Viddhana_pool/apps/api

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Start with PM2 (recommended for production)
PORT=5001 CORS_ORIGIN="*" pm2 start dist/index.js --name "viddhana-pool-api"

# Save PM2 config for auto-restart
pm2 save

# Or start directly (development)
PORT=5001 CORS_ORIGIN="*" node dist/index.js
```

### 4. Build and Deploy Web Frontend

```bash
cd /home/realcodes/Viddhana_pool/apps/web

# Install dependencies
pnpm install

# Build static export
pnpm build

# Copy to Docker container (if using nginx container)
docker cp out/. chocochoco-viddhana-pool-1:/usr/share/nginx/html/
docker exec chocochoco-viddhana-pool-1 nginx -s reload
```

### 5. Start Stratum Server

```bash
# Build Docker image
cd /home/realcodes/Viddhana_pool/apps/stratum
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

**Port:** 5001 (configurable via `PORT` env)

**Process Manager:** PM2 (recommended)

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
DATABASE_URL=postgresql://viddhana:viddhana_secret@localhost:5432/viddhana_pool

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server
PORT=5001
HOST=0.0.0.0
NODE_ENV=development

# CORS - Important!
# Single origin:
CORS_ORIGIN=https://pool.viddhana.com
# Multiple origins (comma-separated):
CORS_ORIGIN=https://pool.viddhana.com,http://localhost:3000
# Allow all origins:
CORS_ORIGIN=*
```

---

### Web Frontend (Next.js)

**Location:** `apps/web/`

**Build Mode:** Static Export (`output: 'export'`)

**Deployment:** Nginx container serving static files

**Key Pages:**
| Route | Description |
|-------|-------------|
| `/` | Home page with hero section |
| `/pools` | Available mining pools |
| `/blocks` | Recent blocks found |
| `/leaderboard` | Top miners |
| `/dashboard` | User dashboard (authenticated) |
| `/dashboard/workers` | Worker management |

**Build Commands:**
```bash
# Build static files
cd /home/realcodes/Viddhana_pool/apps/web
pnpm build

# Output directory: ./out/
```

**Nginx Configuration:**
The frontend uses nginx to:
1. Serve static files from `/usr/share/nginx/html/`
2. Proxy `/api/*` requests to the API server (port 5001)
3. Handle CORS for API requests

**Environment Variables (build-time):**
```bash
# These are baked into the build
NEXT_PUBLIC_API_URL=  # Empty for relative URLs (nginx proxy)
NEXT_PUBLIC_WS_URL=ws://localhost:5001
NEXT_PUBLIC_CHAIN_ID=202401
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
- Use `172.18.0.1` as the host IP (Docker bridge network gateway for `chocochoco_default`)
- Or use `--add-host=host.docker.internal:172.18.0.1`

---

## CORS Configuration

### Overview

CORS (Cross-Origin Resource Sharing) is configured in multiple places to ensure the frontend can communicate with the API:

1. **API Server** (`apps/api/src/app.ts`) - Primary CORS handling
2. **WebSocket** (`apps/api/src/websocket/index.ts`) - Socket.io CORS
3. **Nginx Proxy** - Backup CORS headers for preflight requests

### API Server CORS Settings

The API supports flexible CORS configuration via `CORS_ORIGIN` environment variable:

```typescript
// In apps/api/src/app.ts
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
```

**Configuration Examples:**

```bash
# Single origin
CORS_ORIGIN=https://pool.viddhana.com

# Multiple origins (comma-separated)
CORS_ORIGIN=https://pool.viddhana.com,http://localhost:3000,http://localhost:3004

# Allow all origins (development only!)
CORS_ORIGIN=*
```

### Nginx Proxy CORS Configuration

The nginx container also handles CORS for API requests:

```nginx
# In /etc/nginx/conf.d/default.conf (inside container)
location /api {
    proxy_pass http://172.18.0.1:5001;
    
    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization, X-Requested-With, Accept, Origin' always;
        add_header Access-Control-Max-Age 86400;
        return 204;
    }
    
    # Add CORS headers for non-OPTIONS requests
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Credentials true always;
}
```

### Updating Nginx CORS Config

To update the nginx configuration in the running container:

```bash
# Create new config
cat > /tmp/viddhana-pool-nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass http://172.18.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;
        
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Credentials true always;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization, X-Requested-With, Accept, Origin' always;
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Apply to container
docker cp /tmp/viddhana-pool-nginx.conf chocochoco-viddhana-pool-1:/etc/nginx/conf.d/default.conf
docker exec chocochoco-viddhana-pool-1 nginx -t && docker exec chocochoco-viddhana-pool-1 nginx -s reload
```

### Testing CORS

```bash
# Test preflight (OPTIONS) request
curl -s -X OPTIONS "http://172.21.0.3:80/api/stats" \
  -H "Origin: https://pool.viddhana.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control"

# Expected output:
# < Access-Control-Allow-Origin: https://pool.viddhana.com
# < Access-Control-Allow-Credentials: true
# < Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
# < Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin

# Test actual GET request
curl -s "http://172.21.0.3:80/api" -H "Origin: https://pool.viddhana.com"
# Expected: {"name":"ViddhanaPool API","version":"1.0.0","documentation":"/api/docs"}
```

### Common CORS Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `No 'Access-Control-Allow-Origin' header` | CORS not configured | Set `CORS_ORIGIN` env variable |
| `Preflight response is not successful` | OPTIONS request blocked | Ensure nginx handles OPTIONS method |
| `Credential is not supported if CORS header 'Access-Control-Allow-Origin' is '*'` | Using `*` with credentials | Use specific origin instead of `*` |
| `The value of 'Access-Control-Allow-Origin' header must not be the wildcard '*'` | Credentials with wildcard | Set specific origin in `CORS_ORIGIN` |

---

## API Reference

### Authentication

**Register/Login with Wallet:**
```bash
curl -X POST http://localhost:5001/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "...", "message": "..."}'
```

**Get Pool Stats:**
```bash
curl http://localhost:5001/api/stats/pool
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
curl http://localhost:5001/api/stats/leaderboard
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

**3. Web frontend can't reach API (CORS error)**
```bash
# Verify API is running
curl http://localhost:5001/health

# Check CORS configuration
curl -s -X OPTIONS "http://localhost:5001/api" \
  -H "Origin: https://pool.viddhana.com" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -i "access-control"

# Fix: Restart API with correct CORS_ORIGIN
pm2 stop viddhana-pool-api
CORS_ORIGIN="*" pm2 start dist/index.js --name viddhana-pool-api

# Or update nginx config for /api proxy
```

**4. Redis connection refused**
```bash
# Check Redis container
docker ps | grep redis

# Test connection
docker exec -it viddhana-redis redis-cli ping
```

**5. PM2 process not running**
```bash
# Check PM2 status
pm2 list

# Restart if needed
pm2 restart viddhana-pool-api

# View logs
pm2 logs viddhana-pool-api --lines 50
```

### Logs

**API Logs (PM2):**
```bash
# View real-time logs
pm2 logs viddhana-pool-api

# View log files
cat ~/.pm2/logs/viddhana-pool-api-out.log
cat ~/.pm2/logs/viddhana-pool-api-error.log
```

**API Logs (direct):**
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
Viddhana_pool/
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
│   └── web/              # Next.js frontend (Static Export)
│       ├── app/          # Pages (App Router)
│       ├── components/   # React components
│       ├── lib/          # API client, utilities
│       └── out/          # Static build output
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
| API | PM2: `viddhana-pool-api` | 5001 | Running |
| Web | `chocochoco-viddhana-pool-1` (nginx) | 80 (internal) | Running |
| Stratum | `viddhana-stratum` | 3333, 9091 | Running |
| Cloudflare Tunnel | `cloudflared` | - | Running |
| Prometheus AI | Not started | 8000 | Pending |

### Public URLs

| Service | URL |
|---------|-----|
| Pool Frontend | https://pool.viddhana.com |
| Pool API (via nginx) | https://pool.viddhana.com/api |
| RPC | https://rpc.viddhana.com |
| Block Explorer | https://scan.viddhana.com |

### Quick Health Check

```bash
# All services
curl -s http://localhost:5001/health && echo " API OK"
curl -s http://localhost:9091/health && echo " Stratum OK"
curl -s http://172.21.0.3:80 > /dev/null && echo " Web OK"
docker exec viddhana-redis redis-cli ping
docker exec viddhana-postgres pg_isready -U viddhana

# PM2 status
pm2 list

# Test CORS
curl -s "http://172.21.0.3:80/api" -H "Origin: https://pool.viddhana.com"
```

---

## Next Steps

1. **Prometheus AI** - Build and deploy the AI service for predictions
2. **Smart Contracts** - Deploy to testnet (packages/contracts)
3. **Production Deployment** - Use Kubernetes manifests in infrastructure/k8s/
4. **Monitoring** - Set up Prometheus + Grafana for metrics
5. **Cloudflare Tunnel** - Add `pool-api.viddhana.com` subdomain for direct API access

---

*Last Updated: December 5, 2025*
