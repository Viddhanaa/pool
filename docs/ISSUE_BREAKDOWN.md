# VIDDHANA Miner — Issue Breakdown by Folder

This backlog maps the Technical Spec to concrete, actionable issues, grouped by folder/component. Each issue has a title, scope, acceptance criteria, and suggested labels. Use these to open GitHub issues and plan sprints via Phase milestones.

Labels suggested: [area/backend], [area/web], [area/admin], [area/infra], [area/devx], [type/feature], [type/bug], [type/chore], [type/docs], [priority/P0|P1|P2], [good-first-issue].

Milestones suggested:
- Phase 1: Core (chain + ping + rewards)
- Phase 2: Withdrawal (service + tx)
- Phase 3: Clients (web/admin polish)
- Phase 4: Polish (analytics + cleanup + ops)

---

## infra/

1) Docker Compose profiles and healthchecks
- Description: Add healthchecks for postgres, redis, backend, geth. Ensure profiles `app`, `chain` are documented and consistent.
- Acceptance: `docker compose ps` shows healthy; backend waits for deps; README updated.
- Labels: [area/infra] [type/chore] [priority/P1]
- Files: docker-compose.yml, README.md

2) Geth genesis accounts & admin wallet funding
- Description: Configure a prefunded admin account in genesis for VIDDHANA transfers. Store admin address/key via env/keystore volume.
- Acceptance: `geth` node exposes JSON-RPC; admin wallet has balance; txs can be sent on chain.
- Labels: [area/infra] [type/feature] [priority/P0]
- Files: infra/geth/genesis.json, docker-compose.yml

3) Database migration tooling
- Description: Introduce migrations (e.g., node-pg-migrate or knex). Move schema.sql into migration files.
- Acceptance: `npm run migrate` creates schema on empty DB; CI uses migrations.
- Labels: [area/infra] [type/devx] [priority/P1]
- Files: infra/sql, backend/package.json

4) Partition mining_sessions by month
- Description: Implement monthly partitions for `mining_sessions` for scalability.
- Acceptance: New partitions created; inserts routed; queries remain correct.
- Labels: [area/infra] [type/feature] [priority/P2]
- Files: infra/sql, docs

5) Observability baseline
- Description: Add basic logs, container-level metrics hints/prometheus exemplar (optional).
- Acceptance: Logging guidance in README; placeholders for metrics endpoints.
- Labels: [area/infra] [type/docs] [priority/P2]

6) Multi-node Geth private network setup
- Description: Replace single Geth dev mode with a 2-node private network using Clique PoA. Configure bootnode discovery, static-nodes.json, and peer connectivity. Each node runs as a separate service in docker-compose with persistent volumes.
- Acceptance: Both nodes synchronize blocks; miners rotate seal duty via Clique; backend can connect to either node; logs show peer discovery and block production.
- Labels: [area/infra] [type/feature] [priority/P1] [blockchain]
- Files: docker-compose.yml, infra/geth/genesis.json, infra/geth/static-nodes.json, README.md

7) Blockscout block explorer integration
- Description: Deploy Blockscout stack (db, api, frontend) via docker-compose. Configure to index the private Geth chain (chainId 202401). Expose Blockscout UI on host port for browsing blocks, transactions, and addresses.
- Acceptance: Blockscout UI loads at http://localhost:4000 (or custom port); displays chain blocks and transactions; can search by tx hash or address; sync keeps up with new blocks.
- Labels: [area/infra] [type/feature] [priority/P1] [blockchain] [explorer]
- Files: docker-compose.yml, infra/blockscout/, README.md

8) Geth node load balancing and RPC failover
- Description: Configure backend to support multiple Geth RPC endpoints with automatic failover. Use env array or config service for node URLs; implement retry logic in blockchain service.
- Acceptance: If one node is down, backend continues processing via second node; health check validates connectivity to both nodes; documented in README.
- Labels: [area/infra] [area/backend] [type/feature] [priority/P2] [blockchain]
- Files: backend/src/services/blockchain.ts, backend/src/config/env.ts, docker-compose.yml

9) Geth metrics and monitoring endpoints
- Description: Enable Geth metrics endpoint (--metrics, --pprof) for both nodes. Optionally configure Prometheus scraping.
- Acceptance: Metrics exposed on each node; documentation for Prometheus setup provided.
- Labels: [area/infra] [type/feature] [priority/P2] [blockchain] [observability]
- Files: docker-compose.yml, docs/observability.md

10) Blockchain network documentation
- Description: Document the private network architecture, Clique consensus parameters, node peering, how to add a third node, and Blockscout usage. Include troubleshooting for peer discovery issues.
- Acceptance: docs/blockchain-setup.md created; covers genesis, bootnode, static-nodes, Blockscout, and operational guides.
- Labels: [area/infra] [type/docs] [priority/P1] [blockchain]
- Files: docs/blockchain-setup.md, README.md

---

## backend/


