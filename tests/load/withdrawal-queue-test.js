/**
 * Load Test: Withdrawal Queue Processing
 * 
 * Test scenario: 50+ concurrent withdrawal requests
 * Duration: 2 minutes
 * Expected: All processed successfully, < 2s per request
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { config, getRandomMinerID, getRandomWallet } from './config.js';

const withdrawalSuccessRate = new Counter('withdrawal_success_count');
const withdrawalFailRate = new Counter('withdrawal_fail_count');
const withdrawalDuration = new Trend('withdrawal_duration_ms');

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Warmup
    { duration: '30s', target: 30 },   // Ramp up
    { duration: '2m', target: 50 },    // Sustained: 50 concurrent
    { duration: '30s', target: 0 },    // Cool down
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<2000'],  // 95% < 2s
    'http_req_failed': ['rate<0.05'],     // < 5% errors (some may fail due to balance)
    'withdrawal_success_count': ['count>50'],
  },
};

export default function () {
  const minerId = getRandomMinerID();
  const walletAddress = getRandomWallet();
  const amount = (Math.random() * 5 + 0.5).toFixed(4); // 0.5-5 VIDDHANA
  
  const payload = JSON.stringify({
    miner_id: minerId,
    wallet_address: walletAddress,
    amount: amount,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'Withdrawal' },
  };
  
  const startTime = Date.now();
  const response = http.post(`${config.baseURL}/api/miner/withdraw`, payload, params);
  const duration = Date.now() - startTime;
  
  withdrawalDuration.add(duration);
  
  const success = check(response, {
    'status is 200 or 400': (r) => [200, 400].includes(r.status), // 400 = insufficient balance OK
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has message': (r) => JSON.parse(r.body).message !== undefined,
  });
  
  if (response.status === 200) {
    withdrawalSuccessRate.add(1);
    const body = JSON.parse(response.body);
    console.log(`✓ Withdrawal queued: ${amount} VIDDHANA for miner ${minerId} (ID: ${body.withdrawal_id})`);
  } else if (response.status === 400) {
    // Expected error (insufficient balance, etc)
    console.log(`○ Withdrawal rejected: ${JSON.parse(response.body).message}`);
  } else {
    withdrawalFailRate.add(1);
    console.error(`✗ Withdrawal failed: ${response.status} - ${response.body}`);
  }
  
  // Space out requests (avoid hammering)
  sleep(1 + Math.random() * 2); // 1-3 seconds
}

export function handleSummary(data) {
  return {
    'stdout': generateSummary(data),
    'results/withdrawal-queue-test-results.json': JSON.stringify(data),
  };
}

function generateSummary(data) {
  return `
========================================
   WITHDRAWAL QUEUE TEST RESULTS
========================================

Duration: ${data.state.testRunDurationMs / 1000}s
VUs max: ${data.metrics.vus_max.values.max}

HTTP Requests:
  Total: ${data.metrics.http_reqs.values.count}
  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
  Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%

Response Time:
  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms
  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
  p(95): ${data.metrics['http_req_duration{p(95)}'].values['p(95)'].toFixed(2)}ms
  p(99): ${data.metrics['http_req_duration{p(99)}'].values['p(99)'].toFixed(2)}ms

Withdrawal Metrics:
  Successful: ${data.metrics.withdrawal_success_count?.values.count || 0}
  Failed: ${data.metrics.withdrawal_fail_count?.values.count || 0}
  Avg Duration: ${data.metrics.withdrawal_duration_ms?.values.avg.toFixed(2) || 0}ms

========================================
`;
}
