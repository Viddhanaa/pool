# VIDDHANA RPC API Documentation - Deployment Guide

## Build Completed ✅

The application has been successfully built in the `dist/` directory.

## Deployment Options

### 1. Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd /home/realcodes/Chocochoco/rpc-api-docs-&-assistant
vercel --prod
```

### 2. Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd /home/realcodes/Chocochoco/rpc-api-docs-&-assistant
netlify deploy --prod --dir=dist
```

### 3. GitHub Pages
```bash
# Push dist folder to gh-pages branch
cd /home/realcodes/Chocochoco/rpc-api-docs-&-assistant
git subtree push --prefix dist origin gh-pages
```

### 4. Using Nginx (Local Server)
```bash
# Copy dist to web server
sudo cp -r /home/realcodes/Chocochoco/rpc-api-docs-&-assistant/dist /var/www/viddhana-rpc-docs

# Nginx config
sudo nano /etc/nginx/sites-available/viddhana-rpc-docs
```

Example Nginx config:
```nginx
server {
    listen 80;
    server_name api-docs.viddhana.network;

    root /var/www/viddhana-rpc-docs;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. Docker Deployment
```bash
# Create Dockerfile
cd /home/realcodes/Chocochoco/rpc-api-docs-&-assistant

# Run
docker build -t viddhana-rpc-docs .
docker run -d -p 8080:80 viddhana-rpc-docs
```

## Environment Variables

Before deployment, update `.env.local` with a valid Gemini API key:
```
GEMINI_API_KEY=your_actual_api_key_here
```

## Test Locally

```bash
cd /home/realcodes/Chocochoco/rpc-api-docs-&-assistant
npm run preview
```

Then open: http://localhost:4173

## Access URLs

After deployment, the app will be accessible at:
- Local dev: http://localhost:5173
- Local preview: http://localhost:4173
- Production: https://your-domain.com

## Features Deployed

✅ Complete VIDDHANA RPC API documentation
✅ AI-powered code generator (Gemini)
✅ Multi-language support (JS, Python, Go, cURL)
✅ Custom APIs documented:
   - KYC (2 endpoints)
   - Pool (5 endpoints)
   - Miner (4 endpoints)
   - Withdrawal (2 endpoints)
   - Network & Stats (6 endpoints)

## Notes

- The app is a static SPA (Single Page Application)
- No server-side rendering required
- AI features require valid Gemini API key
- All API documentation is embedded in the app
