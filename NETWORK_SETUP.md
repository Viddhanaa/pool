# 🌐 Network Setup Guide - VIDDHANA Miner

## 📍 Current Network Configuration

### Server Details
- **Private IP**: 10.0.2.2
- **Public IP**: 103.199.19.95
- **Network Type**: Private network (NAT/VPC)
- **Firewall**: Inactive (ufw disabled)

### Services Running
All services listening on `0.0.0.0` (all interfaces):
- ✅ Port 4173 - Web Dashboard
- ✅ Port 4174 - Admin Dashboard
- ✅ Port 4001 - BlockScout Frontend
- ✅ Port 4002 - BlockScout API
- ✅ Port 4000 - Backend API
- ✅ Port 8545 - Geth RPC
- ✅ Port 3000 - Grafana

---

## 🔧 Setup Options

### Option 1: VirtualBox/VMware Port Forwarding

#### VirtualBox Setup:
1. **Open VirtualBox** → Select VM → **Settings**
2. **Network** → Adapter 1 → **Advanced** → **Port Forwarding**
3. Add these rules:

| Name | Protocol | Host IP | Host Port | Guest IP | Guest Port |
|------|----------|---------|-----------|----------|------------|
| Web | TCP | 0.0.0.0 | 4173 | 10.0.2.2 | 4173 |
| Admin | TCP | 0.0.0.0 | 4174 | 10.0.2.2 | 4174 |
| BlockScout | TCP | 0.0.0.0 | 4001 | 10.0.2.2 | 4001 |
| BlockScout-API | TCP | 0.0.0.0 | 4002 | 10.0.2.2 | 4002 |
| Backend | TCP | 0.0.0.0 | 4000 | 10.0.2.2 | 4000 |
| Geth | TCP | 0.0.0.0 | 8545 | 10.0.2.2 | 8545 |
| Grafana | TCP | 0.0.0.0 | 3000 | 10.0.2.2 | 3000 |

4. **Save** and restart VM if needed

#### VMware Setup:
1. **Edit** → **Virtual Network Editor**
2. Select **NAT** network
3. **NAT Settings** → **Port Forwarding**
4. Add same ports as above

---

### Option 2: Cloud Provider Firewall Rules

#### AWS (Security Groups):
```bash
# Web Dashboard
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 4173 \
  --cidr 0.0.0.0/0

# Admin Dashboard
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 4174 \
  --cidr 0.0.0.0/0

# BlockScout
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 4001 \
  --cidr 0.0.0.0/0

# BlockScout API
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 4002 \
  --cidr 0.0.0.0/0

# Backend API
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 4000 \
  --cidr 0.0.0.0/0

# Geth RPC
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 8545 \
  --cidr 0.0.0.0/0

# Grafana
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0
```

#### GCP (Firewall Rules):
```bash
gcloud compute firewall-rules create allow-asd-miner \
  --allow tcp:3000,tcp:4000,tcp:4001,tcp:4002,tcp:4173,tcp:4174,tcp:8545 \
  --source-ranges 0.0.0.0/0 \
  --target-tags asd-miner
```

#### Azure (Network Security Group):
```bash
# Web Dashboard
az network nsg rule create \
  --resource-group myResourceGroup \
  --nsg-name myNSG \
  --name allow-web \
  --protocol tcp \
  --priority 1001 \
  --destination-port-range 4173 \
  --access allow

# Repeat for other ports: 4174, 4001, 4002, 4000, 8545, 3000
```

---

### Option 3: SSH Tunnel (Temporary Access)

From your local machine:
```bash
# Web Dashboard
ssh -L 4173:localhost:4173 realcodes@103.199.19.95

# Admin Dashboard
ssh -L 4174:localhost:4174 realcodes@103.199.19.95

# BlockScout
ssh -L 4001:localhost:4001 realcodes@103.199.19.95

# Backend API
ssh -L 4000:localhost:4000 realcodes@103.199.19.95

# Geth RPC
ssh -L 8545:localhost:8545 realcodes@103.199.19.95

# Or tunnel all at once:
ssh -L 4173:localhost:4173 \
    -L 4174:localhost:4174 \
    -L 4001:localhost:4001 \
    -L 4002:localhost:4002 \
    -L 4000:localhost:4000 \
    -L 8545:localhost:8545 \
    -L 3000:localhost:3000 \
    realcodes@103.199.19.95
```

