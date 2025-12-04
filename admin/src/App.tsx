import { FormEvent, useEffect, useState } from 'react';
import {
  fetchAdminMetrics,
  fetchConfig,
  health as fetchHealth,
  listAdminWithdrawals,
  login,
  loadStoredToken,
  markWithdrawalFailed,
  retryWithdrawal,
  saveConfig,
  setToken as persistToken,
  ConfigKey,
  ConfigRow
} from './api';
import './styles.css';

type Metrics = {
  active_miners: number;
  pool_hashrate: number;
  pending_withdrawals: number;
  viddhana_distributed: { today: string; week: string; month: string };
};
type HealthState = { ok: boolean; postgres: { ok: boolean }; redis: { ok: boolean }; geth: { ok: boolean } };
type WithdrawalRow = {
  withdrawal_id: number;
  miner_id: number;
  amount: string;
  status: string;
  requested_at: string;
  tx_hash?: string | null;
  error_message?: string | null;
};

type ValidationResult = { value: number | null } | { error: string };

const CONFIG_FIELDS: Record<
  ConfigKey,
  { label: string; unit: string; min: number; max?: number; helper: string; placeholder: string; allowNull?: boolean }
> = {
  min_withdrawal_threshold: {
    label: 'Min withdrawal threshold',
    unit: 'VIDDHANA',
    min: 1,
    max: 1_000_000,
    helper: 'Minimum VIDDHANA required before a miner can request a withdrawal.',
    placeholder: '100'
  },
  reward_update_interval_minutes: {
    label: 'Reward update interval',
    unit: 'minutes',
    min: 1,
    max: 60,
    helper: 'How often rewards accrue and balances refresh.',
    placeholder: '5'
  },
  data_retention_days: {
    label: 'Data retention',
    unit: 'days',
    min: 1,
    max: 365,
    helper: 'Days to keep mining sessions before cleanup.',
    placeholder: '7'
  },
  ping_timeout_seconds: {
    label: 'Ping timeout',
    unit: 'seconds',
    min: 30,
    max: 600,
    helper: 'Mark miners offline if no ping within this window.',
    placeholder: '120'
  },
  daily_withdrawal_limit: {
    label: 'Daily withdrawal cap',
    unit: 'VIDDHANA/day',
    min: 0,
    max: 5_000_000,
    helper: '0 or blank disables the per-miner daily cap.',
    placeholder: '0',
    allowNull: true
  }
};

