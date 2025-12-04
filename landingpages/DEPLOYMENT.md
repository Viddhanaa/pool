# Landing Page Deployment Guide

## Deployment Successful ✅

Landing page đã được deploy thành công tại: **http://localhost:3001**

## Architecture

- **Framework**: React 19 + Vite
- **3D Graphics**: Three.js + React Three Fiber
- **Animations**: Framer Motion
- **Container**: Docker multi-stage build
- **Web Server**: Nginx
- **Port**: 3001

## Services

### Development
```bash
cd landingpages
npm install
npm run dev     # Runs on http://localhost:3000
```

### Production Build
```bash
cd landingpages
npm run build   # Creates optimized dist/ folder
npm run preview # Preview production build
```

### Docker Deployment
```bash
# Build image
docker compose build landingpage

# Start service
docker compose --profile app up -d landingpage

# Stop service
docker compose --profile app stop landingpage

# View logs
docker compose logs -f landingpage

# Restart service
docker compose restart landingpage
```

## Health Check

```bash
curl http://localhost:3001/health
# Response: healthy
```

## Files Created

1. **Dockerfile** - Multi-stage build với Node 20 và Nginx
2. **nginx.conf** - Nginx config với gzip, caching, và SPA routing
3. **.dockerignore** - Optimize Docker build context

## Features

- ✅ Production-optimized build
- ✅ Gzip compression
- ✅ Static asset caching (1 year)
- ✅ SPA routing support
- ✅ Security headers
- ✅ Health check endpoint
- ✅ Auto-restart on failure

## Integration with docker-compose.yml

Service được thêm vào `docker-compose.yml` với profile `app`:
- Port: 3001:80
- Auto-restart: unless-stopped
- Health checks: enabled

## Access

- Local: http://localhost:3001
- Health: http://localhost:3001/health

## Troubleshooting

```bash
# Check container status
docker ps --filter "name=landingpage"

# View logs
docker compose logs landingpage

# Restart if needed
docker compose restart landingpage

# Rebuild after code changes
docker compose build landingpage && docker compose restart landingpage
```

## Environment Variables

API key đã được cấu hình trong `.env.local`:
- `GEMINI_API_KEY` - Được inject vào build time qua Vite config

## Next Steps

Để expose landing page ra public:
1. Setup Cloudflare Tunnel (tương tự các service khác)
2. Hoặc setup reverse proxy với domain
3. Update CORS nếu cần integrate với backend API
