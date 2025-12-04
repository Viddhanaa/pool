// Load Test Configuration
export const config = {
  // Backend URL
  baseURL: __ENV.BASE_URL || 'http://localhost:4000',
  
  // Test durations
  duration: {
    warmup: '30s',
    sustained: '5m',
    spike: '2m',
  },
  
  // Virtual users
  vus: {
    ping: 100,        // 100 concurrent miners
    api: 50,          // 50 concurrent users
    withdrawal: 20,   // 20 concurrent withdrawals
  },
  
  // Thresholds
  thresholds: {
    http_req_duration: ['p(95)<100'],   // 95% requests < 100ms
    http_req_failed: ['rate<0.01'],     // < 1% errors
    http_reqs: ['rate>100'],            // > 100 requests/sec
  },
  
  // Test wallet addresses (for testing)
  testWallets: [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555',
  ],
};

export function getRandomWallet() {
  return config.testWallets[Math.floor(Math.random() * config.testWallets.length)];
}

export function getRandomMinerID() {
  // Use test miners range (12-111)
  return Math.floor(Math.random() * 100) + 12;
}