function App() {
  const [configRows, setConfigRows] = useState<ConfigRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [healthState, setHealthState] = useState<HealthState | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [message, setMessage] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [token, setTokenState] = useState<string | null>(() => loadStoredToken());
  const [form, setForm] = useState<{ key: ConfigKey; value: string }>({
    key: 'min_withdrawal_threshold',
    value: '100'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingOn, setActingOn] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      refreshAll();
    }
  }, [token]);

  const selectedField = CONFIG_FIELDS[form.key];

  function resetState() {
    setConfigRows([]);
    setMetrics(null);
    setHealthState(null);
    setWithdrawals([]);
  }

  function handleUnauthorized(msg: string) {
    if (msg.toLowerCase().includes('unauthorized')) {
      persistToken(null);
      setTokenState(null);
      setLoginError('Session expired. Please log in again.');
      resetState();
      return true;
    }
    return false;
  }

  async function refreshAll() {
    if (!token) return;
    setLoading(true);
    try {
      const [cfg, m, h, w] = await Promise.all([
        fetchConfig(),
        fetchAdminMetrics(),
        fetchHealth(),
        listAdminWithdrawals()
      ]);
      setConfigRows(cfg);
      setMetrics(m);
      setHealthState(h);
      setWithdrawals(w);
      setMessage('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!handleUnauthorized(msg)) setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  async function refreshWithdrawals() {
    try {
      const w = await listAdminWithdrawals();
      setWithdrawals(w);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!handleUnauthorized(msg)) setMessage(msg);
    }
  }

  function validateValue(): ValidationResult {
    if (selectedField.allowNull && (form.value === '' || form.value === null)) {
      return { value: null as number | null };
    }
    const num = Number(form.value);
    if (!Number.isFinite(num)) return { error: 'Value must be a number' };
    if (num < selectedField.min) return { error: `Must be >= ${selectedField.min} ${selectedField.unit}` };
    if (selectedField.max !== undefined && num > selectedField.max) {
      return { error: `Must be <= ${selectedField.max} ${selectedField.unit}` };
    }
    return { value: num };
  }

  async function handleSave() {
    const validation = validateValue();
    if ('error' in validation) {
      setMessage(validation.error || '');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await saveConfig(form.key, validation.value);
      setMessage('Saved');
      const cfg = await fetchConfig();
      setConfigRows(cfg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!handleUnauthorized(msg)) setMessage(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    try {
      const tok = await login(loginPassword);
      setTokenState(tok);
      setMessage('');
      setLoginPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg);
    }
  }

  function logout() {
    persistToken(null);
    setTokenState(null);
    resetState();
  }

  async function handleRetry(id: number) {
    setActingOn(id);
    setMessage('');
    try {
      await retryWithdrawal(id);
      await refreshWithdrawals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!handleUnauthorized(msg)) setMessage(msg);
    } finally {
      setActingOn(null);
    }
  }

  async function handleMarkFailed(id: number) {
    setActingOn(id);
    setMessage('');
    try {
      await markWithdrawalFailed(id, 'Manually marked failed');
      await refreshWithdrawals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!handleUnauthorized(msg)) setMessage(msg);
    } finally {
      setActingOn(null);
    }
  }

  const healthSummary = healthState
    ? `${healthState.ok ? 'Healthy' : 'Issues detected'} · PG ${healthState.postgres.ok ? 'ok' : 'down'} · Redis ${
        healthState.redis.ok ? 'ok' : 'down'
      } · Geth ${healthState.geth.ok ? 'ok' : 'down'}`
    : token
    ? 'Loading...'
    : 'Login required';

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">VIDDHANA Miner Admin</p>
          <h1>Control room</h1>
          <p className="muted">Manage payout thresholds, reward cadence and monitor health.</p>
        </div>
        <div className="header-actions">
          <div className={`status-pill ${healthState?.ok ? 'ok' : ''}`}>{healthSummary}</div>
          {token && (
            <button className="ghost" onClick={logout}>
              Logout
            </button>
          )}
        </div>
      </header>

      {loginError && <div className="message error">{loginError}</div>}
      {message && <div className="message">{message}</div>}

      {!token && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Access</p>
              <h3>Admin login</h3>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </label>
            <button type="submit">Login</button>
          </form>
          <p className="muted small">Use the admin password configured on the backend server.</p>
        </section>
      )}

      {token && (
        <>
          <section className="cards">
            <div className="card">
              <p className="eyebrow">Active miners</p>
              <h2>{metrics?.active_miners ?? '—'}</h2>
              <p className="muted small">online right now</p>
            </div>
            <div className="card">
              <p className="eyebrow">Pool hashrate</p>
              <h2>{metrics ? metrics.pool_hashrate.toLocaleString() : '—'} H/s</h2>
              <p className="muted small">current total</p>
            </div>
            <div className="card">
              <p className="eyebrow">Pending withdrawals</p>
              <h2>{metrics?.pending_withdrawals ?? '—'}</h2>
              <p className="muted small">awaiting processing</p>
            </div>
            <div className="card">
              <p className="eyebrow">VIDDHANA distributed</p>
              <h2>
                {metrics?.viddhana_distributed.today ?? '0'} <span className="muted small">today</span>
              </h2>
              <p className="muted small">
                Week {metrics?.viddhana_distributed.week ?? '0'} · Month {metrics?.viddhana_distributed.month ?? '0'}
              </p>
            </div>
            <div className="card">
              <p className="eyebrow">Service health</p>
              <h2 className={healthState?.ok ? '' : 'warn'}>
                {healthState ? (healthState.ok ? 'Healthy' : 'Attention needed') : '—'}
              </h2>
              <p className="muted small">
                PG {healthState?.postgres.ok ? 'ok' : 'down'} · Redis {healthState?.redis.ok ? 'ok' : 'down'} · Geth{' '}
                {healthState?.geth.ok ? 'ok' : 'down'}
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Configuration</p>
                <h3>Dynamic settings</h3>
              </div>
              <div className="panel-actions">
                <button className="ghost" onClick={refreshAll} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Key
                <select
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value as ConfigKey })}
                >
                  {Object.keys(CONFIG_FIELDS).map((k) => (
                    <option key={k} value={k}>
                      {CONFIG_FIELDS[k as ConfigKey].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Value
                <div className="unit-input">
                  <input
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder={selectedField.placeholder}
                  />
                  <span className="unit">{selectedField.unit}</span>
                </div>
                <p className="muted small">{selectedField.helper}</p>
              </label>
              <button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Current config</p>
                <h3>System config</h3>
              </div>
            </div>
            <div className="history-list">
              {configRows.length === 0 && <p className="muted">No config rows yet.</p>}
              {configRows.map((row) => {
                const field = CONFIG_FIELDS[row.config_key];
                const value =
                  row.config_value === null || row.config_value === undefined
                    ? 'Not set'
                    : `${row.config_value} ${field?.unit ?? ''}`.trim();
                return (
                  <div className="history-row" key={row.config_key}>
                    <div>
                      <strong>{field?.label ?? row.config_key}</strong>
                      <p className="muted small">{new Date(row.updated_at).toLocaleString()}</p>
                    </div>
                    <span className="pill">{value}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Withdrawals</p>
                <h3>Pending management</h3>
              </div>
              <button className="ghost" onClick={refreshWithdrawals}>
                Reload queue
              </button>
            </div>
            {withdrawals.length === 0 && <p className="muted">No pending or failed withdrawals.</p>}
            {withdrawals.length > 0 && (
              <div className="table">
                <div className="table-head">
                  <span>ID</span>
                  <span>Miner</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Last error</span>
                  <span>Actions</span>
                </div>
                {withdrawals.map((w) => (
                  <div className="table-row" key={w.withdrawal_id}>
                    <span className="muted">#{w.withdrawal_id}</span>
                    <span>{w.miner_id}</span>
                    <span>{w.amount}</span>
                    <span className={`pill ${w.status}`}>{w.status}</span>
                    <span className="muted small">{w.error_message ?? '—'}</span>
                    <span className="actions">
                      <button className="ghost" disabled={actingOn === w.withdrawal_id} onClick={() => handleRetry(w.withdrawal_id)}>
                        {actingOn === w.withdrawal_id ? 'Working...' : 'Retry'}
                      </button>
                      <button
                        className="ghost danger"
                        disabled={actingOn === w.withdrawal_id}
                        onClick={() => handleMarkFailed(w.withdrawal_id)}
                      >
                        Mark failed
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
