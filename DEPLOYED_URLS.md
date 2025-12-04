# 🚀 VIDDHANA Miner - Deployed URLs

## 📅 Deployment Date
**November 29, 2025**

---

## 🌐 Web Applications

### 1. **VIDDHANA Landing Page** 🆕
- **Local URL**: http://localhost:3001
- **Public URL**: https://viddhana.com | https://www.viddhana.com
- **Description**: Official landing page với 3D graphics & animations
- **Features**:
  - 🎨 React 19 + Three.js 3D scene
  - ✨ Framer Motion animations
  - 📱 Responsive design
  - ⚡ Vite production build
  - 🔒 Security headers & gzip compression
- **Health Check**: http://localhost:3001/health

### 2. **Miner Dashboard** (Main App)
- **URL**: http://localhost:4173
- **Public URL**: http://10.0.2.2:4173
- **Description**: Dashboard chính cho miners - Auto mining, stats, withdrawal
- **Features**:
  - ⛏️ Auto Mining (ping every 5s)
  - 📊 Real-time statistics
  - 💰 Pending Balance & Total Earned
  - 📈 Charts (Earnings, Hashrate, Active Time)
  - 💳 Withdrawal management
  - 🔐 MetaMask integration

### 3. **Admin Dashboard**
- **URL**: http://localhost:4174
- **Public URL**: http://10.0.2.2:4174
- **Description**: Admin panel để quản lý hệ thống
- **Features**:
  - 👥 Quản lý miners
  - ⚙️ System configuration
  - 📊 Overview statistics

### 3. **BlockScout Explorer** (Frontend)
- **URL**: http://localhost:4001
- **Public URL**: http://10.0.2.2:4001
- **Description**: Blockchain explorer cho VIDDHANA Private Network
- **Network Info**:
  - Chain ID: 202401
  - Network Name: VIDDHANA Private Network
  - Total Blocks: 16,499+
  - Total Addresses: 24+
- **Features**:
  - 🔍 Search transactions, blocks, addresses
  - 📊 Network statistics
  - 📈 Charts & analytics

---

## 🔧 API Endpoints

### Backend API
- **Base URL**: http://localhost:4000/api
- **Public URL**: http://10.0.2.2:4000/api
- **Health Check**: http://localhost:4000/health
- **Endpoints**:
  - `GET /miner/stats?minerId=X` - Miner statistics
  - `POST /ping` - Submit ping (mining)
  - `POST /withdraw` - Request withdrawal
  - `POST /auth/challenge` - Get auth challenge
  - `POST /auth/login` - Login with signature
  - `GET /admin/*` - Admin endpoints

### BlockScout API
- **Base URL**: http://localhost:4002/api/v2
- **Public URL**: http://10.0.2.2:4002/api/v2
- **Endpoints**:
  - `GET /stats` - Blockchain statistics
  - `GET /blocks` - List blocks
  - `GET /transactions` - List transactions
  - `GET /addresses/{address}` - Address details

---

## ⛓️ Blockchain Nodes

### Geth Node 1 (Primary)
- **RPC**: http://localhost:8545
- **Public RPC**: http://10.0.2.2:8545
- **WebSocket**: ws://localhost:8546
- **Metrics**: http://localhost:6060
- **P2P Port**: 30303

### Geth Node 2 (Secondary)
- **RPC**: http://localhost:9545
- **Public RPC**: http://10.0.2.2:9545
- **WebSocket**: ws://localhost:9546
- **Metrics**: http://localhost:7060
- **P2P Port**: 30304

---

## 📊 Monitoring & Observability

### Grafana
- **URL**: http://localhost:3000
- **Public URL**: http://10.0.2.2:3000
- **Username**: admin
- **Password**: admin
- **Dashboards**:
  - System Overview
  - PostgreSQL Metrics
  - Redis Metrics
  - Application Metrics

### Prometheus
- **URL**: http://localhost:9090
- **Public URL**: http://10.0.2.2:9090
- **Description**: Metrics collection & querying

### Loki
- **URL**: http://localhost:3100
- **Public URL**: http://10.0.2.2:3100
- **Description**: Log aggregation

