import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
};

export default function () {
  const res = http.get('http://localhost:4000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  console.log('=== METRICS STRUCTURE ===');
  console.log(JSON.stringify(Object.keys(data.metrics), null, 2));
  console.log('\n=== HTTP_REQ_DURATION ===');
  console.log(JSON.stringify(data.metrics.http_req_duration, null, 2));
  return { 'stdout': '' };
}
