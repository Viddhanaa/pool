# Hướng dẫn Setup DNS cho viddhana.com

## Cách 1: Tự động với Script (Khuyến nghị)

### Bước 1: Lấy Cloudflare API Token

1. Truy cập: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Chọn template **"Edit zone DNS"**
4. Cấu hình:
   - **Permissions**: Zone → DNS → Edit
   - **Zone Resources**: Include → Specific zone → **viddhana.com**
5. Click **"Continue to summary"** → **"Create Token"**
6. **Copy token** (chỉ hiển thị 1 lần!)

### Bước 2: Lấy Zone ID

1. Truy cập: https://dash.cloudflare.com
2. Click vào domain **viddhana.com**
3. Scroll xuống phần **"API"** ở sidebar bên phải
4. Copy **"Zone ID"**

### Bước 3: Chạy Script

```bash
# Set credentials
export CF_API_TOKEN='your-cloudflare-api-token-here'
export CF_ZONE_ID='your-zone-id-here'

# Run script
./setup-viddhana-dns-auto.sh
```

Script sẽ tự động:
- ✅ Tạo CNAME record cho viddhana.com
- ✅ Tạo CNAME record cho www.viddhana.com
- ✅ Enable Cloudflare Proxy (orange cloud)
- ✅ Kiểm tra và cập nhật nếu record đã tồn tại

---

## Cách 2: Thủ công trên Cloudflare Dashboard

### Bước 1: Truy cập DNS Settings

1. Đăng nhập: https://dash.cloudflare.com
2. Chọn domain: **viddhana.com**
3. Vào **DNS** → **Records**

### Bước 2: Thêm Record 1 - Root Domain

Click **"Add record"** và điền:

```
Type: CNAME
Name: @
Target: 408b43bd-c962-4e4c-b986-49a4b642276c.cfargotunnel.com
Proxy status: ✅ Proxied (orange cloud icon)
TTL: Auto
```

Click **"Save"**

### Bước 3: Thêm Record 2 - WWW Subdomain

Click **"Add record"** và điền:

```
Type: CNAME
Name: www
Target: 408b43bd-c962-4e4c-b986-49a4b642276c.cfargotunnel.com
Proxy status: ✅ Proxied (orange cloud icon)
TTL: Auto
```

Click **"Save"**

---

## Kiểm tra sau khi Setup

### Đợi DNS Propagate (2-5 phút)

```bash
# Test HTTPS
curl -I https://viddhana.com
curl -I https://www.viddhana.com

# Test content
curl -s https://viddhana.com | head -20
```

### Kiểm tra DNS Records

```bash
# Check DNS
dig viddhana.com
dig www.viddhana.com

# Or
nslookup viddhana.com
nslookup www.viddhana.com
```

### Kiểm tra Tunnel hoạt động

```bash
# Check local landing page
curl http://localhost:3001/health

# Check tunnel logs
tail -f /tmp/cloudflared-tunnel.log

# Check container
docker ps --filter "name=landingpage"
```

---

## Troubleshooting

### DNS chưa resolve

```bash
# Clear DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Check Cloudflare DNS
dig @1.1.1.1 viddhana.com
```

### Tunnel không hoạt động

```bash
# Restart tunnel
pkill -f cloudflared
cloudflared tunnel --config ~/Chocochoco/cloudflare-tunnel.yml run

# Check config
cat ~/Chocochoco/cloudflare-tunnel.yml | grep -A 3 "viddhana.com"
```

### Landing page không load

```bash
# Check container
docker compose ps landingpage
docker compose logs landingpage

# Restart if needed
docker compose restart landingpage
```

---

## Thông tin hệ thống

- **Tunnel ID**: 408b43bd-c962-4e4c-b986-49a4b642276c
- **Local Service**: http://localhost:3001
- **Public URLs**: 
  - https://viddhana.com
  - https://www.viddhana.com
- **Health Check**: http://localhost:3001/health
- **Tunnel Config**: ~/Chocochoco/cloudflare-tunnel.yml
- **Tunnel Logs**: /tmp/cloudflared-tunnel.log

---

## Scripts có sẵn

```bash
# Hướng dẫn setup DNS (manual)
./setup-viddhana-domain.sh

# Auto setup DNS (cần CF credentials)
./setup-viddhana-dns-auto.sh

# View tunnel status
tail -f /tmp/cloudflared-tunnel.log
```
