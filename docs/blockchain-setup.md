# VIDDHANA Miner — Blockchain Network Setup

This document describes the private Ethereum network setup for the VIDDHANA Miner project, including 2-node Geth Clique configuration, metrics, Blockscout explorer, and backend RPC failover.

---

## Architecture Overview

### Network Configuration
- **Chain ID / Network ID**: 202401
- **Consensus**: Clique Proof-of-Authority (PoA)
- **Block Period**: 5 seconds
- **Epoch**: 30000 blocks
- **Nodes**: 2 Geth sealers with static peering + optional Blockscout

### Services (docker-compose)
1. **geth1**: Primary sealer (RPC 8545, WS 8546, P2P 30303, metrics 6060)
2. **geth2**: Secondary sealer (RPC 9545, WS 9546, P2P 30304, metrics 7060)
3. **blockscout-db**: PostgreSQL for Blockscout
4. **blockscout**: Block explorer UI/API (host port 4001)

---

## Genesis Configuration

Located at `infra/geth/genesis.json`:

```json
{
  "config": {
    "chainId": 202401,
    "clique": {
      "period": 5,
      "epoch": 30000
    }
  },
  "difficulty": "1",
  "gasLimit": "0x1c9c380",
  "extraData": "0x00...{signer1_address}{signer2_address}...00",
  "alloc": {
    "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1": {
      "balance": "0x3635c9adc5dea00000"
    },
    "0x45c3c0c9c2c4416b23966fd4e3acec8e84a0f434": {
      "balance": "0x3635c9adc5dea00000"
    }
  }
}
```

### Key Fields
- **extraData**: Concatenates `0x` + 32 zero bytes + signer addresses (40 hex chars each, no 0x prefix) + 65 zero bytes for signature
- **alloc**: Prefunded accounts for admin wallet and testing
- **clique.period**: Time between blocks (5 seconds)

---

## Node Setup

### Keys
- **Signer1**: `infra/geth/admin.key` → address `0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1`
- **Signer2**: `infra/geth/signer2.key` → address `0x45c3c0c9c2c4416b23966fd4e3acec8e84a0f434`
- **static-nodes.json**: precomputed enodes for deterministic nodekeys.

### Peer Discovery
`infra/geth/static-nodes.json` mounts into each node:
```json
[
  "enode://4f355b...2f1c1@geth1:30303",
  "enode://466d7f...e1278a@geth2:30303"
]
```

### Ports
- geth1: RPC 8545, WS 8546, P2P 30303, metrics/pprof 6060
- geth2: RPC 9545, WS 9546, P2P 30304, metrics/pprof 7060

---

## Blockscout Integration

### Configuration (compose)
- Image: `blockscout/blockscout:latest`
- DB: `blockscout-db` (Postgres 15, user/pass `postgres/postgres`, db `blockscout`)
- RPC: `ETHEREUM_JSONRPC_HTTP_URL=http://geth1:8545`, `ETHEREUM_JSONRPC_WS_URL=ws://geth1:8546`
- Chain metadata: `CHAIN_ID=202401`, `NETWORK=VIDDHANA Private`, `SUBNETWORK=Clique PoA`, `COIN=VIDDHANA`
- Port: exposed on host `4001`

### Accessing Blockscout
- URL: http://localhost:4001
- Features: browse blocks/txs, search by address/tx hash/block, live sync with new blocks.

---

## Running the Network

### Start All Services
```bash
# Chain + app + explorer
docker compose --profile chain --profile app --profile explorer up -d
```

### Start Chain Only
```bash
docker compose --profile chain up -d geth1 geth2
```

### Health Checks
```bash
# Check node 1
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'

# Check node 2
curl -s -X POST http://localhost:9545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'

# Peer count
curl -s -X POST http://localhost:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
```

### View Logs
```bash
docker compose logs -f geth1 geth2
docker compose logs -f blockscout
```

---

## Adding a Third Node

1. Generate a new signer key (store as `infra/geth/signer3.key`) and add its address to `extraData` + `alloc` in `genesis.json`.
2. Duplicate geth2 service in `docker-compose.yml` as geth3 with unique ports/nodekeyhex.
3. Import signer3 into geth3 via an import init step and add its enode to `infra/geth/static-nodes.json`.
4. Re-run `gethN-init/import` or reset data directories if genesis changes; restart chain services.

---

## Troubleshooting

### Peers Not Connecting
- Verify static-nodes.json is mounted and formatted correctly
- Check firewall rules for P2P ports (30303, 30304)
- Inspect logs for "Peer discovery" messages
- Ensure both nodes use same genesis.json and networkid

### Blockscout Not Syncing
- Verify ETHEREUM_JSONRPC_HTTP_URL points to a healthy node
- Check database connection: `docker compose exec blockscout-db psql -U blockscout`
- Inspect blockscout-backend logs for indexer errors
- Ensure Geth RPC API includes: `eth,net,web3,txpool`

### Block Production Stopped
- Verify at least one signer node is running
- Check node is unlocked: `--unlock <address> --password <file>`
- Inspect logs for Clique seal errors
- Confirm network time is synchronized

### Backend RPC Failover
- Backend reads `RPC_URLS` (comma-separated) and will retry in order; ensure both geth1/geth2 RPCs are reachable.
- `/health` exposes per-node status under `geth.nodes`.

### Slow Block Indexing
- Increase Blockscout `INDEXER_MEMORY_LIMIT` env
- Tune PostgreSQL settings (shared_buffers, work_mem)
- Use `--cache` flag on Geth for faster sync

---

## Security Considerations

- **Private Network**: Nodes are not exposed to public internet by default
- **Wallet Keys**: Admin private keys stored in `.env` and mounted as secrets
- **RPC Access**: Limit `--http.api` to required methods; avoid `personal` in production
- **Blockscout Auth**: Consider adding authentication for public-facing deployments

---

## Metrics and Monitoring

### Geth Metrics
Enable metrics on nodes:
```yaml
command: ["--metrics", "--pprof", "--pprof.addr", "0.0.0.0"]
```

Access metrics:
- Node 1: http://localhost:6060/debug/metrics
- Node 2: http://localhost:6061/debug/metrics

### Prometheus Scraping
Add targets in `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'geth-node1'
    static_configs:
      - targets: ['geth-node1:6060']
  - job_name: 'geth-node2'
    static_configs:
      - targets: ['geth-node2:6060']
```

---

## References

- [Geth Clique Documentation](https://geth.ethereum.org/docs/fundamentals/private-network)
- [Blockscout Deployment Guide](https://docs.blockscout.com/for-developers/deployment)
- [Static Nodes Configuration](https://geth.ethereum.org/docs/fundamentals/peer-to-peer#static-nodes)