### Exporters
- **Node Exporter**: http://localhost:9100/metrics
- **PostgreSQL Exporter**: http://localhost:9187/metrics
- **Redis Exporter**: http://localhost:9121/metrics

---

## 💾 Databases

### PostgreSQL
- **Host**: localhost:5432
- **Database**: asdminer
- **Username**: postgres
- **Password**: postgres
- **Connection String**: 
  ```
  postgresql://postgres:postgres@localhost:5432/asdminer
  ```

### Redis
- **Host**: localhost:6379
- **URL**: redis://localhost:6379
- **Description**: Caching & session storage

---

## 🔑 MetaMask Network Configuration

### Add to MetaMask:
```javascript
Network Name: VIDDHANA Private Network
RPC URL: http://localhost:8545
Chain ID: 202401
Currency Symbol: VIDDHANA
Block Explorer: http://localhost:4001
```

### Or use Web3 API:
```javascript
await ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x31629', // 202401 in hex
    chainName: 'VIDDHANA Private Network',
    nativeCurrency: { name: 'VIDDHANA', symbol: 'VIDDHANA', decimals: 18 },
    rpcUrls: ['http://localhost:8545'],
    blockExplorerUrls: ['http://localhost:4001'],
  }],
});
```

---

## 📝 Test Credentials

### Miner Account (Test)
- **Miner ID**: 112
- **Wallet**: 0xTEST123456789ABCDEF
- **JWT Token**: 
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtaW5lcklkIjoxMTIsImlhdCI6MTc2NDQyODE5MCwiZXhwIjoxNzY3MDIwMTkwfQ.vAZ8AJRyJ_yrigkn2iRy2DUXWKEgKLpu_A7G2HtB-Ks
  ```
- **Hashrate**: 1,000 H/s
- **Status**: Active

### Test API Call:
```bash
# Get miner stats
curl "http://localhost:4000/api/miner/stats?minerId=112" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Submit ping (mining)
curl -X POST "http://localhost:4000/api/ping" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"miner_id": 112, "hashrate": 1000, "device_type": "web"}'
```

---

## 🚀 Quick Start Guide

### 1. Access Miner Dashboard
```
http://localhost:4173
```

### 2. Connect MetaMask
- Click "Sign in with wallet"
- Approve network addition
- Sign authentication message

### 3. Start Mining
- Click "Start Mining" button
- Watch successful pings increase
- Earn VIDDHANA rewards every 5 seconds

### 4. Check Balance
- View "Pending Balance" card
- Monitor "Total Earned"
- Track mining statistics

### 5. Withdraw (when balance ≥ 100 VIDDHANA)
- Enter amount (default: 100 VIDDHANA)
- Click "Withdraw" button
- Check transaction on BlockScout

---

## 📚 Documentation Files

- **Main README**: `/home/realcodes/Chocochoco/README.md`
- **Technical Spec**: `/home/realcodes/Chocochoco/docs/TECH_SPEC.md`
- **Mining Guide (Vietnamese)**: `/home/realcodes/Chocochoco/CACH_DAO.md`
- **Mining Guide (HTML)**: `/home/realcodes/Chocochoco/MINING_GUIDE.html`
- **Credentials**: `/home/realcodes/Chocochoco/CREDENTIALS.txt`
- **This File**: `/home/realcodes/Chocochoco/DEPLOYED_URLS.md`

---

## 🐛 Troubleshooting

### Port Conflicts
If ports are busy, stop services:
```bash
docker compose down
docker compose up -d
```

### Clear Browser Cache
Hard refresh: `Ctrl + Shift + R`

### Check Service Health
```bash
docker compose ps
docker compose logs backend --tail=50
```

### Reset Database
```bash
docker compose exec postgres psql -U postgres -d asdminer -f /docker-entrypoint-initdb.d/schema.sql
```

---

## 📞 Support

For issues or questions:
1. Check logs: `docker compose logs [service_name]`
2. Review documentation files
3. Inspect network tab in browser DevTools

---

**Last Updated**: November 29, 2025
**System Status**: ✅ All services running
**Total Services**: 18 containers
