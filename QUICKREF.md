# VIDDHANA POOL - Quick Reference Card

## Service URLs (Production)

| Service | URL | Status |
|---------|-----|--------|
| Web Frontend | https://pool.viddhana.com | Cloudflare Tunnel |
| Web Frontend (local) | http://172.21.0.3:80 | Nginx Container |
| API Server | http://localhost:5001 | PM2 Managed |
| API (via proxy) | https://pool.viddhana.com/api | Nginx Proxy |
| API Health | http://localhost:5001/health | Running |
| Stratum Mining | tcp://localhost:3333 | Running |
| Stratum Metrics | http://localhost:9091/metrics | Running |
| PostgreSQL | localhost:5432 | Docker |
| Redis | localhost:6379 | Docker |

---

## Quick Commands

### Start All Services

```bash
# 1. Infrastructure (Docker containers)
cd /home/realcodes/Viddhana_pool/infrastructure/docker
docker-compose up -d viddhana-postgres viddhana-redis

# 2. API via PM2 (already configured)
cd /home/realcodes/Viddhana_pool/apps/api
pm2 start dist/index.js --name "viddhana-pool-api"
# Or if already saved:
pm2 resurrect

# 3. Web (static files already deployed to nginx container)
# No action needed - nginx serves from /usr/share/nginx/html/

# 4. Stratum
docker start viddhana-stratum
# Or if not created:
docker run -d --name viddhana-stratum \
  -p 3333:3333 -p 9091:9090 \
  --add-host=host.docker.internal:172.17.0.1 \
  -v /home/realcodes/Viddhana_pool/apps/stratum/configs/config.local.yaml:/app/configs/config.yaml:ro \
  viddhana-stratum:latest
```

### PM2 Commands (API)

```bash
# Start API
PORT=5001 CORS_ORIGIN="*" pm2 start dist/index.js --name "viddhana-pool-api"

# Status
pm2 status

# Logs
pm2 logs viddhana-pool-api

# Restart
pm2 restart viddhana-pool-api

# Stop
pm2 stop viddhana-pool-api

# Save current config (persists across reboots)
pm2 save

# Restore saved config
pm2 resurrect

# Auto-start on boot
pm2 startup
```

### Stop All Services

```bash
# Stop PM2 apps
pm2 stop all

# Stop containers
docker stop viddhana-stratum viddhana-postgres viddhana-redis
```

### Health Checks

```bash
# API
curl http://localhost:5001/health

# API via nginx proxy
curl https://pool.viddhana.com/api/health

# Stratum
curl http://localhost:9091/health

# PostgreSQL
docker exec viddhana-postgres pg_isready -U viddhana

# Redis
docker exec viddhana-redis redis-cli ping

# Nginx container
docker exec chocochoco-viddhana-pool-1 nginx -t
```

---

## Deployment (Frontend)

```bash
# 1. Build static files
cd /home/realcodes/Viddhana_pool/apps/web
pnpm build

# 2. Copy to nginx container
docker cp out/. chocochoco-viddhana-pool-1:/usr/share/nginx/html/

# 3. Verify
curl https://pool.viddhana.com
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
curl http://localhost:5001/api/stats/pool

# Network stats
curl http://localhost:5001/api/stats/network

# Leaderboard
curl http://localhost:5001/api/stats/leaderboard

# Recent blocks
curl http://localhost:5001/api/blocks
```

### Authenticated Endpoints (require JWT)

```bash
# Get auth token first via wallet connect
curl -X POST http://localhost:5001/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "...", "message": "..."}'

# Then use token
curl http://localhost:5001/api/stats/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Logs & Debugging

```bash
# API logs (PM2)
pm2 logs viddhana-pool-api

# Stratum logs
docker logs -f viddhana-stratum

# PostgreSQL logs
docker logs viddhana-postgres

# Redis logs
docker logs viddhana-redis

# Nginx access logs
docker exec chocochoco-viddhana-pool-1 tail -f /var/log/nginx/access.log

# Nginx error logs
docker exec chocochoco-viddhana-pool-1 tail -f /var/log/nginx/error.log
```

---

## Common Fixes

### Port already in use
```bash
# Find process
lsof -i :5001
# Kill it
kill -9 <PID>
```

### Database connection failed
```bash
# Restart PostgreSQL
docker restart viddhana-postgres
```

### CORS Issues
```bash
# Test CORS headers
curl -I -X OPTIONS http://localhost:5001/api/health \
  -H "Origin: https://pool.viddhana.com" \
  -H "Access-Control-Request-Method: GET"

# Should return:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
```

### Stratum can't connect to host DB
```bash
# Use Docker bridge IP
# In config.local.yaml, use 172.17.0.1 instead of localhost
```

### Rebuild after code changes

```bash
# API
cd /home/realcodes/Viddhana_pool/apps/api
pnpm build
pm2 restart viddhana-pool-api

# Web (static export)
cd /home/realcodes/Viddhana_pool/apps/web
pnpm build
docker cp out/. chocochoco-viddhana-pool-1:/usr/share/nginx/html/

# Stratum
cd /home/realcodes/Viddhana_pool/apps/stratum
docker build -t viddhana-stratum:latest .
docker rm -f viddhana-stratum
# Then run again
```

---

## Network Architecture

```
Internet
    │
    ▼
Cloudflare Tunnel (blockscan)
    │
    ├─► pool.viddhana.com ──► nginx container (172.21.0.3:80)
    │                              │
    │                              ├─► /api/* ──► http://172.18.0.1:5001 (API)
    │                              └─► /*     ──► static files
    │
    └─► pool-api.viddhana.com ──► http://localhost:5001 (API direct)
```

---

## File Locations

```
/home/realcodes/Viddhana_pool/
├── apps/api/                 # API server
│   ├── .env                  # Environment config
│   ├── dist/                 # Built JS files
│   └── prisma/schema.prisma  # Database schema
├── apps/web/                 # Web frontend
│   ├── .env.local            # Environment config
│   ├── next.config.js        # Next.js config (output: 'export')
│   └── out/                  # Static build output
├── apps/stratum/             # Stratum server
│   └── configs/config.local.yaml
├── infrastructure/docker/    # Docker configs
│   └── docker-compose.yml
├── DEPLOYMENT.md             # Full documentation
└── QUICKREF.md               # This file
```

---

## Cloudflare Tunnel Config

Location: `/etc/cloudflared/config.yml`

To update (requires sudo):
```bash
sudo cp /tmp/cloudflared-config.yml /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

---

*Updated: December 5, 2025*
