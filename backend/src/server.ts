import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';
import healthRouter from './routes/health';
import hashrateRouter from './routes/hashrate';
import metricsRouter from './routes/metrics';
import pingRouter from './routes/ping';
import statsRouter from './routes/stats';
import withdrawRouter from './routes/withdraw';
import kycRouter from './routes/kyc';
import minerRouter from './routes/miner';
import poolRouter from './routes/pool';
import poolAdminRouter from './routes/poolAdmin';
import { logRequests } from './middleware/logRequests';
import { errorHandler } from './middleware/errorHandler';
import { prometheusMiddleware } from './services/prometheusMetrics';
import { config } from './config/env';

export function createApp() {
  const app = express();
  // Enable CORS for all origins
  app.use(cors());
  // Parse JSON FIRST (before any routes)
  app.use(express.json());
  
  // Now mount all other middleware and routers
  app.use(prometheusMiddleware); // Track all HTTP requests
  app.use(logRequests);
  
  app.use(healthRouter);
  app.use('/api', authRouter);
  // Public endpoints should be mounted early to avoid being intercepted by auth requirements in other routers
  app.use('/api', metricsRouter);
  app.use('/api', pingRouter);
  app.use('/api', withdrawRouter);
  app.use('/api', hashrateRouter);
  app.use('/api', statsRouter);
  app.use('/api', kycRouter);
  app.use('/api', minerRouter);
  app.use('/api/pool', poolRouter);
  // Mount secured admin routes
  app.use('/api/admin', adminRouter);
  app.use('/api/pool/admin', poolAdminRouter);
  // Serve pool frontend HTML inline at root
  app.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VIDDHANA Pool - BTCD Staking</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            padding: 40px 20px;
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); }
        .card h2 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .stat:last-child { border-bottom: none; }
        .stat-label { color: #666; font-weight: 500; }
        .stat-value { color: #333; font-weight: bold; }
        .status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }
        .status.active { background: #d4edda; color: #155724; }
        .status.inactive { background: #f8d7da; color: #721c24; }
        .loading {
            text-align: center;
            color: white;
            font-size: 1.2em;
            padding: 40px;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px solid #f5c6cb;
        }
        .actions {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .actions h2 { color: #667eea; margin-bottom: 20px; }
        .api-list { list-style: none; }
        .api-list li {
            padding: 12px;
            margin: 10px 0;
            background: #f8f9fa;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .api-list a { color: #667eea; text-decoration: none; }
        .api-list a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 VIDDHANA Pool</h1>
            <p>BTCD Staking & Rewards Platform</p>
        </div>
        <div id="loading" class="loading">Loading pool data...</div>
        <div id="error" class="error" style="display: none;"></div>
        <div id="content" style="display: none;">
            <div class="cards">
                <div class="card">
                    <h2>📊 Pool Information</h2>
                    <div class="stat"><span class="stat-label">Pool ID</span><span class="stat-value" id="pool-id">-</span></div>
                    <div class="stat"><span class="stat-label">Name</span><span class="stat-value" id="pool-name">-</span></div>
                    <div class="stat"><span class="stat-label">Status</span><span class="stat-value"><span id="pool-status" class="status">-</span></span></div>
                    <div class="stat"><span class="stat-label">Deposit Asset</span><span class="stat-value" id="deposit-asset">-</span></div>
                    <div class="stat"><span class="stat-label">Reward Asset</span><span class="stat-value" id="reward-asset">-</span></div>
                </div>
                <div class="card">
                    <h2>💰 Financial Metrics</h2>
                    <div class="stat"><span class="stat-label">Total Value Locked</span><span class="stat-value" id="tvl">0 BTCD</span></div>
                    <div class="stat"><span class="stat-label">APR</span><span class="stat-value" id="apr">0%</span></div>
                    <div class="stat"><span class="stat-label">APY</span><span class="stat-value" id="apy">0%</span></div>
                    <div class="stat"><span class="stat-label">Min Withdraw</span><span class="stat-value" id="min-withdraw">0 BTCD</span></div>
                </div>
            </div>
            <div class="actions">
                <h2>🔗 API Endpoints</h2>
                <ul class="api-list">
                    <li><strong>Health Check:</strong> <a href="/health" target="_blank">/health</a></li>
                    <li><strong>Pool Info:</strong> <a href="/api/pool/btcd/info" target="_blank">/api/pool/btcd/info</a></li>
                    <li><strong>Pool Stats:</strong> <a href="/api/pool/btcd/stats" target="_blank">/api/pool/btcd/stats</a></li>
                    <li><strong>Depositors:</strong> <a href="/api/pool/btcd/depositors" target="_blank">/api/pool/btcd/depositors</a></li>
                </ul>
            </div>
        </div>
    </div>
    <script>
        async function loadPoolData() {
            try {
                const response = await fetch('/api/pool/btcd/info');
                if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
                const data = await response.json();
                document.getElementById('pool-id').textContent = data.pool_id || '-';
                document.getElementById('pool-name').textContent = data.name || '-';
                const statusEl = document.getElementById('pool-status');
                statusEl.textContent = data.status || 'unknown';
                statusEl.className = 'status ' + (data.status === 'active' ? 'active' : 'inactive');
                document.getElementById('deposit-asset').textContent = data.deposit_asset || '-';
                document.getElementById('reward-asset').textContent = data.reward_asset || '-';
                document.getElementById('tvl').textContent = parseFloat(data.tvl || 0).toFixed(2) + ' BTCD';
                document.getElementById('apr').textContent = (parseFloat(data.apr || 0) * 100).toFixed(2) + '%';
                document.getElementById('apy').textContent = (parseFloat(data.apy || 0) * 100).toFixed(2) + '%';
                document.getElementById('min-withdraw').textContent = parseFloat(data.min_withdraw_threshold || 0).toFixed(2) + ' BTCD';
                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';
            } catch (error) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').textContent = '⚠️ Error: ' + error.message;
                document.getElementById('error').style.display = 'block';
                document.getElementById('content').style.display = 'block';
            }
        }
        loadPoolData();
        setInterval(loadPoolData, 30000);
    </script>
</body>
</html>`);
  });
  // 404 handler for anything else
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
