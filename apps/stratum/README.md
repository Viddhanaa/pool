# Stratum Mining Server

A production-ready Stratum V1 mining server implementation in Go for the VIDDHANA POOL.

## Features

- **Stratum V1 Protocol**: Full implementation of mining.subscribe, mining.authorize, mining.submit, and notifications
- **Variable Difficulty (VarDiff)**: Automatic difficulty adjustment based on worker hashrate
- **High Performance**: Handles thousands of concurrent connections with goroutines
- **TLS Support**: Optional TLS encryption for secure connections
- **Prometheus Metrics**: Built-in metrics endpoint for monitoring
- **Redis Integration**: Real-time share tracking, worker status, and caching
- **PostgreSQL Storage**: Persistent storage for workers, shares, and blocks
- **Graceful Shutdown**: Clean connection handling during shutdown

## Project Structure

```
apps/stratum/
├── cmd/
│   └── stratum/
│       └── main.go           # Entry point
├── configs/
│   └── config.yaml           # Configuration file
├── internal/
│   ├── config/
│   │   └── config.go         # Configuration loading
│   ├── mining/
│   │   ├── job.go            # Job generation and management
│   │   └── share.go          # Share validation
│   ├── protocol/
│   │   ├── difficulty.go     # VarDiff implementation
│   │   └── stratum.go        # Stratum protocol types
│   ├── server/
│   │   ├── connection.go     # Connection handler
│   │   └── server.go         # TCP server
│   ├── storage/
│   │   ├── postgres.go       # PostgreSQL client
│   │   └── redis.go          # Redis client
│   └── worker/
│       └── worker.go         # Worker tracking
├── pkg/
│   └── crypto/
│       └── pow.go            # Proof of Work utilities
├── Dockerfile                # Container build
├── go.mod                    # Go module definition
├── go.sum                    # Dependency checksums
└── README.md                 # This file
```

## Quick Start

### Prerequisites

- Go 1.21+
- Redis
- PostgreSQL
- (Optional) Cryptocurrency node with RPC enabled

### Build

```bash
# Build the binary
go build -o bin/stratum ./cmd/stratum

# Or run directly
go run ./cmd/stratum -config configs/config.yaml
```

### Configuration

Copy and edit the configuration file:

```bash
cp configs/config.yaml configs/config.local.yaml
# Edit configs/config.local.yaml with your settings
```

Key configuration options:

```yaml
server:
  host: "0.0.0.0"
  port: 3333
  max_connections: 10000
  
mining:
  initial_difficulty: 1.0
  target_share_time: 10s
  
redis:
  host: "localhost"
  port: 6379
  
postgres:
  host: "localhost"
  port: 5432
  database: "mining_pool"
```

### Docker

```bash
# Build image
docker build -t stratum-server .

# Run container
docker run -d \
  -p 3333:3333 \
  -p 9090:9090 \
  -v ./configs:/app/configs \
  stratum-server
```

## Stratum Protocol

### Supported Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `mining.subscribe` | Client → Server | Subscribe to mining notifications |
| `mining.authorize` | Client → Server | Authorize worker with username/password |
| `mining.submit` | Client → Server | Submit share/solution |
| `mining.set_difficulty` | Server → Client | Set worker difficulty |
| `mining.notify` | Server → Client | New job notification |

### Example Session

```json
// Client: Subscribe
{"id": 1, "method": "mining.subscribe", "params": ["user-agent"]}

// Server: Response
{"id": 1, "result": [[["mining.set_difficulty", "sub_id"], ["mining.notify", "sub_id"]], "extranonce1", 4], "error": null}

// Client: Authorize
{"id": 2, "method": "mining.authorize", "params": ["worker.name", "password"]}

// Server: Response + Difficulty + Job
{"id": 2, "result": true, "error": null}
{"id": null, "method": "mining.set_difficulty", "params": [1.0]}
{"id": null, "method": "mining.notify", "params": ["job_id", "prevhash", "coinbase1", "coinbase2", ["merkle"], "version", "nbits", "ntime", true]}

// Client: Submit share
{"id": 3, "method": "mining.submit", "params": ["worker.name", "job_id", "extranonce2", "ntime", "nonce"]}
```

## Metrics

Prometheus metrics are available at `http://localhost:9090/metrics`:

- `stratum_active_connections`: Current number of active connections
- `stratum_total_connections`: Total connections since startup
- `stratum_shares_total{status}`: Shares by status (valid, stale, duplicate, invalid)
- `stratum_share_processing_seconds`: Share processing latency histogram
- `stratum_blocks_found_total`: Total blocks found
- `stratum_active_workers`: Number of active workers
- `stratum_worker_hashrate{worker}`: Estimated hashrate per worker
- `stratum_current_block_height`: Current block height
- `stratum_jobs_generated_total`: Total jobs generated

## Database Schema

The server automatically creates the following tables:

- `workers`: Worker registration and activity tracking
- `shares`: Share submission history
- `blocks`: Found blocks and confirmation status
- `payouts`: Payout tracking (for external use)

## Development

### Running Tests

```bash
go test ./...
```

### Linting

```bash
golangci-lint run
```

### Benchmarks

```bash
go test -bench=. ./...
```

## Architecture

```
                    ┌──────────────┐
                    │   Miners     │
                    └──────┬───────┘
                           │ TCP/TLS
                    ┌──────▼───────┐
                    │    Server    │
                    │  (TCP Accept)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐  ┌──▼───┐  ┌────▼─────┐
       │ Connection  │  │ Job  │  │  Share   │
       │   Handler   │  │ Mgr  │  │ Validator│
       └──────┬──────┘  └──┬───┘  └────┬─────┘
              │            │            │
       ┌──────▼──────┐     │     ┌─────▼─────┐
       │   Worker    │     │     │   Redis   │
       │   Manager   │     │     │  (Cache)  │
       └─────────────┘     │     └───────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │ (Persistence)│
                    └──────────────┘
```

## License

Copyright 2024 VIDDHANA POOL. All rights reserved.
