import http from 'k6/http';

export const options = { iterations: 5 };

export default function () {
  // 3 success, 2 failed
  http.get('http://localhost:4000/api/health'); // success
  http.get('http://localhost:4000/not-found'); // failed 404
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed;
  console.log(`http_req_failed rate: ${failed.values.rate}`);
  console.log(`  passes (rate=true, req failed): ${failed.values.passes}`);
  console.log(`  fails (rate=false, req success): ${failed.values.fails}`);
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Expected: 5 failed (404), 5 success = rate 0.5`);
  return { 'stdout': '' };
}
