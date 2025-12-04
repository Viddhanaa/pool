import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05']
  }
};

export function setup() {
  const miners = [];
  for (let i = 0; i < 1000; i++) {
    const res = http.post(
      'http://localhost:4000/api/auth/register-open',
      JSON.stringify({
        wallet_address: `0xtest${i.toString().padStart(40, '0')}`,
        hashrate: 1000 + Math.random() * 1000,
        device_type: 'loadtest'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    miners.push(res.json().minerId);
  }
  return { miners };
}

export default function (data) {
  const minerId = data.miners[Math.floor(Math.random() * data.miners.length)];
  const payload = JSON.stringify({
    miner_id: minerId,
    hashrate: 1000 + Math.random() * 500,
    device_type: 'loadtest'
  });

  const res = http.post('http://localhost:4000/api/ping', payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response time < 500ms': (r) => r.timings.duration < 500
  });

  errorRate.add(!success);
  sleep(5);
}

export function teardown(data) {
  console.log(`Load test complete. ${data.miners.length} miners tested.`);
}
