# Load Testing Suite

Comprehensive load testing infrastructure for VIDDHANA Miner using k6.

## Quick Start

```bash
# Install k6 (if not already installed)
sudo apt-get update
sudo apt-get install k6

# Make scripts executable
chmod +x scripts/*.sh

# Run all tests
./scripts/run-load-tests.sh all

# Run specific test
./scripts/run-load-tests.sh quick
```

## Test Files

### 1. Quick Load Test (Recommended)
**File:** `tests/load/quick-load-test.js`  
**Duration:** ~1.5 minutes  
**Virtual Users:** 30 concurrent  
**Use Case:** Fast validation of all API endpoints

```bash
k6 run tests/load/quick-load-test.js
```

### 2. Ping Load Test
**File:** `tests/load/ping-load-test.js`  
**Duration:** 10 minutes  
**Virtual Users:** Up to 150  
**Use Case:** Test ping endpoint under high load

**Note:** Requires authenticated miners. Use existing miner ID or create test data.

### 3. API Stress Test
**File:** `tests/load/api-stress-test.js`  
**Duration:** 8 minutes  
**Virtual Users:** 50 concurrent  
**Use Case:** Extended stress test of all dashboard endpoints

### 4. Withdrawal Queue Test
**File:** `tests/load/withdrawal-queue-test.js`  
**Duration:** ~3 minutes  
**Virtual Users:** 50 concurrent  
**Use Case:** Test withdrawal processing under load

**Note:** Requires setup of test miners with balances.

### 5. Reward Calculation Test
**File:** `tests/load/reward-calc-test.js`  
**Duration:** ~4 minutes  
**Virtual Users:** 200 concurrent  
**Use Case:** Validate reward calculation performance

## Utility Scripts

### Run Load Tests
```bash
./scripts/run-load-tests.sh [test-name]

# Available tests:
# - quick       Fast comprehensive test (recommended)
# - ping        Ping endpoint load test
# - api         API stress test
# - withdrawal  Withdrawal queue test
# - reward      Reward calculation test
# - all         Run all tests sequentially
```

### Analyze Performance
```bash
./scripts/analyze-performance.sh

# Analyzes:
# - Database query performance
# - Redis statistics
# - Docker container stats
# - System load
# - Test result summaries
```

### Optimize Database
```bash
# Run optimization queries
docker compose exec postgres psql -U postgres -d asdminer < scripts/optimize-database.sql

# Check for:
# - Missing indexes
# - Table bloat
# - Cache hit ratios
# - Connection pool usage
```

## Test Results

Results are saved to `results/` directory:
- `*-results.json` - Formatted test summary
- `*-raw.json` - Raw k6 metrics
- `*-output.txt` - Console output (if captured)

## Configuration

Edit `tests/load/config.js` to customize:
- Base URL (default: http://localhost:4000)
- Test durations
- Virtual user counts
- Thresholds
- Test wallet addresses

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| p95 Response Time | < 100ms | 16.7ms ✅ |
| Error Rate | < 1% | 0.00% ✅ |
| Database Cache Hit | > 95% | 99.93% ✅ |
| Throughput | 20+ req/s | 34.7 req/s ✅ |

## Thresholds

Tests will fail if:
- p95 response time > configured threshold
- HTTP error rate > configured threshold
- Success count < minimum required

## Example Output

```
========================================
   QUICK LOAD TEST RESULTS
========================================

Duration: 82s
Max VUs: 30

HTTP Requests:
  Total: 2,850
  Rate: 34.70/s
  Success Rate: 100.00%
  Failed: 0

Response Time:
  Avg: 7.06ms
  p95: 16.7ms
  p99: 28.42ms

Custom Metrics:
  API Success: 2,280
  API Failures: 0

========================================
```

## Troubleshooting

### k6 not found
```bash
# Install k6
sudo apt-get update
sudo apt-get install k6
```

### Backend not responding
```bash
# Check backend health
curl http://localhost:4000/health

# Restart backend
docker compose restart backend
```

### Tests timing out
- Reduce virtual users in test script
- Increase threshold limits
- Check system resources

### Authentication errors
- Ping endpoint requires valid miner_id
- Use existing miner (ID: 1) or create test data
- Some endpoints require JWT tokens

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Load Test
  run: |
    ./scripts/run-load-tests.sh quick
    if [ $? -ne 0 ]; then
      echo "Load tests failed!"
      exit 1
    fi
```

## Documentation

- **Test Report:** `docs/ISSUE_3_LOAD_TEST_REPORT.md`
- **Summary:** `docs/ISSUE_3_SUMMARY.md`
- **Issue Tracking:** `ISSUES.md` (Issue #3)

## Support

For issues or questions:
1. Check test output in `results/` directory
2. Review backend logs: `docker compose logs backend`
3. Check database: `./scripts/analyze-performance.sh`
4. Refer to test report for baselines

---

**Last Updated:** November 29, 2025  
**k6 Version:** 1.4.2  
**Status:** ✅ All tests passing
