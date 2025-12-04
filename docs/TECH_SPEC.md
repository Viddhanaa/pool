# VIDDHANA Miner — Technical Specification (Updated)

## 1. Overview
VIDDHANA Miner là hệ thống mining pool pseudo-mining trên private VIDDHANA chain. Miners chỉ ping để chứng minh online, hệ thống tính reward theo phút và cho phép withdraw khi đủ threshold.

## 2. Blockchain Specifications
- **Chain**: Geth private chain
- **Coin**: VIDDHANA (18 decimals)
- **Block time**: 5s
- **Block reward**: 2 VIDDHANA
- **Total supply**: 1,000,000,000,000 VIDDHANA
- **Reward collection**: Block rewards gom về admin wallet; backend tính toán phân phối khi user rút

## 3. Mining Mechanism
- Pseudo-mining: miners KHÔNG hash, chỉ ping mỗi 5s (có retry)
- Điểm tính theo **phút** (ping bao nhiêu lần trong phút không quan trọng)
- Hashrate benchmark một lần khi device đăng ký
- Reward/minute = (Miner Hashrate / Total Pool Hashrate) × 24 VIDDHANA
- Balance update: 1–5 phút (configurable), FE hiển thị realtime pending balance
- Withdraw khi đạt threshold tối thiểu

### Example
- Miner 1: 1000 H/s → ~8 VIDDHANA/min
- Miner 2: 2000 H/s → ~16 VIDDHANA/min
- Pool: 3000 H/s → 24 VIDDHANA/min

## 4. Withdrawal System
- Minimum threshold: mặc định 100 VIDDHANA (admin chỉnh được)
- User phải chủ động request withdraw (không auto)
- Flow: check balance ≥ threshold → create request → lock balance → process transfer → update status (completed/failed)

## 5. Ping & Monitoring
- Ping interval: 5s, lưu Redis TTL 5 phút
- Minute-based tracking: chỉ cần **1 ping thành công trong phút** để tính online 1 phút
- Reward cho `n` phút: `(hashrate / pool_hashrate) × 24 × n`

Metrics: active minutes, total earned, available balance, pending withdraw

## 6. System Architecture
### Core components
- Ping Tracking Service (Redis + DB minute marks)
- Reward Calculation Engine (cron 1–5 phút)
- Withdrawal Service (queue + blockchain transfer)
- Data Cleanup Service (cron daily)

### Data flow
```
Miner ping (5s) → Ping Service → Redis (last_ping_time)
                                 ↓
                   Minute Aggregator (group by minute)
                                 ↓
                   Reward Calculator (1-5 min interval)
                                 ↓
                   Update pending_balance
                                 ↓
            User withdraw → Withdrawal Service → Transfer VIDDHANA
```
Partitioning: `mining_sessions` is RANGE partitioned by month with trigger-based auto-creation; current + next month partitions are seeded, and a default trigger ensures new months are created on insert.

## 7. Database Schema
### Tables
- **miners**: miner_id (PK), wallet_address (unique), device_type, hashrate, pending_balance, total_earned, last_ping_time, status, created_at
- **mining_sessions**: session_id (PK), miner_id (FK), start_minute (timestamp), hashrate_snapshot, reward_amount, created_at, expires_at
- **withdrawals**: withdrawal_id (PK), miner_id (FK), amount, wallet_address, status, tx_hash, requested_at, completed_at, error_message
- **ping_logs**: miner_id, timestamp, ip_address, ttl
- **system_config**: config_key, config_value, updated_at

### Index hints
- `miners(wallet_address)`
- `mining_sessions(miner_id, start_minute)`
- `withdrawals(miner_id)`, `withdrawals(status)`

## 8. Implementation Notes
- Ping service: store ping in Redis (TTL 5m), set minute key (TTL 2m) for first ping per minute, queue DB write
- Reward calculator (cron 1–5m): aggregate sessions, compute rewards: `(miner_hashrate / total_pool_hashrate) × 24 VIDDHANA × minutes`, update balances
- Withdrawal service: validate threshold, decrement pending balance atomically, insert withdrawal, queue transfer; on fail, refund pending balance
- Cleanup: delete mining_sessions >7d, optional archive withdrawals >90d, clear ping_logs >1h

## 9. Frontend Requirements
- Charts: earnings (7d), hashrate (24h), active time (7d)
- Stats endpoint `/api/miner/stats` → pending_balance, total_earned, active_minutes_today, current_hashrate, pool_hashrate
- Withdrawal UI: show pending balance + threshold, withdraw button (disabled nếu < threshold), history table (date, amount, status, tx)

## 10. Admin Panel
- Configs: min withdrawal threshold, reward update interval, data retention, ping timeout
- Dashboard: total active miners, pool hashrate, pending withdrawals, VIDDHANA distributed, health metrics

## 11. Performance
- Redis 10k+ pings/s; DB partition `mining_sessions` by month
- Batch insert minute sessions; cache pool hashrate (per minute)
- Queue (RabbitMQ/Redis) cho withdrawal processing; load balancer cho ping service

## 12. Security
- Wallet verification via signed message
- Rate limiting: max 15 pings/minute per miner (retry allowed)
- Withdrawal limits per day (optional)
- Admin wallet: multi-sig/cold storage
- API auth: JWT tokens

## 13. Phasing
1. Core: blockchain setup, ping tracking, reward engine
2. Withdrawal: service + balance management + tx processing
3. Clients: web miner, mobile/desktop
4. Polish: charts, admin panel, cleanup automation
