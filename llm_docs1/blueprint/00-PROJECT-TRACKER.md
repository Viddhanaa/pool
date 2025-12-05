# VIDDHANA POOL - LLM Agent Project Tracker

> **Purpose:** This document serves as the master tracker for LLM coding agents working on the VIDDHANA POOL project. Update checkboxes and status as tasks are completed.

---

## Quick Reference

| Document | Purpose | Priority |
|----------|---------|----------|
| [01-INFRASTRUCTURE.md](./01-INFRASTRUCTURE.md) | Backend, Stratum servers, Database | P0 - Critical |
| [02-FRONTEND.md](./02-FRONTEND.md) | Next.js UI, WebGL, Components | P0 - Critical |
| [03-AI-LAYER.md](./03-AI-LAYER.md) | Prometheus AI, ML Models | P1 - High |
| [04-BLOCKCHAIN.md](./04-BLOCKCHAIN.md) | Atlas Chain L3, Smart Contracts | P0 - Critical |
| [05-SECURITY.md](./05-SECURITY.md) | Auth, DDoS, Zero-Trust | P0 - Critical |
| [06-API-SPECIFICATION.md](./06-API-SPECIFICATION.md) | REST/WebSocket API Spec | P1 - High |

---

## Phase 1: MVP (Weeks 1-6)

### 1.1 Infrastructure Setup
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Setup monorepo structure (Turborepo/Nx) | - | 01-INFRASTRUCTURE | Create packages: api, web, stratum, shared |
| [ ] | Configure Docker development environment | - | 01-INFRASTRUCTURE | docker-compose for local dev |
| [ ] | Setup PostgreSQL + TimescaleDB | - | 01-INFRASTRUCTURE | For time-series hashrate data |
| [ ] | Setup Redis cluster | - | 01-INFRASTRUCTURE | For real-time share tracking |
| [ ] | Configure CI/CD pipeline | - | 01-INFRASTRUCTURE | GitHub Actions |

### 1.2 Stratum Server (Core Mining)
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Implement Stratum V1 protocol (Golang) | - | 01-INFRASTRUCTURE | Start with basic TCP handler |
| [ ] | Add share validation logic | - | 01-INFRASTRUCTURE | Verify PoW submissions |
| [ ] | Implement difficulty adjustment | - | 01-INFRASTRUCTURE | Per-worker vardiff |
| [ ] | Add worker authentication | - | 01-INFRASTRUCTURE | wallet.worker_name format |
| [ ] | Setup load balancer (HAProxy) | - | 01-INFRASTRUCTURE | SSL termination |
| [ ] | Implement connection pooling | - | 01-INFRASTRUCTURE | Handle 10k+ connections |

### 1.3 Backend API
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Setup Node.js/Fastify API server | - | 06-API-SPECIFICATION | REST + WebSocket |
| [ ] | Implement user registration/login | - | 05-SECURITY | Email + Web3 wallet |
| [ ] | Create worker stats endpoints | - | 06-API-SPECIFICATION | GET /api/workers |
| [ ] | Create payout endpoints | - | 06-API-SPECIFICATION | GET/POST /api/payouts |
| [ ] | Implement WebSocket real-time updates | - | 06-API-SPECIFICATION | Socket.io integration |
| [ ] | Add rate limiting middleware | - | 05-SECURITY | 100 req/min default |

### 1.4 Frontend (Guest Zone)
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Setup Next.js 14 project | - | 02-FRONTEND | App router, TypeScript |
| [ ] | Implement design system (Tailwind + CSS vars) | - | 02-FRONTEND | Dark theme, neon accents |
| [ ] | Create Home page with hero section | - | 02-FRONTEND | 3D globe placeholder |
| [ ] | Implement live stats ticker component | - | 02-FRONTEND | WebSocket integration |
| [ ] | Create Pools & Statistics page | - | 02-FRONTEND | Multi-coin grid view |
| [ ] | Create Blocks Explorer page | - | 02-FRONTEND | Real-time table |
| [ ] | Implement Leaderboard page | - | 02-FRONTEND | Sortable, filterable |
| [ ] | Create Support/Guides page | - | 02-FRONTEND | Stratum generator tool |

### 1.5 Blockchain Integration (Testnet)
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Deploy payout smart contract (testnet) | - | 04-BLOCKCHAIN | Solidity, batch payouts |
| [ ] | Implement payout queue processor | - | 04-BLOCKCHAIN | Background job |
| [ ] | Add transaction verification | - | 04-BLOCKCHAIN | Confirm on-chain |
| [ ] | Create wallet binding flow | - | 04-BLOCKCHAIN | MetaMask integration |

---

## Phase 2: Optimization (Weeks 7-10)

