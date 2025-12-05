# VIDDHANA POOL - Quick Reference Card

## Service URLs (Current)

| Service | URL | Status |
|---------|-----|--------|
| Web Frontend | http://localhost:3004 | Running |
| API Server | http://localhost:4444 | Running |
| API Health | http://localhost:4444/health | Running |
| Stratum Mining | tcp://localhost:3333 | Running |
| Stratum Metrics | http://localhost:9091/metrics | Running |
| PostgreSQL | localhost:5432 | Running |
| Redis | localhost:6379 | Running |

---

## Quick Commands

### Start All Services

```bash
# 1. Infrastructure
cd /home/realcodes/Chocochoco/infrastructure/docker
docker-compose up -d viddhana-postgres viddhana-redis

# 2. API (new terminal)
cd /home/realcodes/Chocochoco/apps/api
PORT=4444 pnpm start

# 3. Web (new terminal)
cd /home/realcodes/Chocochoco/apps/web
PORT=3004 pnpm dev

# 4. Stratum
docker start viddhana-stratum
# Or if not created:
docker run -d --name viddhana-stratum \
  -p 3333:3333 -p 9091:9090 \
  --add-host=host.docker.internal:172.17.0.1 \
  -v /home/realcodes/Chocochoco/apps/stratum/configs/config.local.yaml:/app/configs/config.yaml:ro \
  viddhana-stratum:latest
```

### Stop All Services

```bash
# Stop containers
docker stop viddhana-stratum viddhana-postgres viddhana-redis

# Kill Node processes (if running in foreground, use Ctrl+C)
pkill -f "node.*api" 
pkill -f "next-server"
```

### Health Checks

```bash
# API
curl http://localhost:4444/health

# Stratum
curl http://localhost:9091/health

# PostgreSQL
docker exec viddhana-postgres pg_isready -U viddhana

# Redis
docker exec viddhana-redis redis-cli ping
```

---

## Database Access

### PostgreSQL

```bash
# Connect via Docker
docker exec -it viddhana-postgres psql -U viddhana -d viddhana_pool

# Connection string
postgresql://viddhana:viddhana_secret_2024@localhost:5432/viddhana_pool
```

### Key Tables (Prisma)
- `users` - User accounts
- `workers` - Mining workers
- `shares` - Mining shares
- `blocks` - Found blocks
- `payouts` - Payout records
- `pool_stats` - Pool statistics

### Key Tables (Stratum)
- `stratum_workers` - Stratum worker connections
- `stratum_shares` - Stratum shares
- `stratum_blocks` - Stratum blocks
- `stratum_payouts` - Stratum payouts

---

## API Endpoints

### Public Endpoints

```bash
# Pool stats
curl http://localhost:4444/api/stats/pool

# Network stats
curl http://localhost:4444/api/stats/network

# Leaderboard
curl http://localhost:4444/api/stats/leaderboard

# Recent blocks
curl http://localhost:4444/api/blocks
```

### Authenticated Endpoints (require JWT)

```bash
# Get auth token first via wallet connect
curl -X POST http://localhost:4444/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "...", "message": "..."}'

# Then use token
curl http://localhost:4444/api/stats/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Logs & Debugging

```bash
# API logs (if running in terminal, logs go to stdout)

# Stratum logs
docker logs -f viddhana-stratum

# PostgreSQL logs
docker logs viddhana-postgres

# Redis logs
docker logs viddhana-redis
```

---

## Common Fixes

### Port already in use
```bash
# Find process
lsof -i :4444
# Kill it
kill -9 <PID>
```

### Database connection failed
```bash
# Restart PostgreSQL
docker restart viddhana-postgres
```

### Stratum can't connect to host DB
```bash
# Use Docker bridge IP
# In config.local.yaml, use 172.17.0.1 instead of localhost
```

### Rebuild after code changes
```bash
# API
cd apps/api && pnpm build

# Stratum
cd apps/stratum && docker build -t viddhana-stratum:latest .
docker rm -f viddhana-stratum
# Then run again
```

---

## File Locations

```
/home/realcodes/Chocochoco/
├── apps/api/                 # API server
│   ├── .env                  # Environment config
│   └── prisma/schema.prisma  # Database schema
├── apps/web/                 # Web frontend
│   └── .env.local            # Environment config
├── apps/stratum/             # Stratum server
│   └── configs/config.local.yaml
├── infrastructure/docker/    # Docker configs
│   └── docker-compose.yml
└── DEPLOYMENT.md             # Full documentation
```

---

*Generated: December 4, 2025*
