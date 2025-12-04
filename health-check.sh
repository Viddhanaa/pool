#!/bin/bash
# Pool Health Check & Auto-Fix Script
# Run this hourly via cron: 0 * * * * /home/realcodes/Chocochoco/health-check.sh

LOG="/var/log/pool-health.log"
DOMAIN="https://pool.viddhana.com"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

# Check for duplicate cloudflared processes
CLOUDFLARED_COUNT=$(pgrep -c cloudflared)
if [ "$CLOUDFLARED_COUNT" -gt 1 ]; then
    log "⚠️  WARNING: $CLOUDFLARED_COUNT cloudflared processes detected! Cleaning up..."
    sudo pkill -9 cloudflared
    sleep 2
    sudo systemctl start cloudflared
    log "✅ Cloudflared restarted - only 1 instance now"
fi

# Check if cloudflared service is running
if ! systemctl is-active --quiet cloudflared; then
    log "❌ Cloudflared service DOWN! Restarting..."
    sudo systemctl start cloudflared
    sleep 5
fi

# Check backend container
if ! docker ps --filter "name=chocochoco-backend-1" --filter "status=running" | grep -q backend; then
    log "❌ Backend container DOWN! Restarting..."
    docker restart chocochoco-backend-1
    sleep 10
fi

# Test HTTP endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$DOMAIN/health" 2>&1)
if [ "$HTTP_CODE" != "200" ]; then
    log "❌ HTTP check failed: $HTTP_CODE"
    
    # Try 2 more times
    sleep 2
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$DOMAIN/health" 2>&1)
    if [ "$HTTP_CODE" != "200" ]; then
        log "❌ Still failing, restarting services..."
        docker restart chocochoco-backend-1
        sleep 10
        sudo systemctl restart cloudflared
        sleep 5
    fi
fi

# Final check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$DOMAIN/health" 2>&1)
if [ "$HTTP_CODE" = "200" ]; then
    log "✅ Health check PASSED"
    exit 0
else
    log "❌ Health check FAILED after recovery attempts: $HTTP_CODE"
    # Send alert (add your notification here)
    exit 1
fi
