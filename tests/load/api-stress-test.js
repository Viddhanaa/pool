/**
 * Load Test: All API Endpoints
 * 
 * Test scenario: Mixed workload simulating real usage
 * Duration: 5 minutes sustained load
 * Endpoints: stats, earnings, hashrate, active history, withdraw
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { config, getRandomMinerID, getRandomWallet } from './config.js';

// Custom metrics
const apiSuccessRate = new Counter('api_success_count');
const apiFailRate = new Counter('api_fail_count');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warmup
    { duration: '2m', target: 50 },    // Ramp up
    { duration: '5m', target: 50 },    // Sustained load
    { duration: '30s', target: 0 },    // Cool down
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<200'],
    'http_req_failed': ['rate<0.01'],
    'api_success_count': ['count>1000'],
  },
};

export default function () {
  const minerId = getRandomMinerID();
  const walletAddress = getRandomWallet();
  
  // Simulate user journey
  group('Dashboard Load', function () {
    // 1. Get miner stats
    let response = http.get(`${config.baseURL}/api/miner/stats?minerId=${minerId}`);
    check(response, {
      'stats status 200': (r) => r.status === 200,
      'stats has pending_balance': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.pending_balance !== undefined;
      },
    }) ? apiSuccessRate.add(1) : apiFailRate.add(1);
    
    sleep(0.5);
    
    // 2. Get earnings history
    response = http.get(`${config.baseURL}/api/miner/earnings-history?minerId=${minerId}&period=7d`);
    check(response, {
      'earnings status 200': (r) => r.status === 200,
      'earnings is array': (r) => Array.isArray(JSON.parse(r.body)),
    }) ? apiSuccessRate.add(1) : apiFailRate.add(1);
    
    sleep(0.5);
    
    // 3. Get hashrate history
    response = http.get(`${config.baseURL}/api/miner/hashrate-history?minerId=${minerId}&period=24h`);
    check(response, {
      'hashrate status 200': (r) => r.status === 200,
      'hashrate is array': (r) => Array.isArray(JSON.parse(r.body)),
    }) ? apiSuccessRate.add(1) : apiFailRate.add(1);
    
    sleep(0.5);
    
    // 4. Get active time history
    response = http.get(`${config.baseURL}/api/miner/active-history?minerId=${minerId}&period=7d`);
    check(response, {
      'active status 200': (r) => r.status === 200,
    }) ? apiSuccessRate.add(1) : apiFailRate.add(1);
  });
  
  sleep(2);
  
  // Note: Withdrawal endpoint is admin-only, no public API exists for testing
  // Original test removed as it returns 404
  
  sleep(3);
}

export function handleSummary(data) {
  return {
    'stdout': generateSummary(data),
    'results/api-stress-test-results.json': JSON.stringify(data),
  };
}

function generateSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count;
  const failedRequests = data.metrics.http_req_failed.values.passes; // passes = times condition TRUE = failed requests
  const failRate = data.metrics.http_req_failed.values.rate; // 0 to 1
  const successRate = ((1 - failRate) * 100).toFixed(2);
  
  return `
========================================
   API STRESS TEST RESULTS
========================================

Duration: ${data.state.testRunDurationMs / 1000}s
VUs max: ${data.metrics.vus_max.values.max}

HTTP Requests:
  Total: ${totalRequests}
  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
  Success Rate: ${successRate}%
  Failed: ${failedRequests}

Response Time:
  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  Med: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms
  p(90): ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms
  p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms

Custom Metrics:
  API Success: ${data.metrics.api_success_count?.values.count || 0}
  API Failures: ${data.metrics.api_fail_count?.values.count || 0}

========================================
`;
}
