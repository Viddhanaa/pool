# Blockscout Production Deployment Guide

## Current Status ✓

**Deployed:** December 3, 2025
**URL:** https://scan.viddhana.com
**Status:** All services operational

### Services

- **Frontend:** Next.js 15.2.3 (ghcr.io/blockscout/frontend:latest)
- **Backend:** Elixir/Phoenix (blockscout/blockscout:latest)
- **Database:** PostgreSQL 15-alpine (300 max connections)
- **Proxy:** Nginx 1.29.3 (port 4001)
- **Tunnel:** Cloudflare QUIC tunnel

### Current Metrics

- **Blocks Indexed:** 88,512+
- **Transactions:** 850+
- **Database Connections:** ~106/300
- **Disk Usage:** 13%
- **API Response Time:** ~0.5s

---

## Architecture

```
Internet → Cloudflare Tunnel (scan.viddhana.com)
    ↓
Nginx Proxy (:4001)
    ├── / → Frontend (:3000)
    ├── /api/* → Backend (:4002)
    └── /socket/* → Backend WebSocket
        ↓
Blockscout Backend (:4002)
    ↓
PostgreSQL (:5432)
    ↓
Geth Node (:8545)
```

---

## Management Commands

### Quick Status Check
```bash
./status.sh
```

### Manual Health Check
```bash
./monitor-blockscout.sh
```

### Database Backup
```bash
./backup-blockscout-db.sh
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker logs -f chocochoco-blockscout-1
docker logs -f chocochoco-blockscout-frontend-1
docker logs -f chocochoco-blockscout-db-1

# Monitoring logs
tail -f /var/log/blockscout-monitor.log
```

### Restart Services
```bash
# All services
docker compose restart

# Specific service
docker restart chocochoco-blockscout-frontend-1
docker restart chocochoco-blockscout-1
docker restart chocochoco-blockscout-db-1
```

### Stop/Start Services
```bash
# Stop all
docker compose --profile explorer down

# Start all
docker compose --profile explorer up -d

# Or use systemd
sudo systemctl start blockscout
sudo systemctl stop blockscout
```

---

## Automated Tasks

### Health Monitoring (Every 5 minutes)
- Checks container status
- Monitors database connections (alerts at >90%)
- Verifies block indexing progress
- Tests API availability
- Checks disk space (alerts at >85%)
- Auto-restarts failed containers

**Log:** `/var/log/blockscout-monitor.log`
**Cron:** `*/5 * * * * /home/realcodes/Chocochoco/monitor-blockscout.sh`

### Database Backup (Daily 2 AM)
- Full PostgreSQL dump
- Gzip compressed
- Keeps last 7 days
- Location: `/home/realcodes/blockscout-backups/`

**Cron:** `0 2 * * * /home/realcodes/Chocochoco/backup-blockscout-db.sh`

### Log Rotation (Daily)
- Rotates monitoring logs
- Compresses old logs
- Keeps 7 days history
- Docker logs: max 10MB × 3 files per container

**Config:** `/etc/logrotate.d/blockscout`

### Auto-Start on Boot
- Systemd service enabled
- Starts after Docker daemon
- Automatic restart on failure

**Service:** `blockscout.service`

---

## Configuration Files

### docker-compose.yml
**Key Settings:**
- PostgreSQL: `max_connections=300`, `shared_buffers=256MB`
- Frontend: API routes via same-origin `/api/*` (no CORS)
- Backend: API v2 enabled, internal transactions enabled
- All services: `restart: unless-stopped`

### /etc/cloudflared/config.yml
**Tunnel Routes:**
- `scan.viddhana.com` → `localhost:4001`
- `pool.viddhana.com` → `localhost:4000`
- `docs.viddhana.com` → `localhost:4180`
- `rpc.viddhana.com` → `localhost:8545`

### infra/nginx/blockscout-proxy.conf
**Proxy Rules:**
- `/` → Frontend (3000)
- `/api/*` → Backend (4002)
- `/socket/*` → Backend WebSocket

---

## Troubleshooting

### "No data. Please reload the page"

**Causes:**
1. Browser cache showing old content
2. API endpoint misconfigured
3. Database connection exhausted

**Solutions:**
```bash
# Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Check API
curl https://scan.viddhana.com/api/v2/stats

# Check database connections
docker exec chocochoco-blockscout-db-1 psql -U postgres -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Restart if needed
docker restart chocochoco-blockscout-frontend-1
```

### Frontend Not Starting

**Check logs:**
```bash
docker logs chocochoco-blockscout-frontend-1
```

**Common issues:**
- Environment variable validation errors
- Missing NEXT_PUBLIC_* variables
- Port conflicts

**Fix:**
```bash
# Verify environment
docker exec chocochoco-blockscout-frontend-1 printenv | grep NEXT_PUBLIC

# Recreate container
docker compose up -d --force-recreate blockscout-frontend
```

### Database "Too Many Clients"

