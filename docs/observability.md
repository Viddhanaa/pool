# Geth Metrics & Observability

- Both geth nodes expose pprof/metrics:
  - geth1: `http://localhost:6060/debug/pprof` and Prometheus metrics at `/debug/metrics/prometheus`
  - geth2: `http://localhost:7060/debug/pprof` and Prometheus metrics at `/debug/metrics/prometheus`
- Example Prometheus scrape config:
```yaml
scrape_configs:
  - job_name: 'geth'
    metrics_path: /debug/metrics/prometheus
    static_configs:
      - targets:
          - 'localhost:6060'
          - 'localhost:7060'
```
- Use `go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30` for CPU profiling during load.
- Blockscout provides operational logs via `docker compose logs -f blockscout` and DB metrics can be scraped via Postgres exporters (not included).
- Backend performance:
  - Run `./scripts/analyze-performance.sh` to gather Postgres/Redis/container stats and summarize k6 results.
  - Load testing scripts live under `tests/load/` (k6); see `tests/load/README.md` for quick run commands (`./scripts/run-load-tests.sh quick`).
- Ping endpoint tuning tips:
  - Keep `RATE_LIMIT_PER_MINUTE` conservative (defaults to 15) and ensure Redis has adequate CPU/RAM.
  - Hasrate lookups are cached in-memory for 60s to reduce DB hits under heavy ping load.
  - Monitor Redis ops/sec via `redis-cli INFO stats` during ping load tests.
