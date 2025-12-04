import http from 'k6/http';

export const options = { vus: 1, duration: '5s' };

export default function () {
  http.get('http://localhost:4000/api/health');
}

export function handleSummary(data) {
  console.log('http_req_failed:', JSON.stringify(data.metrics.http_req_failed, null, 2));
  return { 'stdout': '' };
}
