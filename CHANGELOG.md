# Changelog

## 2025-12-02
- Fixed reward per-minute calculation and aligned tests.
- Added hashrate cache invalidation and partition fallback for mining_sessions.
- Secured withdrawal logic with conditional updates, balance constraints, and idempotency key.
- Added cleanup for ping_logs and increased withdrawal queue stale timeout.
- Added unit, integration-lite tests, and k6 load script; all tests now pass (`cd backend && npm test`).
- Applied IP rate-limit for register-open and idempotent withdraw handling.
