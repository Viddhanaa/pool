# VIDDHANA Pool Implementation Blueprint

## Scope
- Applies to DeFi / RWA / DePIN pools implemented in `contracts/pools/`, `contracts/rewards/`, `contracts/oracles/`, `contracts/risk/`.
- Use Solidity 0.8.x and prefer OpenZeppelin primitives over custom implementations.

## Architecture Overview
- `Pool` contracts hold accounting state (deposits, shares, pending rewards) but NOT arbitrary admin funds.
- `RewardDistributor` pulls data from mining/reward engine and allocates rewards per pool and per account.
- `Oracle` adapters fetch and normalize asset prices with sanity checks and staleness guards.
- `RiskEngine`/`CircuitBreaker` enforces global + pool-specific limits (TVL caps, max drawdown, oracle failure, pause).

## Asset Flow (Deposit / Withdraw)
- Deposit:
  - Validate asset/token and amount; reject zero or unsupported assets.
  - Pull tokens using `safeTransferFrom` and mint pool shares based on current exchange rate.
  - Update per-account and global accounting, emit `Deposit` and share-mint events.
- Withdraw:
  - Check user balance, cool-downs, and pending risk flags (pause, withdrawal caps).
  - Burn shares, compute underlying based on exchange rate, transfer out with `safeTransfer`.
  - Update accounting, emit `Withdraw` and share-burn events.

## Reward Model
- Rewards are computed off-chain / in backend, then committed on-chain via `RewardDistributor` (or similar) with:
  - Epoch-based snapshots (block or time-based) to prevent retroactive manipulation.
  - Per-pool reward weight configuration and per-miner or per-depositor shares.
- On-chain distribution MUST:
  - Use non-reentrant patterns (checks-effects-interactions, ReentrancyGuard).
  - Avoid unbounded loops over dynamic user sets; rely on indexing or pull-based claiming.

## Oracle Update Cycle
- Wrap external oracles (Chainlink or custom) in adapters that:
  - Check `updatedAt`/round freshness and reject stale data.
  - Enforce min/max price bounds when applicable; revert on out-of-range.
  - Normalize decimals for internal math; document assumptions.
- Circuit breaker logic MUST revert or switch to safe mode when:
  - Oracle fails, returns stale, or deviates beyond a configurable threshold.

## Risk Control & Circuit Breaker
- Implement pause/guardian roles (via `Pausable` / `AccessControl`) for:
  - Deposits, withdrawals, rewards, and parameter changes.
- Track and enforce:
  - Max pool TVL, per-user and per-day withdrawal caps.
  - Emergency withdrawal paths that bypass rewards but protect principal.
- All risk parameters must be stored on-chain, with events for config changes.

## Upgrade / Migration Path
- Prefer minimal proxy or upgradeable pattern only if necessary; document storage layout assumptions.
- Provide migration function(s) or script-level plan to move user balances from v1 -> v2 pools.
- Avoid breaking storage layout; if unavoidable, deploy a new pool and migrate via explicit opt-in.

## Testing Requirements
- Unit tests for:
  - Deposit/withdraw happy paths and edge cases.
  - Reward accrual math, rounding, and APY-derived behaviors.
  - Oracle adapters (stale data, bad prices, decimals).
  - RiskEngine and CircuitBreaker (TVL caps, emergency pause, re-open).
- Integration or property tests for:
  - Reentrancy attempts on deposit/withdraw and reward claims.
  - Adversarial price moves, delayed oracle updates.

## Implementation Notes for LLM Agents
- Never deploy or assume mainnet; treat all deployments as test/simulation.
- Prefer small, auditable changes over large refactors; explain invariants explicitly in comments.
- Before coding, restate the concrete pool requirements (asset type, reward source, lockup rules) in your own words in the PR/summary.
