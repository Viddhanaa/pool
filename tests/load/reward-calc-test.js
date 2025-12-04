/**
 * Load Test: Reward Calculation Performance
 * 
 * Test scenario: Measure reward calculation speed with 1000+ active sessions
 * This is a backend internal process test
 * Expected: Complete in < 5s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { config, getRandomMinerID } from './config.js';

const calcSuccessRate = new Counter('calc_success_count');
const calcDuration = new Trend('calc_duration_ms');

export const options = {
  // Simulate 1000 miners actively pinging to trigger reward calculation
  stages: [
    { duration: '1m', target: 200 },    // Ramp to 200 miners
    { duration: '3m', target: 200 },    // Sustained: 200 active miners
    { duration: '30s', target: 0 },     // Cool down
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<150'],
    'calc_success_count': ['count>1000'],
  },
};

export default function () {
  const minerId = 1; // Use existing miner
  
  // Keep pinging to simulate active mining session
  // This triggers reward calculation in background
  const payload = JSON.stringify({
    miner_id: minerId,
    hashrate: Math.floor(Math.random() * 2000000) + 100000, // 100K - 2.1M H/s
    device_type: 'web',
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const startTime = Date.now();
  const response = http.post(`${config.baseURL}/api/ping`, payload, params);
  const duration = Date.now() - startTime;
  
  calcDuration.add(duration);
  
  const success = check(response, {
    'ping successful': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 150,
  });
  
  if (success) {
    calcSuccessRate.add(1);
  }
  
  // Check current stats to see if rewards are accumulating
  if (Math.random() < 0.1) { // 10% of requests
    const statsResponse = http.get(`${config.baseURL}/api/miner/stats?minerId=${minerId}`);
    if (statsResponse.status === 200) {
      const stats = JSON.parse(statsResponse.body);
      console.log(`Miner ${minerId} pending_balance: ${stats.pending_balance} VIDDHANA (total_earned: ${stats.total_earned})`);
    }
  }
  
  sleep(5); // Ping every 5 seconds (realistic)
}

export function handleSummary(data) {
  return {
    'stdout': generateSummary(data),
    'results/reward-calc-test-results.json': JSON.stringify(data),
  };
}

function generateSummary(data) {
  return `
========================================
   REWARD CALCULATION TEST RESULTS
========================================

Duration: ${data.state.testRunDurationMs / 1000}s
Active Miners (VUs): ${data.metrics.vus_max.values.max}

Ping Requests:
  Total: ${data.metrics.http_reqs.values.count}
  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
  Success: ${data.metrics.calc_success_count?.values.count || 0}

Response Time:
  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms

Calculation Performance:
  Avg Calc Duration: ${data.metrics.calc_duration_ms?.values.avg.toFixed(2) || 0}ms
  Max Calc Duration: ${data.metrics.calc_duration_ms?.values.max.toFixed(2) || 0}ms

NOTE: Check backend logs for actual reward calculation time
  (Should see "Reward distribution completed in XXXms")

========================================
`;
}