Then access via:
- http://localhost:4173 (Web)
- http://localhost:4174 (Admin)
- http://localhost:4001 (BlockScout)
- http://localhost:3000 (Grafana)

---

### Option 4: Nginx Reverse Proxy with Domain

If you have a domain name:

```nginx
server {
    listen 80;
    server_name asd-miner.yourdomain.com;

    # Web Dashboard
    location / {
        proxy_pass http://localhost:4173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Admin
    location /admin/ {
        proxy_pass http://localhost:4174/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # BlockScout
    location /explorer/ {
        proxy_pass http://localhost:4001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Grafana
    location /grafana/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔐 Security Recommendations

### 1. Enable UFW Firewall (Optional)
```bash
# Enable firewall
sudo ufw enable

# Allow SSH first (important!)
sudo ufw allow 22/tcp

# Allow application ports
sudo ufw allow 4173/tcp comment "VIDDHANA Web Dashboard"
sudo ufw allow 4174/tcp comment "VIDDHANA Admin"
sudo ufw allow 4001/tcp comment "BlockScout"
sudo ufw allow 4002/tcp comment "BlockScout API"
sudo ufw allow 4000/tcp comment "Backend API"
sudo ufw allow 8545/tcp comment "Geth RPC"
sudo ufw allow 3000/tcp comment "Grafana"

# Check status
sudo ufw status numbered
```

### 2. Restrict Access by IP (Recommended)
```bash
# Allow specific IPs only
sudo ufw allow from YOUR_IP_ADDRESS to any port 4173
sudo ufw allow from YOUR_IP_ADDRESS to any port 4174
sudo ufw allow from YOUR_IP_ADDRESS to any port 3000

# Or IP range
sudo ufw allow from 192.168.1.0/24 to any port 4173
```

### 3. Use Cloudflare Tunnel (Free & Secure)
```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create asd-miner

# Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: asd-miner
credentials-file: /home/realcodes/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: asd-miner.yourdomain.com
    service: http://localhost:4173
  - hostname: admin.yourdomain.com
    service: http://localhost:4174
  - hostname: explorer.yourdomain.com
    service: http://localhost:4001
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run asd-miner
```

---

## ✅ Verification Steps

After setup, test access:

### From External Network:
```bash
# Web Dashboard
curl http://103.199.19.95:4173

# Backend API
curl http://103.199.19.95:4000/health

# BlockScout
curl http://103.199.19.95:4001
```

### From Browser:
- http://103.199.19.95:4173 (Web Dashboard)
- http://103.199.19.95:4174 (Admin)
- http://103.199.19.95:4001 (BlockScout)
- http://103.199.19.95:3000 (Grafana)

---

## 🐛 Troubleshooting

### Test if ports are reachable:
```bash
# From external machine
telnet 103.199.19.95 4173
nc -zv 103.199.19.95 4173
```

### Check Docker port bindings:
```bash
docker compose ps
docker port chocochoco-web-1
```

### Check iptables rules:
```bash
sudo iptables -L -n -v
```

### Monitor connections:
```bash
sudo tcpdump -i any port 4173
```

---

## 📞 Quick Solutions Summary

**Quickest Option (Immediate Access):**
→ **SSH Tunnel** (Option 3)

**Best for Development:**
→ **VirtualBox Port Forwarding** (Option 1)

**Best for Production:**
→ **Cloud Firewall + Domain** (Option 2 + 4)

**Most Secure:**
→ **Cloudflare Tunnel** (Option 3 Security section)

---

**Current Status**: ❌ Public access blocked (NAT/VPC)  
**Recommended**: Setup VirtualBox Port Forwarding or SSH Tunnel
