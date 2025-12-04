# VIDDHANA RPC API Documentation - Status

## ✅ Deployment Complete

### URLs
- **Production**: https://docs.viddhana.com
- **Test Page**: https://docs.viddhana.com/test-port.html
- **Local**: http://localhost:3003

### Service Status
```bash
sudo systemctl status rpc-api-docs
```

### Restart Service
```bash
sudo systemctl restart rpc-api-docs
sudo systemctl restart cloudflared
```

### View Logs
```bash
# App logs
sudo journalctl -u rpc-api-docs -f

# Tunnel logs
sudo journalctl -u cloudflared -f
```

### Files Location
- **App**: /home/realcodes/Chocochoco/rpc-api-docs-&-assistant/dist/
- **Service**: /etc/systemd/system/rpc-api-docs.service
- **Tunnel Config**: /etc/cloudflared/config.yml

### Port Configuration
- Port: 3003
- Bind: 0.0.0.0
- Protocol: HTTP
- Server: Python http.server

### Cache Issues
If you see old content, force refresh:
- **Chrome/Edge**: Ctrl + Shift + R
- **Firefox**: Ctrl + F5
- **Safari**: Cmd + Shift + R

Or add query param: https://docs.viddhana.com?v=2
