# Backend Integration Guide for Pools

## Responsibilities
- Backend calculates rewards, enforces business rules, and exposes REST endpoints.
- On-chain pools and rewards contracts are treated as a downstream system, not as the source of truth for off-chain miner state.

## Key Backend Areas
- `backend/src/routes/` for HTTP endpoints (auth, metrics, pool interactions).
- `backend/src/middleware/` for auth, rate limiting, admin checks, and error handling.
- Reward engine and withdrawal logic (see existing mining reward/withdrawal services) must be extended, not duplicated.

## Workflow for New Pool Features
1. Read `AGENTS.md`, `blueprints/POOL_IMPLEMENTATION_BLUEPRINT.md`, and relevant `docs/` first.
2. Design request/response shapes for any new API; prefer explicit DTO types.
3. Add or extend services for reward calc, pool accounting sync, and withdrawal queues.
4. Keep controller/route files thin; delegate logic to services and utils.
5. Ensure new code paths are covered by Vitest + supertest HTTP tests.

## Error Handling & Security
- All routes must use centralized error middleware and return sanitized messages.
- Authenticate and authorize access to admin/pool management endpoints; never expose raw internal IDs.
- Input validation is mandatory (types, ranges, enums); treat everything from HTTP, env, and RPC as untrusted.

## Observability
- Emit structured logs (at least level + context) for pool/reward/withdrawal operations.
- Use metrics (Prometheus-like) to track key rates: deposits, withdrawals, failed oracle reads, circuit breaker trips.
