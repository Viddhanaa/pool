import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { getRandomMinerID } from './config.js';
import { Counter } from 'k6/metrics';

const apiSuccess = new Counter('api_success_count');
const apiFail = new Counter('api_fail_count');

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100'],
    'checks': ['rate>0.95'],
  },
};

export default function () {
  const minerId = getRandomMinerID();
  
  group('Dashboard APIs', function() {
    const res1 = http.get(`http://localhost:4000/api/miner/stats?minerId=${minerId}`);
    if (check(res1, {
      'stats OK': (r) => r.status === 200,
      'has pending_balance': (r) => {
        if (r.status !== 200) return false;
        return JSON.parse(r.body).pending_balance !== undefined;
      }
    })) {
      apiSuccess.add(1);
    } else {
      apiFail.add(1);
    }
    
    const res2 = http.get(`http://localhost:4000/api/miner/earnings-history?minerId=${minerId}`);
    check(res2, { 'earnings OK': (r) => r.status === 200 });
    
    const res3 = http.get(`http://localhost:4000/api/miner/hashrate-history?minerId=${minerId}`);
    check(res3, { 'hashrate OK': (r) => r.status === 200 });
    
    const res4 = http.get(`http://localhost:4000/api/miner/active-history?minerId=${minerId}`);
    check(res4, { 'active OK': (r) => r.status === 200 });
  });
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': generateSummary(data),
    'results/api-stress-quick-results.json': JSON.stringify(data),
  };
}

function generateSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count;
  const failedRequests = data.metrics.http_req_failed.values.passes; // passes = times condition TRUE = failed requests
  const failRate = data.metrics.http_req_failed.values.rate; // 0 to 1
  const successRate = ((1 - failRate) * 100).toFixed(2);
  
  return `
========================================
   API STRESS TEST (QUICK) RESULTS
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
