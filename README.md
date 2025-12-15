# Viddhana Pool

A DePIN (Decentralized Physical Infrastructure Network) mining pool platform with AI-powered hashrate optimization, built on Atlas Chain (Layer 3) for micro-payouts.

![Version](https://img.shields.io/badge/Version-1.0.0-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Node](https://img.shields.io/badge/Node-18+-brightgreen) ![Go](https://img.shields.io/badge/Go-1.21+-00ADD8)

## Live URLs

| Service | URL | Port | Status |
|---------|-----|------|--------|
| Pool Frontend | https://pool.viddhana.com | 3004 | Live |
| Pool API | https://pool-api.viddhana.com | 5001 | Live |
| Stratum Server | stratum+tcp://stratum.viddhana.com:3333 | 3333 | Live |
| Block Explorer | https://explorer.viddhana.com | 15000 | Live |
| RPC Endpoint | https://rpc.viddhana.com | 8545 | Live |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDDHANA POOL ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   Web App    │────▶│   Cloudflare │────▶│   API Server │                 │
│  │  (Next.js)   │     │    Tunnel    │     │  (Fastify)   │                 │
│  │  Port: 3004  │     │              │     │  Port: 5001  │                 │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                 │
│                                                    │                         │
│                              ┌─────────────────────┼────────────────┐       │
│                              │                     │                │       │
│                       ┌──────▼───────┐      ┌──────▼───────┐       │       │
│                       │  PostgreSQL  │      │    Redis     │       │       │
│                       │  Port: 5432  │      │  Port: 6379  │       │       │
│                       └──────────────┘      └──────────────┘       │       │
│                                                                     │       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │       │
│  │   Miners     │────▶│   Stratum    │─────┤ Prometheus AI│       │       │
│  │  (Workers)   │     │  Port: 3333  │     │  Port: 8000  │       │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │       │
│                                                                     │       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 8+
- Go 1.21+
- Docker & Docker Compose
- PostgreSQL 16+ and Redis 7+

### Option 1: Docker (Production)

```bash
cd /home/realcodes/Viddhana_pool

# Start infrastructure
cd infrastructure/docker
docker-compose up -d viddhana-postgres viddhana-redis

# Start API (via PM2)
cd /home/realcodes/Viddhana_pool/apps/api
pnpm build
PORT=5001 CORS_ORIGIN="*" pm2 start dist/index.js --name "viddhana-pool-api"

# Build and serve frontend
cd /home/realcodes/Viddhana_pool/apps/web
pnpm build
npx serve out -l 3004 -s

# Start Stratum server
cd /home/realcodes/Viddhana_pool/apps/stratum
docker build -t viddhana-stratum:latest .
docker run -d --name viddhana-stratum \
  -p 3333:3333 -p 9091:9090 \
  --add-host=host.docker.internal:172.17.0.1 \
  -v $(pwd)/configs/config.local.yaml:/app/configs/config.yaml:ro \
  viddhana-stratum:latest
```

### Option 2: Development Mode

```bash
cd /home/realcodes/Viddhana_pool

# Install dependencies
pnpm install

# Start databases
cd infrastructure/docker
docker-compose up -d viddhana-postgres viddhana-redis

# Run migrations
cd apps/api
npx prisma db push

# Start development servers
pnpm dev
```

## Project Structure

```
Viddhana_pool/
├── apps/
│   ├── api/                    # Fastify + TypeScript API server
│   │   ├── prisma/             # Database schema & migrations
│   │   ├── src/
│   │   │   ├── services/       # Business logic (auth, payout, stats)
│   │   │   ├── websocket/      # Real-time WebSocket handlers
│   │   │   └── index.ts        # Entry point
│   │   └── .env                # Environment config
│   │
│   ├── stratum/                # Golang Stratum mining server
│   │   ├── cmd/stratum/        # Entry point
│   │   ├── internal/
│   │   │   ├── protocol/       # Stratum V1 protocol, VarDiff
│   │   │   ├── server/         # TCP server
│   │   │   └── storage/        # PostgreSQL & Redis clients
│   │   └── configs/            # Configuration files
│   │
│   └── web/                    # Next.js 14 frontend
│       ├── out/                # Static export output
│       └── .env.local          # Frontend config
│
├── packages/
│   ├── ai-models/              # Prometheus AI (Python/PyTorch)
│   ├── contracts/              # Solidity smart contracts (Hardhat)
│   └── shared/                 # Shared TypeScript utilities
│
├── infrastructure/
│   ├── docker/                 # Docker Compose configs
│   └── k8s/                    # Kubernetes manifests
│
├── llm_docs1/                  # Blueprint documentation
│   └── blueprint/              # Technical specifications
│
├── QUICKREF.md                 # Quick reference card
├── DEPLOYMENT.md               # Deployment documentation
└── turbo.json                  # Turborepo config
```

## Services

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| Web Frontend | Next.js 14 (Static) | 3004 | User dashboard, pool stats |
| API Server | Fastify + TypeScript | 5001 | REST API, WebSocket, payouts |
| Stratum Server | Golang 1.21 | 3333 (TCP), 9091 (metrics) | Mining protocol, share validation |
| Prometheus AI | Python + PyTorch | 8000 | Earnings prediction, difficulty forecasting |
| PostgreSQL | TimescaleDB | 5432 | Persistent storage |
| Redis | Redis 7 | 6379 | Caching, real-time data |

## API Endpoints

### Public Endpoints

```bash
# Pool statistics
curl https://pool-api.viddhana.com/api/stats/pool

# Network statistics  
curl https://pool-api.viddhana.com/api/stats/network

# Leaderboard
curl https://pool-api.viddhana.com/api/stats/leaderboard

# Recent blocks
curl https://pool-api.viddhana.com/api/blocks

# Health check
curl https://pool-api.viddhana.com/health
```

### Authenticated Endpoints

```bash
# Wallet authentication
curl -X POST https://pool-api.viddhana.com/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "...", "message": "..."}'

# Dashboard stats (requires JWT)
curl https://pool-api.viddhana.com/api/stats/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Worker management (requires JWT)
curl https://pool-api.viddhana.com/api/workers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database

### Connection

```bash
# PostgreSQL
docker exec -it viddhana-postgres psql -U viddhana -d viddhana_pool

# Connection string
postgresql://viddhana:viddhana_secret_2024@localhost:5432/viddhana_pool
```

### Key Tables

| Table | Purpose |
|-------|---------|
| users | User accounts (wallet-based auth) |
| workers | Mining workers with hashrate, shares |
| shares | Individual share submissions |
| blocks | Found blocks with confirmation status |
| payouts | Payout records with TX status |
| pool_stats | Aggregated pool statistics |

## Environment Variables

### API Server (apps/api/.env)

```env
DATABASE_URL=postgresql://viddhana:viddhana_secret_2024@localhost:5432/viddhana_pool
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=5001
CORS_ORIGIN=*
NODE_ENV=production

# Blockchain
VIDDHANA_RPC_URL=http://viddhana-node1:8545
HOT_WALLET_PRIVATE_KEY=0x...
```

### Frontend (apps/web/.env.local)

```env
NEXT_PUBLIC_API_URL=https://pool-api.viddhana.com
NEXT_PUBLIC_WS_URL=wss://pool-api.viddhana.com
NEXT_PUBLIC_CHAIN_ID=1337
NEXT_PUBLIC_RPC_URL=https://rpc.viddhana.com
```

## Quick Commands

### Service Management

```bash
# PM2 (API)
pm2 status
pm2 logs viddhana-pool-api
pm2 restart viddhana-pool-api

# Docker
docker ps --filter "name=viddhana"
docker logs viddhana-stratum -f
docker restart viddhana-postgres
```

### Build & Deploy

```bash
# Rebuild API
cd apps/api && pnpm build && pm2 restart viddhana-pool-api

# Rebuild Frontend
cd apps/web && pnpm build
# Then restart serve or copy to nginx

# Rebuild Stratum
cd apps/stratum
docker build -t viddhana-stratum:latest .
docker rm -f viddhana-stratum && docker run -d ...
```

### Health Checks

```bash
# API
curl http://localhost:5001/health

# Stratum
curl http://localhost:9091/health

# PostgreSQL
docker exec viddhana-postgres pg_isready -U viddhana

# Redis
docker exec viddhana-redis redis-cli ping
```

## Cloudflare Tunnel Configuration

The pool is exposed via Cloudflare Tunnel. Configuration at `/etc/cloudflared/config.yml`:

```yaml
# Pool Frontend
- hostname: pool.viddhana.com
  service: http://127.0.0.1:3004

# Pool API
- hostname: pool-api.viddhana.com
  service: http://127.0.0.1:5001

# Stratum (TCP)
- hostname: stratum.viddhana.com
  service: tcp://127.0.0.1:3333
```

## Troubleshooting

### Port in use

```bash
lsof -i :5001
kill -9 <PID>
```

### Database connection failed

```bash
docker restart viddhana-postgres
```

### Stratum can't connect to host DB

```bash
# Use Docker bridge IP (172.17.0.1) instead of localhost in config
```

### CORS issues

```bash
curl -I -X OPTIONS http://localhost:5001/api/health \
  -H "Origin: https://pool.viddhana.com" \
  -H "Access-Control-Request-Method: GET"
```

## Documentation

- **[QUICKREF.md](QUICKREF.md)** - Quick reference card
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Full deployment guide
- **[llm_docs1/blueprint/](llm_docs1/blueprint/)** - Technical specifications

## License

MIT License - See [LICENSE](LICENSE) for details.

---

*Last updated: December 11, 2025*