6) Ping rate limiting (15 pings/min per miner)
- Description: Enforce max 15 pings/min while allowing retries. Use Redis counters with 60s TTL.
- Acceptance: Excess pings yield 429; valid minute still recorded once.
- Labels: [area/backend] [type/feature] [priority/P0]
- Files: src/services/pingService.ts, src/routes/ping.ts

7) Dynamic config service
- Description: Read system settings from `system_config` with in-memory cache (TTL 30s) and fallback to env. Keys: min_withdrawal_threshold, reward_update_interval_minutes, data_retention_days, ping_timeout_seconds.
- Acceptance: Changing config via admin panel takes effect without restart.
- Labels: [area/backend] [type/feature] [priority/P0]
- Files: src/config, src/services/*

8) Apply dynamic config across services
- Description: Replace direct env reads with config service in reward engine, cleanup, status, withdraw threshold, scheduler cadence.
- Acceptance: Runtime reflects DB-configured values; covered by unit tests.
- Labels: [area/backend] [type/feature] [priority/P0]
- Files: src/services/*.ts, src/tasks/scheduler.ts

9) Reward engine correctness & idempotency
- Description: Ensure exactly 24 VIDDHANA/min total is distributed across pool per minute. Prevent double-credit via WHERE reward_amount = 0; reconcile partial cycles.
- Acceptance: Unit tests verifying distribution sum; multiple cycles don’t double credit.
- Labels: [area/backend] [type/bug] [priority/P0]
- Files: src/services/rewardEngine.ts, tests

10) Blockchain integration (ethers / web3)
- Description: Replace placeholder transfer with real JSON-RPC client; handle decimals(18), nonce, gas, admin private key injection via env.
- Acceptance: Successful on-chain transfer returns tx hash; errors surfaced and retried appropriately.
- Labels: [area/backend] [type/feature] [priority/P0]
- Files: src/services/blockchain.ts, .env

11) Withdrawal history API
- Description: Add endpoint to list withdrawals by miner with pagination.
- Acceptance: GET /api/withdrawals?minerId=... -> [{id, amount, status, tx_hash, requested_at}]
- Labels: [area/backend] [type/feature] [priority/P1]
- Files: src/routes, src/services

12) Withdrawal daily limit (optional)
- Description: Enforce configurable daily cap per miner.
- Acceptance: Requests beyond cap rejected; admin config key present.
- Labels: [area/backend] [type/feature] [priority/P2]

13) Withdrawal queue resiliency
- Description: Ensure idempotency and retries; avoid double-processing when queue and processor both mark ‘processing’.
- Acceptance: Concurrency-safe; re-run safe; tests included.
- Labels: [area/backend] [type/bug] [priority/P1]
- Files: src/queues/withdrawalQueue.ts, src/services/withdrawalService.ts

14) Miner registration and auth
- Description: Add endpoint to register miner with wallet signature; issue JWT; link hashrate benchmark.
- Acceptance: Registration verifies signature; protected endpoints require JWT (or at least miner identity binding).
- Labels: [area/backend] [type/feature] [priority/P1]
- Files: src/routes/auth.ts (new), src/services/authService.ts (new)

15) Hashrate benchmark and updates
- Description: Provide API to set/update hashrate per device with validation/rate-limit.
- Acceptance: Hasrate stored; reflected in stats; audit log of changes.
- Labels: [area/backend] [type/feature] [priority/P1]

16) Stats API: hashrate history, active minutes history
- Description: Add endpoints for 24h hashrate history and 7d active minutes aggregation.
- Acceptance: New endpoints power FE charts.
- Labels: [area/backend] [type/feature] [priority/P1]

17) Pool hashrate cache
- Description: Cache pool hashrate per minute for performance.
- Acceptance: Query count reduced in A/B test; correctness preserved.
- Labels: [area/backend] [type/feature] [priority/P2]

18) Health endpoints
- Description: /health extended to include postgres, redis, geth checks.
- Acceptance: JSON includes checks with pass/fail and latency.
- Labels: [area/backend] [type/feature] [priority/P1]

19) Admin metrics endpoints
- Description: Provide totals: active miners, pool hashrate, pending withdrawals count, VIDDHANA distributed (today/week/month).
- Acceptance: Admin FE can render dashboard cards.
- Labels: [area/backend] [type/feature] [priority/P1]

20) Security: API rate limiting
- Description: Add IP/miner-based rate limits for sensitive endpoints (withdrawal).
- Acceptance: Brute-force protected; config driven.
- Labels: [area/backend] [type/feature] [priority/P1]

21) Tests: unit + integration
- Description: Add test harness (vitest/jest) for reward engine, ping→session pipeline, withdrawal happy/failure path.
- Acceptance: CI runs tests; coverage baseline documented.
- Labels: [area/backend] [type/devx] [priority/P1]

22) Error handling & logging uniformity
- Description: Standardize error responses and logs with correlation IDs.
- Acceptance: Errors have consistent structure; logs include context.
- Labels: [area/backend] [type/chore] [priority/P2]

---

## web/

23) Disable withdraw under threshold
- Description: Fetch threshold from backend config; disable button with tooltip until met.
- Acceptance: Button disabled when pending_balance < threshold.
- Labels: [area/web] [type/feature] [priority/P1]

24) Withdrawal history screen
- Description: Table view: Date, Amount, Status, Tx Hash (link).
- Acceptance: Uses new /api/withdrawals endpoint; paginated.
- Labels: [area/web] [type/feature] [priority/P1]

25) Charts: earnings (7d), active time (7d), hashrate (24h)
- Description: Render three mini charts; simple SVG or lightweight lib.
- Acceptance: Charts load with empty state and error handling.
- Labels: [area/web] [type/feature] [priority/P1]

26) Miner identification UX
- Description: Replace raw minerId field with wallet login (optional initial phase: persist minerId in localStorage).
- Acceptance: User does not need to enter ID each visit.
- Labels: [area/web] [type/feature] [priority/P2]

27) Realtime refresh
- Description: Poll stats every 15–30s; optimistic updates post-withdraw.
- Acceptance: Setting configurable via env.
- Labels: [area/web] [type/feature] [priority/P2]

28) Error and loading states polish
- Description: Consistent toasts/messages; skeleton loaders.
- Acceptance: UX variants covered.
- Labels: [area/web] [type/chore] [priority/P3]

---

## admin/

29) Config UI mapping to backend keys
- Description: Align keys with backend dynamic config service; validate numeric ranges and units.
- Acceptance: Save reflects immediately; errors surfaced.
- Labels: [area/admin] [type/feature] [priority/P1]

30) Admin dashboard metrics
- Description: Cards: total active miners, pool hashrate, pending withdrawals, VIDDHANA distributed (today/week/month), service health.
- Acceptance: Uses new admin metrics endpoints.
- Labels: [area/admin] [type/feature] [priority/P1]

31) Pending withdrawals management
- Description: List queue; actions to retry/mark failed; view error message.
- Acceptance: Admin can manage stuck items safely.
- Labels: [area/admin] [type/feature] [priority/P2]

32) Auth for admin panel
- Description: Basic password/JWT protection.
- Acceptance: Admin routes require auth.
- Labels: [area/admin] [type/feature] [priority/P2]

---

## docs/

33) API reference
- Description: Document all endpoints, request/response, error codes.
- Acceptance: Markdown under docs/api.md; kept in sync.
- Labels: [area/devx] [type/docs] [priority/P1]

34) Runbook & onboarding
- Description: Local dev guide, env vars, migrations, common pitfalls.
- Acceptance: README sections expanded; infra commands verified.
- Labels: [area/devx] [type/docs] [priority/P1]

35) Security guidelines
- Description: Wallet verification flow, rate limits, key management.
- Acceptance: docs/security.md added.
- Labels: [area/devx] [type/docs] [priority/P2]

---

## ci-cd/

36) Lint, format, and type checks
- Description: Add ESLint/Prettier and type check scripts; CI workflow.
- Acceptance: `npm run lint`, `npm run typecheck` pass; PR checks active.
- Labels: [area/devx] [type/chore] [priority/P2]

37) Build and containerize services
- Description: Dockerfiles for admin/web; build pipeline; optional preview.
- Acceptance: Images build locally and in CI.
- Labels: [area/infra] [type/devx] [priority/P2]

---

## Quick Issue Seed (copy/paste titles)
- [infra] Healthchecks for services
- [infra] Geth admin wallet prefund
- [infra] DB migrations tooling
- [infra] Partition mining_sessions monthly
- [infra] Multi-node Geth private network (2 nodes, Clique PoA)
- [infra] Blockscout block explorer integration
- [infra] Geth RPC load balancing and failover
- [infra] Geth metrics and monitoring endpoints
- [infra] Blockchain network documentation
- [backend] Ping rate limiting (15/min)
- [backend] Dynamic config service
- [backend] Apply dynamic config everywhere
- [backend] Reward engine idempotency & 24 VIDDHANA/min budget
- [backend] Real blockchain client integration
- [backend] Withdrawal history endpoint
- [backend] Withdrawal daily limit
- [backend] Withdrawal queue idempotency
- [backend] Miner registration + JWT
- [backend] Hashrate benchmark/update API
- [backend] Stats: hashrate history & active minutes
- [backend] Pool hashrate cache
- [backend] Health deep checks
- [backend] Admin metrics endpoints
- [backend] API rate limits
- [backend] Tests (unit/integration)
- [backend] Error/log standardization
- [web] Disable withdraw under threshold
- [web] Withdrawal history page
- [web] Charts: earnings/active/hashrate
- [web] Miner identity UX
- [web] Realtime refresh
- [admin] Config UI mapping & validation
- [admin] Dashboard metrics
- [admin] Pending withdrawals management
- [admin] Admin auth
- [docs] API reference
- [docs] Runbook & onboarding
- [docs] Security guidelines
- [ci] Lint/typecheck/format
- [ci] Build admin/web containers

