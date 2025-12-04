import { useEffect, useMemo, useState } from 'react';
import {
  fetchActiveHistory,
  fetchConfig,
  fetchEarningsHistory,
  fetchHashrateHistory,
  fetchMinerStats,
  fetchWithdrawals,
  requestWithdrawal,
  registerOpen,
  type ActivePoint,
  type ConfigRow,
  type EarningPoint,
  type HashratePoint,
  type MinerStats,
  type WithdrawalRow
} from './api';
import { useLocalState } from './hooks/useLocalState';
import { LineChart } from './components/LineChart';
import { BarChart } from './components/BarChart';
import { pingWithRetry, type ConnectionStatus } from './services/pingClient';
import { autoMiner, type MiningStatus } from './services/autoMiner';
import './styles.css';

const REFRESH_MS = Number(import.meta.env.VITE_REFRESH_MS ?? 20000);

function App() {
  const [minerId, setMinerId] = useLocalState<number>('miner-id', 1);
  const [stats, setStats] = useState<MinerStats | null>(null);
  const [earnings, setEarnings] = useState<EarningPoint[]>([]);
  const [hashrateHistory, setHashrateHistory] = useState<HashratePoint[]>([]);
  const [activeHistory, setActiveHistory] = useState<ActivePoint[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(100);
  const [message, setMessage] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(100);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [wallet, setWallet] = useState<string>('');
  const [openWallet, setOpenWallet] = useState<string>('');
  const [openHashrate, setOpenHashrate] = useState<number>(1000);
  const [openDeviceType, setOpenDeviceType] = useState<string>('web');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [miningStatus, setMiningStatus] = useState<MiningStatus>('stopped');
  const [miningStats, setMiningStats] = useState({ successCount: 0, failCount: 0 });

  const canWithdraw = useMemo(() => {
    if (!stats) return false;
    return Number(stats.pending_balance) >= threshold && withdrawAmount > 0;
  }, [stats, threshold, withdrawAmount]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [minerId, page]);

  useEffect(() => {
    // Update mining stats every second
    const interval = setInterval(() => {
      const status = autoMiner.getStatus();
      setMiningStatus(status.status);
      setMiningStats({ successCount: status.successCount, failCount: status.failCount });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadConfig() {
    try {
      const rows: ConfigRow[] = await fetchConfig();
      const row = rows.find((r) => r.config_key === 'min_withdrawal_threshold');
      if (row) setThreshold(Number((row as any).config_value) || threshold);
    } catch (err) {
      console.warn('Failed to load config', err);
    }
  }

  async function loadData() {
    if (!minerId) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const [s, e, h, a, w] = await Promise.all([
        fetchMinerStats(minerId),
        fetchEarningsHistory(minerId),
        fetchHashrateHistory(minerId),
        fetchActiveHistory(minerId),
        fetchWithdrawals(minerId, page)
      ]);
      setStats(s);
      setEarnings(e);
      setHashrateHistory(h);
      setActiveHistory(a);
      setWithdrawals(w);
    } catch (err) {
      const msg = String(err);
      setMessage(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!canWithdraw) return;
    try {
      setMessage('');
      const res = await requestWithdrawal(minerId, withdrawAmount);
      setMessage(`Withdrawal requested (#${res.withdrawalId})`);
      await loadData();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function handleWalletConnect() {
    setError('');
    const eth = (window as any).ethereum;
    if (!eth) {
      setError('No Web3 wallet detected');
      return;
    }
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = (accounts?.[0] as string | undefined) ?? '';
      if (!addr) throw new Error('No account selected');
      setWallet(addr);
      setMessage('Wallet connected');
    } catch (err) {
      setError(String(err));
    }
  }

  async function handlePingNow() {
    if (!minerId) {
      setError('Miner ID required to ping');
      return;
    }
    setConnectionStatus('reconnecting');
    setRetryCount(0);
    const result = await pingWithRetry(minerId, stats?.current_hashrate ?? 0);
    // result.attempt is number of tries (1, 2, 3), retries = attempts - 1
    const retries = result.attempt - 1;
    if (result.ok) {
      setConnectionStatus('connected');
      setRetryCount(retries);
      setMessage(`Ping successful${retries > 0 ? ` (${retries} ${retries === 1 ? 'retry' : 'retries'})` : ''}`);
    } else {
      setConnectionStatus('offline');
      setRetryCount(retries);
      setError(String(result.error ?? 'Ping failed'));
    }
  }

  async function handleRegisterOpen() {
    try {
      setError('');
      if (!openWallet || !Number.isFinite(openHashrate) || openHashrate <= 0) {
        throw new Error('Provide wallet and positive hashrate');
      }
      const { minerId } = await registerOpen(openWallet, openHashrate, openDeviceType || 'web');
      setMinerId(minerId);
      setWallet(openWallet);
      setMessage('Registered miner without signature.');
      await loadData();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleStartMining() {
    if (!minerId) {
      setError('Miner ID required to start mining');
      return;
    }
    autoMiner.start({
      minerId,
      hashrate: stats?.current_hashrate ?? 1000,
      deviceType: 'web',
      pingIntervalSeconds: 5,
    });
    setMessage('⛏️ Auto-mining started! Earning rewards every 5 seconds...');
  }

  function handleStopMining() {
    autoMiner.stop();
    setMessage('⏹️ Auto-mining stopped');
  }

  function handlePauseMining() {
    autoMiner.pause();
    setMessage('⏸️ Auto-mining paused');
  }

  function handleResumeMining() {
    autoMiner.resume();
    setMessage('▶️ Auto-mining resumed');
  }

  const earningPoints = earnings.map((row, idx) => ({ x: idx, y: Number(row.earned_amount), label: row.date }));
  const hashratePoints = hashrateHistory.map((row, idx) => ({ x: idx, y: Number(row.hashrate), label: row.timestamp }));
  const activePoints = activeHistory.map((row, idx) => ({ x: idx, y: row.minutes, label: row.date }));

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">VIDDHANA Miner</p>
          <h1>Dashboard</h1>
          <p className="sub">Realtime stats, history, and withdrawals.</p>
        </div>
        <div className="input-inline">
          <label>Miner ID</label>
          <input
            type="number"
            value={minerId}
            onChange={(e) => setMinerId(Number(e.target.value))}
            min={1}
          />
        </div>
        <div className="input-inline">
          <label>Wallet</label>
          {!wallet ? (
            <button className="ghost" onClick={handleWalletConnect}>Sign in with wallet</button>
          ) : (
            <p className="muted small">{wallet}</p>
          )}
        </div>
        <div className="input-inline">
          <label>Connection</label>
          <div className={`status ${connectionStatus}`}>
            {connectionStatus === 'connected' && `Connected${retryCount > 0 ? ` (${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})` : ''}`}
            {connectionStatus === 'reconnecting' && `Reconnecting...${retryCount > 0 ? ` (${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})` : ''}`}
            {connectionStatus === 'offline' && `Offline${retryCount > 0 ? ` (failed after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})` : ''}`}
            {connectionStatus === 'idle' && 'Idle'}
          </div>
          <button className="ghost" onClick={handlePingNow}>Ping now</button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Quick Start</p>
            <h3>Register without wallet signature</h3>
            <p className="muted">Enter any wallet to start mining instantly</p>
          </div>
        </div>
        <div className="grid">
          <div className="input-inline">
            <label>Wallet address</label>
            <input
              type="text"
              value={openWallet}
              onChange={(e) => setOpenWallet(e.target.value.trim())}
              placeholder="0x..."
            />
          </div>
          <div className="input-inline">
            <label>Initial hashrate (H/s)</label>
            <input
              type="number"
              min={1}
              value={openHashrate}
              onChange={(e) => setOpenHashrate(Number(e.target.value))}
            />
          </div>
          <div className="input-inline">
            <label>Device type</label>
            <input
              type="text"
              value={openDeviceType}
              onChange={(e) => setOpenDeviceType(e.target.value)}
              placeholder="web"
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button onClick={handleRegisterOpen}>Register Miner</button>
          </div>
        </div>
      </section>

      <section className="panel mining-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Auto Mining</p>
            <h3>Start Earning VIDDHANA</h3>
            <p className="muted">Auto-ping every 5 seconds to earn rewards</p>
          </div>
          <div className={`status ${miningStatus}`}>
            {miningStatus === 'stopped' && '⏹️ Stopped'}
            {miningStatus === 'mining' && '⛏️ Mining'}
            {miningStatus === 'paused' && '⏸️ Paused'}
            {miningStatus === 'error' && '❌ Error'}
          </div>
        </div>
        <div className="mining-controls">
          {miningStatus === 'stopped' && (
            <button onClick={handleStartMining} className="primary">Start Mining</button>
          )}
          {miningStatus === 'mining' && (
            <>
              <button onClick={handlePauseMining} className="ghost">Pause</button>
              <button onClick={handleStopMining} className="ghost">Stop</button>
            </>
          )}
          {miningStatus === 'paused' && (
            <>
              <button onClick={handleResumeMining} className="primary">Resume</button>
              <button onClick={handleStopMining} className="ghost">Stop</button>
            </>
          )}
          {miningStatus === 'error' && (
            <button onClick={handleStartMining} className="primary">Retry Mining</button>
          )}
        </div>
        <div className="mining-stats">
          <div className="stat-item">
            <span className="label">Successful Pings:</span>
            <span className="value">{miningStats.successCount}</span>
          </div>
          <div className="stat-item">
            <span className="label">Failed Pings:</span>
            <span className="value">{miningStats.failCount}</span>
          </div>
          <div className="stat-item">
            <span className="label">Success Rate:</span>
            <span className="value">
              {miningStats.successCount + miningStats.failCount > 0
                ? `${((miningStats.successCount / (miningStats.successCount + miningStats.failCount)) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
        </div>
      </section>

      {message && <div className="message">{message}</div>}
      {loading && <div className="message muted spinner">Loading...</div>}

      {stats && (
        <section className="grid">
          <StatCard title="Pending balance" value={`${Number(stats.pending_balance).toFixed(4)} VIDDHANA`} accent="primary" />
          <StatCard title="Total earned" value={`${Number(stats.total_earned).toFixed(4)} VIDDHANA`} />
          <StatCard title="Active minutes today" value={`${stats.active_minutes_today} min`} />
          <StatCard title="Hashrate" value={`${stats.current_hashrate} H/s`} detail={`Pool: ${stats.pool_hashrate} H/s`} />
        </section>
      )}

      <section className="panel charts">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Analytics</p>
            <h3>History</h3>
          </div>
          {error && <span className="pill error">Error loading data</span>}
        </div>
        <div className="charts-grid">
          <ChartCard title="Earnings (7d)" subtitle="VIDDHANA earned per day" empty={earningPoints.length === 0}>
            <LineChart points={earningPoints} />
          </ChartCard>
          <ChartCard title="Hashrate (24h)" subtitle="Snapshots per hour" empty={hashratePoints.length === 0}>
            <LineChart points={hashratePoints} />
          </ChartCard>
          <ChartCard title="Active time (7d)" subtitle="Minutes per day" empty={activePoints.length === 0}>
            <BarChart points={activePoints} />
          </ChartCard>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Balance</p>
            <h3>Request withdrawal</h3>
            <p className="muted">Threshold: {threshold} VIDDHANA</p>
          </div>
          <button className="ghost" onClick={loadData}>Refresh</button>
        </div>
        <div className="withdraw-form">
          <input
            type="number"
            value={withdrawAmount}
            min={0}
            onChange={(e) => setWithdrawAmount(Number(e.target.value))}
          />
          <button onClick={handleWithdraw} disabled={!canWithdraw} title={!canWithdraw ? 'Below threshold or missing amount' : ''}>
            Withdraw
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">History</p>
            <h3>Withdrawals</h3>
          </div>
          <div className="pagination">
            <button className="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Prev
            </button>
            <span className="muted">Page {page + 1}</span>
            <button className="ghost" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Tx</span>
          </div>
          {withdrawals.length === 0 && <p className="muted">No withdrawals yet.</p>}
          {withdrawals.map((row) => (
            <div className="table-row" key={row.withdrawal_id}>
              <span>{new Date(row.requested_at).toLocaleString()}</span>
              <span>{Number(row.amount).toFixed(4)} VIDDHANA</span>
              <span className={`pill ${row.status}`}>{row.status}</span>
              <span>{row.tx_hash ? <a href={`https://explorer.local/tx/${row.tx_hash}`} target="_blank" rel="noreferrer">{row.tx_hash.slice(0, 10)}...</a> : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Charts</p>
            <h3>Performance</h3>
          </div>
        </div>
        <div className="chart-grid">
          <div>
            <p className="muted">Earnings (7d)</p>
            <LineChart points={earningPoints} />
          </div>
          <div>
            <p className="muted">Active minutes (7d)</p>
            <LineChart points={activePoints} />
          </div>
          <div>
            <p className="muted">Hashrate (24h)</p>
            <LineChart points={hashratePoints} />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, detail, accent }: { title: string; value: string; detail?: string; accent?: 'primary' }) {
  return (
    <div className={`card ${accent === 'primary' ? 'card-primary' : ''}`}>
      <p className="eyebrow">{title}</p>
      <h2>{value}</h2>
      {detail && <p className="muted">{detail}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  empty,
  children
}: {
  title: string;
  subtitle?: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <p className="eyebrow">{title}</p>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {empty && <span className="pill muted">No data</span>}
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}

export default App;
