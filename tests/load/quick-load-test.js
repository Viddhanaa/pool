/**
 * Quick Load Test - Simplified version for fast testing
 * Tests all major API endpoints with reduced duration
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter } from 'k6/metrics';

const config = {
  baseURL: __ENV.BASE_URL || 'http://localhost:4000',
};

const successCount = new Counter('api_success');
const failCount = new Counter('api_fail');

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Warmup: 10 users
    { duration: '30s', target: 30 },   // Ramp: 30 users  
    { duration: '30s', target: 30 },   // Sustained: 30 users
    { duration: '10s', target: 0 },    // Cool down
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<300'],
    'http_req_failed': ['rate<0.05'],
    'api_success': ['count>100'],
  },
};

export default function () {
  const minerId = 1;
  
  group('Health Check', function () {
    const res = http.get(`${config.baseURL}/health`);
    check(res, {
      'health OK': (r) => r.status === 200 && JSON.parse(r.body).ok === true,
    }) ? successCount.add(1) : failCount.add(1);
  });
  
  sleep(0.5);
  
  group('Miner Stats', function () {
    const res = http.get(`${config.baseURL}/api/miner/stats?minerId=${minerId}`);
    check(res, {
      'stats OK': (r) => r.status === 200,
      'has pending_balance': (r) => {
        if (r.status !== 200) return false;
        return JSON.parse(r.body).pending_balance !== undefined;
      },
    }) ? successCount.add(1) : failCount.add(1);
  });
  
  sleep(0.5);
  
  group('Earnings History', function () {
    const res = http.get(`${config.baseURL}/api/miner/earnings-history?minerId=${minerId}&period=7d`);
    check(res, {
      'earnings OK': (r) => r.status === 200,
      'is array': (r) => Array.isArray(JSON.parse(r.body)),
    }) ? successCount.add(1) : failCount.add(1);
  });
  
  sleep(0.5);
  
  group('Hashrate History', function () {
    const res = http.get(`${config.baseURL}/api/miner/hashrate-history?minerId=${minerId}&period=24h`);
    check(res, {
      'hashrate OK': (r) => r.status === 200,
    }) ? successCount.add(1) : failCount.add(1);
  });
  
  sleep(0.5);
  
  group('Active History', function () {
    const res = http.get(`${config.baseURL}/api/miner/active-history?minerId=${minerId}&period=7d`);
    check(res, {
      'active OK': (r) => r.status === 200,
    }) ? successCount.add(1) : failCount.add(1);
  });
  
  sleep(1);
}

export function handleSummary(data) {
  const totalReqs = data.metrics.http_reqs.values.count;
  const failedReqs = Math.floor(data.metrics.http_req_failed.values.rate * totalReqs);
  const successRate = ((totalReqs - failedReqs) / totalReqs * 100).toFixed(2);
  
  const summary = `
========================================
   QUICK LOAD TEST RESULTS
========================================

Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s
Max VUs: ${data.metrics.vus_max.values.max}

HTTP Requests:
  Total: ${totalReqs}
  Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
  Success Rate: ${successRate}%
  Failed: ${failedReqs}

Response Time:
  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms
  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
  p(50): ${data.metrics.http_req_duration.values.med.toFixed(2)}ms
  p(95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  p(99): ${(data.metrics.http_req_duration.values['p(99)'] || 0).toFixed(2)}ms

Test Groups:
  Health Check: ${data.metrics['http_req_duration{group:::Health Check}']?.values.count || 0} requests
  Miner Stats: ${data.metrics['http_req_duration{group:::Miner Stats}']?.values.count || 0} requests
  Earnings History: ${data.metrics['http_req_duration{group:::Earnings History}']?.values.count || 0} requests
  Hashrate History: ${data.metrics['http_req_duration{group:::Hashrate History}']?.values.count || 0} requests
  Active History: ${data.metrics['http_req_duration{group:::Active History}']?.values.count || 0} requests

Custom Metrics:
  API Success: ${data.metrics.api_success?.values.count || 0}
  API Failures: ${data.metrics.api_fail?.values.count || 0}

========================================
`;
  
  return {
    'stdout': summary,
    'results/quick-load-test-results.json': JSON.stringify(data),
  };
}
