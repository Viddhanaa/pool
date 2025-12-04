import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

const mockFetch = vi.fn();

const responses: Record<string, any> = {
  '/api/admin/config': [{ config_key: 'min_withdrawal_threshold', config_value: 100, updated_at: '2024-01-01' }],
  '/api/miner/stats?minerId=1': {
    pending_balance: '200',
    total_earned: '500',
    active_minutes_today: 60,
    current_hashrate: 1200,
    pool_hashrate: 5000
  },
  '/api/miner/earnings-history?minerId=1': [
    { date: '2024-01-01', earned_amount: '10' },
    { date: '2024-01-02', earned_amount: '12' }
  ],
  '/api/miner/hashrate-history?minerId=1': [
    { timestamp: '10:00', hashrate: 1000 },
    { timestamp: '11:00', hashrate: 1200 }
  ],
  '/api/miner/active-history?minerId=1': [
    { date: '2024-01-01', minutes: 50 },
    { date: '2024-01-02', minutes: 60 }
  ],
  '/api/withdrawals?minerId=1&limit=10&offset=0': []
};

beforeEach(() => {
  mockFetch.mockImplementation((url: RequestInfo | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const key = urlStr.replace('http://localhost:4000', '').replace('http://backend:4000', '');
    let payload: any = null;
    for (const candidate of Object.keys(responses)) {
      if (key.startsWith(candidate)) {
        payload = responses[candidate];
        break;
      }
    }
    if (payload === null) {
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });
  globalThis.fetch = mockFetch as any;
});

describe('App', () => {
  test('renders dashboard header', () => {
    render(<App />);
    expect(screen.getByText(/Dashboard/i)).toBeTruthy();
  });

  test('renders charts with data and tooltips', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByText(/Earnings \(7d\)/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Hashrate \(24h\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Active time \(7d\)/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/No data/i)).toBeNull();
  });

  test('shows connection status controls', async () => {
    render(<App />);
    expect(screen.getByText(/Connection/i)).toBeTruthy();
    expect(screen.getByText(/Idle/i)).toBeTruthy();
    expect(screen.getByText(/Ping now/i)).toBeTruthy();
  });
});
