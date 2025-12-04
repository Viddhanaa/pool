# VIDDHANA Miner

Pseudo-mining pool for VIDDHANA private chain. This repo ships a minimal but end-to-end scaffold: blockchain config, backend services, and web/admin shells.

## Stack
- Geth private chain (5s blocks, 2 VIDDHANA reward)
- PostgreSQL + Redis
- Node.js/TypeScript backend (Express)
- Vite + React for miner web, Vite + React for admin shell
- Docker Compose for local dev deps

## Quick start (local)
1. Install Node 18+ and Docker (Compose v2).
2. Start infra (PostgreSQL, Redis) with healthchecks. `docker compose ps` will show `healthy` when ready:
   ```bash
   docker compose --profile app up -d postgres redis
   docker compose ps
   ```
3. Run database migrations (required on first setup or after schema changes). From host:
   ```bash
   cd backend
   npm install
   # uses localhost:5432 (published by the postgres container)
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/asdminer node scripts/migrate.js
   ```
4. Prepare backend env (copy template and set secrets):
   ```bash
   cd backend
   cp .env.example .env
   # edit backend/.env for ADMIN_PRIVATE_KEY, ADMIN_WALLET_ADDRESS, JWT_SECRET, ADMIN_PASSWORD, RPC_URLS
   ```
5. Backend API (profile `app`) waits for healthy Postgres/Redis and exposes `/health`:
   ```bash
   docker compose --profile app up -d backend
   curl http://localhost:4000/health  # { ok: true, ... }
   # or run locally:
   cd backend && npm run dev
   ```
6. Dev chain (profile `chain`) with 2-node Clique PoA network (geth1 + geth2):
   ```bash
   docker compose --profile chain up -d geth1 geth2
   # JSON-RPC checks
   curl -s http://localhost:8545 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'
   curl -s http://localhost:9545 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'
   # Peer count
   curl -s http://localhost:8545 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
   ```
7. Blockscout explorer (optional, profile `explorer`, served on 4001):
   ```bash
   docker compose --profile chain --profile explorer up -d blockscout-db blockscout
   ```
8. Web miner:
   ```bash
   cd web
   npm install
   npm run dev
   ```
9. Admin shell (optional):
   ```bash
   cd admin
   npm install
   npm run dev
   ```
   - Admin endpoints require a password login (`POST /api/admin/login`). Set `ADMIN_PASSWORD` (default `changeme`) and optionally `ADMIN_JWT_SECRET` on the backend to issue/administer tokens.

## Linting, formatting, and types
- Run all lint checks: `npm run lint`
- Run type checks: `npm run typecheck`
- Format check: `npm run format`
- CI runs lint + typecheck + tests/builds for backend/web/admin via `.github/workflows/ci.yml`.

## Docker builds
- Backend image: `docker build -t asd-miner-backend ./backend`
- Web dashboard: `docker build -t asd-miner-web ./web` (build arg `VITE_API_BASE`)
- Admin console: `docker build -t asd-miner-admin ./admin` (build arg `VITE_API_BASE`)
- One command to bring up API + UIs: `docker compose --profile app up -d backend web admin`
  - Set `VITE_API_BASE=http://backend:4000/api` via compose build args (already wired)
  - Ensure `backend/.env` is filled first; `.gitignore` keeps it private.
- Full stack (chain + app + explorer): `docker compose --profile chain --profile app --profile explorer up -d`

## Database migrations & partitions
- Schema is managed via `node-pg-migrate` under `infra/sql/migrations`.
- Run the migration command shown above on new environments.
- `mining_sessions` is a partitioned table (monthly).
- Partition automation: `ensureMiningPartitions` is called at backend startup and daily via the scheduler to create current and next month partitions.
- Geth: multi-node Clique PoA (geth1/geth2) with metrics exposed on 6060/7060, RPC on 8545/9545; Blockscout optional on 4001.

## Auth & miner registration
- Register: `POST /api/auth/register` with `wallet`, `signature` (signing `VIDDHANA Miner Register:<wallet>`), `hashrate`, `deviceType` → returns JWT + miner_id.
- Protected endpoints: `/api/ping`, `/api/withdraw`, `/api/withdrawals`, `/api/hashrate` require `Authorization: Bearer <token>`.
- Dynamic config: values in `system_config` (set via admin panel or SQL) are cached 30s; keys include `min_withdrawal_threshold`, `reward_update_interval_minutes`, `data_retention_days`, `ping_timeout_seconds`, `daily_withdrawal_limit`.
 - Web dashboard: paste JWT token in the header field to call protected endpoints; minerId/token are persisted locally.

## Observability
- Basic request logging is enabled server-side; container logs are the primary signal in Docker.
- Metrics placeholder: `GET /api/metrics` (Prometheus-style text format scaffold).
- For container-level metrics, run Docker/Compose with cAdvisor/Prometheus (not included) and scrape the backend port.

## Folder layout
- `backend/` – API, ping tracking, reward engine, withdrawal service
- `web/` – miner-facing UI shell
- `admin/` – admin panel shell
- `infra/` – docker-compose, Geth genesis, SQL schema
- `docs/` – technical spec

## Key flows
- Ping every 5s -> Redis minute markers -> minute sessions table
- Reward engine cron (1–5m) -> distributes pending balance -> miners withdraw at threshold
- Withdrawals move balance to admin wallet transfer queue

## Next steps
- Wire actual blockchain transfer client
- Add auth (JWT) and wallet signature verification
- Harden rate limits and monitoring