**Check current connections:**
```bash
docker exec chocochoco-blockscout-db-1 psql -U postgres -c \
  "SELECT count(*), max_conn FROM pg_stat_activity, \
   (SELECT setting::int as max_conn FROM pg_settings \
    WHERE name='max_connections') x GROUP BY max_conn;"
```

**If at limit:**
1. Increase `max_connections` in docker-compose.yml
2. Restart database: `docker compose up -d --force-recreate blockscout-db`

### Block Indexer Not Syncing

**Check logs:**
```bash
docker logs chocochoco-blockscout-1 | grep -i "caught up\|catching up"
```

**Check latest block:**
```bash
docker exec chocochoco-blockscout-db-1 psql -U postgres -d blockscout -c \
  "SELECT number, timestamp FROM blocks ORDER BY number DESC LIMIT 5;"
```

**If stuck:**
```bash
# Restart backend
docker restart chocochoco-blockscout-1

# Check Geth node connectivity
docker exec chocochoco-blockscout-1 curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://geth1:8545
```

### Cloudflare Tunnel Down

**Check status:**
```bash
sudo systemctl status cloudflared
```

**Restart tunnel:**
```bash
sudo systemctl restart cloudflared
```

**Check connectivity:**
```bash
curl -I https://scan.viddhana.com
```

---

## Performance Tuning

### Database Optimization

**Current settings (300 connections, 256MB shared buffers):**
```yaml
command:
  - "postgres"
  - "-c"
  - "max_connections=300"
  - "-c"
  - "shared_buffers=256MB"
```

**For high load, increase:**
```yaml
  - "-c"
  - "max_connections=500"
  - "-c"
  - "shared_buffers=512MB"
  - "-c"
  - "work_mem=16MB"
  - "-c"
  - "maintenance_work_mem=128MB"
```

### Frontend Optimization

**Static file caching:** Already configured in nginx
**API caching:** Consider Redis for high-traffic endpoints

### Backend Scaling

**Horizontal scaling:**
- Add read replicas for PostgreSQL
- Load balance multiple backend instances
- Separate indexer from API server

---

## Security Checklist

- [x] Database password set (change in production!)
- [x] Cloudflare tunnel with SSL/TLS
- [x] No direct Docker port exposure (except via localhost)
- [x] Rate limiting via Cloudflare
- [x] CORS headers configured
- [ ] Setup firewall rules (recommended)
- [ ] Enable PostgreSQL SSL (for production)
- [ ] Implement API key authentication (optional)

---

## Monitoring Alerts

**Critical (immediate action):**
- Container not running
- API returning non-200
- Disk usage >90%
- Cloudflared tunnel down

**Warning (monitor):**
- Database connections >90%
- Container restart count >5
- Block indexer lag >100 blocks
- Disk usage >85%

**All alerts logged to:**
- `/var/log/blockscout-monitor.log`
- `/tmp/blockscout-alert.txt` (current)

---

## Backup & Recovery

### Database Backup

**Automatic:** Daily at 2 AM
**Location:** `/home/realcodes/blockscout-backups/`
**Retention:** 7 days

**Manual backup:**
```bash
./backup-blockscout-db.sh
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Restore database
gunzip -c /home/realcodes/blockscout-backups/blockscout_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i chocochoco-blockscout-db-1 psql -U postgres -d blockscout

# Start services
docker compose up -d
```

### Disaster Recovery

**Full stack rebuild:**
```bash
# Backup data
./backup-blockscout-db.sh

# Stop and remove everything
docker compose down -v

# Rebuild and start
docker compose --profile explorer up -d --build

# Restore database (if needed)
# ... restore commands above ...
```

---

## Maintenance Schedule

### Daily
- Automated health checks (every 5 min)
- Database backup (2 AM)
- Log rotation

### Weekly
- Review monitoring logs
- Check disk usage trends
- Verify backup integrity

### Monthly
- Update Docker images
- Review security patches
- Optimize database (VACUUM)
- Test disaster recovery

---

## Support & Resources

**Project Repository:** /home/realcodes/Chocochoco
**Configuration:** docker-compose.yml
**Scripts:**
- status.sh - Quick status
- monitor-blockscout.sh - Health check
- backup-blockscout-db.sh - Database backup
- optimize-blockscout.sh - One-time setup

**Official Documentation:**
- Blockscout: https://docs.blockscout.com
- Docker Compose: https://docs.docker.com/compose
- PostgreSQL: https://www.postgresql.org/docs

---

## Change Log

### 2025-12-03 - Initial Production Deployment
- Fixed double `/api/api/` URL issue (removed NEXT_PUBLIC_API_BASE_PATH)
- Disabled homepage charts (v1 API incompatibility)
- Increased PostgreSQL max_connections to 300
- Added shared_buffers 256MB for better performance
- Setup automated monitoring (5-minute intervals)
- Configured daily database backups
- Implemented Docker log rotation (10MB × 3 files)
- Created systemd auto-start service
- All services stable with 0 restarts

**Status:** ✅ Fully operational
