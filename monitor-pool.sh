#!/bin/bash
# Pool Monitoring Script - Continuous Health Check
# Usage: ./monitor-pool.sh [interval_seconds]

INTERVAL=${1:-10}  # Default 10 seconds
DOMAIN="https://pool.viddhana.com"
LOG_FILE="/var/log/pool-monitor.log"
MAX_FAILURES=3
FAILURE_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_service() {
    local service=$1
    if systemctl is-active --quiet "$service"; then
        return 0
    else
        return 1
    fi
}

check_container() {
    local container=$1
    if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
        return 0
    else
        return 1
    fi
}

check_http() {
    local url=$1
    local timeout=${2:-5}
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m "$timeout" "$url" 2>&1)
    if [ "$HTTP_CODE" = "200" ]; then
        return 0
    else
        return 1
    fi
}

restart_service() {
    local service=$1
    log "⚠️  Restarting $service..."
    sudo systemctl restart "$service"
    sleep 5
}

restart_container() {
    local container=$1
    log "⚠️  Restarting container $container..."
    docker restart "$container"
    sleep 10
}

send_alert() {
    local message=$1
    log "🚨 ALERT: $message"
    # Add webhook or notification here if needed
    # curl -X POST https://hooks.slack.com/... -d "{\"text\":\"$message\"}"
}

echo "════════════════════════════════════════════════════════════"
echo "🔍 VIDDHANA Pool Monitoring - Starting"
echo "Domain: $DOMAIN"
echo "Check Interval: ${INTERVAL}s"
echo "════════════════════════════════════════════════════════════"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    ISSUES=0
    
    # Check Cloudflared
    if ! check_service "cloudflared"; then
        echo -e "${RED}❌ [$TIMESTAMP] Cloudflared service DOWN${NC}"
        restart_service "cloudflared"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check Backend Container
    if ! check_container "chocochoco-backend-1"; then
        echo -e "${RED}❌ [$TIMESTAMP] Backend container DOWN${NC}"
        restart_container "chocochoco-backend-1"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check Postgres Container
    if ! check_container "chocochoco-postgres-1"; then
        echo -e "${RED}❌ [$TIMESTAMP] Postgres container DOWN${NC}"
        restart_container "chocochoco-postgres-1"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check Redis Container
    if ! check_container "chocochoco-redis-1"; then
        echo -e "${RED}❌ [$TIMESTAMP] Redis container DOWN${NC}"
        restart_container "chocochoco-redis-1"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check HTTP Health
    if ! check_http "$DOMAIN/health" 10; then
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        echo -e "${YELLOW}⚠️  [$TIMESTAMP] HTTP check failed ($FAILURE_COUNT/$MAX_FAILURES): $HTTP_CODE${NC}"
        
        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            echo -e "${RED}❌ [$TIMESTAMP] HTTP failing repeatedly - Restarting services${NC}"
            restart_container "chocochoco-backend-1"
            restart_service "cloudflared"
            FAILURE_COUNT=0
            send_alert "Pool domain $DOMAIN is DOWN - Services restarted"
            ISSUES=$((ISSUES + 1))
        fi
    else
        if [ $FAILURE_COUNT -gt 0 ]; then
            echo -e "${GREEN}✅ [$TIMESTAMP] HTTP recovered after $FAILURE_COUNT failures${NC}"
        fi
        FAILURE_COUNT=0
    fi
    
    # Print status if all OK
    if [ $ISSUES -eq 0 ] && [ $FAILURE_COUNT -eq 0 ]; then
        echo -e "${GREEN}✅ [$TIMESTAMP] All services healthy${NC}"
    fi
    
    sleep "$INTERVAL"
done