### 2.1 Frontend (User Zone)
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Create Miner Dashboard (HUD) | - | 02-FRONTEND | Real-time hashrate graph |
| [ ] | Implement Workers Management page | - | 02-FRONTEND | Status indicators, bulk actions |
| [ ] | Create Mining Statistics page | - | 02-FRONTEND | Share analysis, history |
| [ ] | Implement Payouts & Finance page | - | 02-FRONTEND | Transaction history |
| [ ] | Create Settings page | - | 02-FRONTEND | Profile, 2FA, API keys |
| [ ] | Implement Ticket Support system | - | 02-FRONTEND | Integrated helpdesk |

### 2.2 Prometheus AI Integration
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Setup ML pipeline infrastructure | - | 03-AI-LAYER | Python, TensorFlow/PyTorch |
| [ ] | Implement earnings prediction model | - | 03-AI-LAYER | LSTM for time-series |
| [ ] | Create difficulty prediction service | - | 03-AI-LAYER | Real-time API |
| [ ] | Build anomaly detection (Sentinel AI) | - | 03-AI-LAYER | For DDoS/hijacking |
| [ ] | Add "Prometheus Optimize" feature | - | 03-AI-LAYER | OC suggestions |

### 2.3 Advanced Security
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Implement 2FA (TOTP) | - | 05-SECURITY | Google Authenticator |
| [ ] | Add Circuit Breaker AI | - | 05-SECURITY | Freeze suspicious payouts |
| [ ] | Setup multi-sig for pool wallets | - | 05-SECURITY | Gnosis Safe |
| [ ] | Configure Cloudflare Enterprise | - | 05-SECURITY | DDoS protection |
| [ ] | Implement API key system | - | 05-SECURITY | Read/Write permissions |

---

## Phase 3: Expansion (Weeks 11-16)

### 3.1 DePIN Integration
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Design IoT oracle protocol | - | 04-BLOCKCHAIN | Proof of Physical Work |
| [ ] | Implement rig verification system | - | 04-BLOCKCHAIN | Physical presence check |
| [ ] | Create energy consumption tracking | - | 04-BLOCKCHAIN | Oracle integration |
| [ ] | Build License Management system | - | 02-FRONTEND + 04-BLOCKCHAIN | Tiered access |

### 3.2 SocialFi Features
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Implement reputation token system | - | 04-BLOCKCHAIN | NFT badges |
| [ ] | Create achievement/badge system | - | 02-FRONTEND | Gamification |
| [ ] | Build enhanced leaderboard | - | 02-FRONTEND | SocialFi integration |

### 3.3 Production Deployment
| Status | Task | Assignee | Doc Reference | Notes |
|--------|------|----------|---------------|-------|
| [ ] | Security audit (external) | - | 05-SECURITY | Smart contracts |
| [ ] | Performance load testing | - | 01-INFRASTRUCTURE | 100k+ concurrent |
| [ ] | Deploy to mainnet | - | 04-BLOCKCHAIN | Atlas Chain L3 |
| [ ] | Setup monitoring (Grafana/Prometheus) | - | 01-INFRASTRUCTURE | Alerting |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 1 (MVP)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Infrastructure│───▶│ Stratum      │───▶│ Backend API  │      │
│  │ Setup        │    │ Server       │    │              │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│         │                                        │              │
│         ▼                                        ▼              │
│  ┌──────────────┐                        ┌──────────────┐      │
│  │ Database     │                        │ Frontend     │      │
│  │ (Postgres+   │                        │ (Guest Zone) │      │
│  │  Redis)      │                        └──────────────┘      │
│  └──────────────┘                                              │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │ Blockchain   │                                              │
│  │ (Testnet)    │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 2 (Optimization)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ User Zone    │    │ Prometheus   │    │ Advanced     │      │
│  │ Frontend     │◀───│ AI           │    │ Security     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PHASE 3 (Expansion)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ DePIN        │    │ SocialFi     │    │ Production   │      │
│  │ Integration  │───▶│ Features     │───▶│ Deployment   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Completed |
| `[!]` | Blocked |
| `[-]` | Cancelled |

---

## Agent Instructions

### Before Starting a Task:
1. Read the relevant blueprint document thoroughly
2. Check dependencies in the tracker above
3. Update status to `[~]` and add your identifier to Assignee

### After Completing a Task:
1. Update status to `[x]`
2. Add any notes or follow-up items
3. If task spawns new tasks, add them to tracker

### If Blocked:
1. Update status to `[!]`
2. Document blocker in Notes column
3. Move to next unblocked task

---

## File Structure (Target)

```
viddhana-pool/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── models/
│   │   └── package.json
│   └── stratum/                # Golang stratum server
│       ├── cmd/
│       ├── internal/
│       └── go.mod
├── packages/
│   ├── shared/                 # Shared types/utilities
│   ├── contracts/              # Smart contracts
│   └── ai-models/              # Prometheus AI
├── infrastructure/
│   ├── docker/
│   ├── k8s/
│   └── terraform/
├── docs/
│   └── blueprint/              # These files
├── turbo.json
└── package.json
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Initial | Created from IDEA.md |
