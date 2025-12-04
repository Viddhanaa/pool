# VIDDHANA RPC API Documentation

Interactive documentation viewer for VIDDHANA Blockchain RPC APIs featuring an AI-powered code generator and assistant using Google Gemini.

## Features

- 🔍 **Complete API Reference**: Full documentation for all VIDDHANA RPC endpoints
- 🤖 **AI Assistant**: Get code examples and help using Google Gemini
- 💻 **Multi-Language Support**: JavaScript, Python, Go, and cURL examples
- 📚 **Custom APIs**: Documentation for KYC, Pool, Miner, Withdrawal, and more
- 🎨 **Modern UI**: Clean, responsive interface built with React and TypeScript

## API Categories

### KYC (Know Your Customer)
- `kyc.getStatus` - Get KYC verification status
- `kyc.setStatus` - Update KYC status

### Pool Management
- `pool.getInfo` - Get pool statistics and info
- `pool.getUserBalance` - Get user's pool balance
- `pool.deposit` - Deposit assets into pool
- `pool.withdraw` - Withdraw from pool
- `pool.getRewards` - Get reward history

### Miner Operations
- `miner.register` - Register new miner
- `miner.heartbeat` - Send miner heartbeat
- `miner.getTasks` - Get mining tasks
- `miner.submitTask` - Submit task results

### Withdrawals
- `withdraw.request` - Request withdrawal
- `withdraw.list` - List withdrawal history

### Network & Statistics
- `ping.submit` - Submit miner ping
- `hashrate.submit` - Submit hashrate data
- `stats.*` - Various statistics endpoints

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local):
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

You can deploy this application to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## API Base URL

VIDDHANA Blockchain API: `https://api.viddhana.network/api`

## Contributing

This documentation is part of the VIDDHANA Blockchain project. For questions or contributions, please contact the development team.
