import { RpcMethod, ProgrammingLanguage } from './types';

export const APP_NAME = "VIDDHANA RPC API Documentation";

export const SUPPORTED_LANGUAGES = [
  ProgrammingLanguage.JavaScript,
  ProgrammingLanguage.Python,
  ProgrammingLanguage.Go,
  ProgrammingLanguage.Curl,
];

// VIDDHANA Blockchain RPC Schema Data
export const RPC_METHODS: RpcMethod[] = [
  // ==================== KYC APIs ====================
  {
    name: "kyc.getStatus",
    category: "KYC",
    summary: "Get KYC status for an address",
    description: "Retrieves the Know Your Customer (KYC) verification status for a specific wallet address. Returns KYC level, provider, and metadata.",
    params: [
      { name: "address", type: "string", required: true, description: "The wallet address (0x prefixed, 40 hex chars)" }
    ],
    result: {
      type: "KycRecord",
      description: "KYC status record.",
      schema: {
        address: "string",
        kyc: "boolean",
        provider: "string",
        level: "string",
        meta: "object",
        updatedAt: "iso-date"
      }
    },
    errors: [
      { code: 400, message: "Invalid address", description: "The address format is invalid." }
    ],
    examples: [
      {
        name: "Check KYC Status",
        params: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
        result: { 
          address: "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
          kyc: true,
          provider: "veriff",
          level: "basic",
          meta: {},
          updatedAt: "2024-01-15T10:30:00Z"
        }
      }
    ]
  },
  {
    name: "kyc.setStatus",
    category: "KYC",
    summary: "Update KYC status for an address",
    description: "Sets or updates the KYC verification status for a wallet address. Allows specifying provider, level, and custom metadata.",
    params: [
      { name: "address", type: "string", required: true, description: "The wallet address (0x prefixed)" },
      { name: "kyc", type: "boolean", required: false, description: "KYC verification status (default: true)" },
      { name: "provider", type: "string", required: false, description: "KYC provider name (e.g., 'veriff', 'onfido')" },
      { name: "level", type: "string", required: false, description: "KYC level (e.g., 'basic', 'advanced', 'premium')" },
      { name: "meta", type: "object", required: false, description: "Additional metadata" }
    ],
    result: {
      type: "KycRecord",
      description: "Updated KYC record.",
      schema: {
        address: "string",
        kyc: "boolean",
        provider: "string",
        level: "string",
        meta: "object",
        updatedAt: "iso-date"
      }
    },
    errors: [
      { code: 400, message: "Invalid address", description: "The address format is invalid or missing." }
    ],
    examples: [
      {
        name: "Set KYC Verified",
        params: { 
          address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          kyc: true,
          provider: "veriff",
          level: "advanced"
        },
        result: { 
          address: "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
          kyc: true,
          provider: "veriff",
          level: "advanced",
          meta: {},
          updatedAt: "2024-01-15T10:35:00Z"
        }
      }
    ]
  },

  // ==================== Pool APIs ====================
  {
    name: "pool.getInfo",
    category: "Pool",
    summary: "Get pool information and statistics",
    description: "Retrieves comprehensive information about a specific pool including TVL, APY, reward rates, and operational status.",
    params: [
      { name: "poolId", type: "string", required: false, description: "Pool identifier (default: 'btcd-main-pool')" }
    ],
    result: {
      type: "PoolInfo",
      description: "Pool information and statistics.",
      schema: {
        poolId: "string",
        asset: "string",
        totalDeposited: "string",
        totalRewardsPaid: "string",
        currentAPY: "string",
        rewardRate: "string",
        paused: "boolean",
        participantCount: "number"
      }
    },
    errors: [
      { code: 400, message: "Invalid pool ID", description: "Pool ID format is invalid." },
      { code: 404, message: "Pool not found", description: "No pool exists with the provided ID." }
    ],
    examples: [
      {
        name: "Get Main Pool Info",
        params: { poolId: "btcd-main-pool" },
        result: {
          poolId: "btcd-main-pool",
          asset: "BTCD",
          totalDeposited: "1000000000000000000000",
          totalRewardsPaid: "50000000000000000000",
          currentAPY: "12.5",
          rewardRate: "100000000000000000",
          paused: false,
          participantCount: 42
        }
      }
    ]
  },
  {
    name: "pool.getUserBalance",
    category: "Pool",
    summary: "Get user's pool balance and rewards",
    description: "Retrieves the user's deposit balance, claimable rewards, and position details for a specific pool.",
    params: [
      { name: "address", type: "string", required: true, description: "User's wallet address" },
      { name: "poolId", type: "string", required: false, description: "Pool identifier (default: 'btcd-main-pool')" }
    ],
    result: {
      type: "UserBalance",
      description: "User's pool balance and rewards.",
      schema: {
        address: "string",
        poolId: "string",
        deposited: "string",
        claimableRewards: "string",
        totalRewardsClaimed: "string",
        lastDepositAt: "iso-date"
      }
    },
    errors: [
      { code: 400, message: "Invalid address", description: "Address format is invalid." },
      { code: 404, message: "User not found", description: "User has no position in this pool." }
    ],
    examples: [
      {
        name: "Get User Balance",
        params: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
        result: {
          address: "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
          poolId: "btcd-main-pool",
          deposited: "100000000000000000000",
          claimableRewards: "5000000000000000000",
          totalRewardsClaimed: "10000000000000000000",
          lastDepositAt: "2024-01-10T08:00:00Z"
        }
      }
    ]
  },
  {
    name: "pool.deposit",
    category: "Pool",
    summary: "Deposit assets into pool",
    description: "Deposits assets into a pool position. Requires signature authentication for security.",
    params: [
      { name: "address", type: "string", required: true, description: "User's wallet address" },
      { name: "poolId", type: "string", required: false, description: "Pool identifier (default: 'btcd-main-pool')" },
      { name: "amount", type: "string", required: true, description: "Amount to deposit (in wei)" },
      { name: "signature", type: "string", required: true, description: "Signed message for authentication" },
      { name: "timestamp", type: "number", required: true, description: "Unix timestamp (must be within 30s)" },
      { name: "nonce", type: "string", required: true, description: "Unique nonce for replay protection" }
    ],
    result: {
      type: "DepositResponse",
      description: "Deposit confirmation.",
      schema: {
        success: "boolean",
        txHash: "string",
        newBalance: "string"
      }
    },
    errors: [
      { code: 400, message: "Invalid parameters", description: "One or more parameters are invalid." },
      { code: 401, message: "Authentication failed", description: "Signature verification failed or request expired." }
    ],
    examples: [
      {
        name: "Deposit 100 BTCD",
        params: {
          address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          amount: "100000000000000000000",
          signature: "0x...",
          timestamp: 1705315200000,
          nonce: "abc123"
        },
        result: {
          success: true,
          txHash: "0xdef456...",
          newBalance: "200000000000000000000"
        }
      }
    ]
  },
  {
    name: "pool.withdraw",
    category: "Pool",
    summary: "Withdraw assets from pool",
    description: "Withdraws assets from a pool position. Requires signature authentication. May have withdrawal delays or fees.",
    params: [
      { name: "address", type: "string", required: true, description: "User's wallet address" },
      { name: "poolId", type: "string", required: false, description: "Pool identifier" },
      { name: "amount", type: "string", required: true, description: "Amount to withdraw (in wei)" },
      { name: "signature", type: "string", required: true, description: "Signed message for authentication" },
      { name: "timestamp", type: "number", required: true, description: "Unix timestamp" },
      { name: "nonce", type: "string", required: true, description: "Unique nonce" }
    ],
    result: {
      type: "WithdrawResponse",
      description: "Withdrawal confirmation.",
      schema: {
        success: "boolean",
        withdrawalId: "string",
        estimatedCompletion: "iso-date"
      }
    }
  },
  {
    name: "pool.getRewards",
    category: "Pool",
    summary: "Get user's reward history",
    description: "Retrieves the complete reward history for a user across all pools or a specific pool.",
    params: [
      { name: "address", type: "string", required: true, description: "User's wallet address" },
      { name: "poolId", type: "string", required: false, description: "Optional pool filter" }
    ],
    result: {
      type: "RewardsHistory",
      description: "Reward history records.",
      schema: {
        rewards: "array",
        totalRewards: "string"
      }
    }
  },

  // ==================== Miner APIs ====================
  {
    name: "miner.register",
    category: "Miner",
    summary: "Register a new miner",
    description: "Registers a new miner with wallet address, device info, and initial hashrate. Returns a unique miner ID.",
    params: [
      { name: "wallet_address", type: "string", required: true, description: "Miner's wallet address" },
      { name: "miner_type", type: "string", required: false, description: "Type of miner (e.g., 'GPU', 'CPU', 'ASIC')" },
      { name: "device_info", type: "object", required: false, description: "Device information (GPU model, CPU, RAM, etc.)" },
      { name: "hashrate", type: "number", required: false, description: "Initial hashrate (default: 0)" }
    ],
    result: {
      type: "MinerRegistration",
      description: "Miner registration result.",
      schema: {
        minerId: "number"
      }
    },
    errors: [
      { code: 400, message: "Invalid parameters", description: "wallet_address is required." }
    ],
    examples: [
      {
        name: "Register GPU Miner",
        params: {
          wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          miner_type: "GPU",
          device_info: { gpu: "RTX 4090", ram: "32GB" },
          hashrate: 120000000
        },
        result: { minerId: 12345 }
      }
    ]
  },
  {
    name: "miner.heartbeat",
    category: "Miner",
    summary: "Send miner heartbeat",
    description: "Records a heartbeat from an active miner with optional metrics. Used to track miner status and uptime.",
    params: [
      { name: "miner_id", type: "number", required: true, description: "The miner's unique ID" },
      { name: "metrics", type: "object", required: false, description: "Optional performance metrics (hashrate, temp, power, etc.)" }
    ],
    result: {
      type: "HeartbeatResponse",
      description: "Heartbeat acknowledgment.",
      schema: {
        ok: "boolean"
      }
    },
    errors: [
      { code: 400, message: "Invalid miner_id", description: "miner_id is required." }
    ],
    examples: [
      {
        name: "Send Heartbeat with Metrics",
        params: {
          miner_id: 12345,
          metrics: {
            hashrate: 125000000,
            temperature: 68,
            power: 350
          }
        },
        result: { ok: true }
      }
    ]
  },
  {
    name: "miner.getTasks",
    category: "Miner",
    summary: "Get available mining tasks",
    description: "Retrieves a list of available tasks for miners to process. Returns sample tasks with difficulty and reward info.",
    params: [
      { name: "limit", type: "number", required: false, description: "Maximum number of tasks to return (default: 5)" }
    ],
    result: {
      type: "TaskList",
      description: "List of available tasks.",
      schema: {
        tasks: "array"
      }
    },
    examples: [
      {
        name: "Get 3 Tasks",
        params: { limit: 3 },
        result: {
          tasks: [
            { taskId: "task_001", difficulty: 5, reward: "1000000000000000000" },
            { taskId: "task_002", difficulty: 8, reward: "2000000000000000000" }
          ]
        }
      }
    ]
  },
  {
    name: "miner.submitTask",
    category: "Miner",
    summary: "Submit completed task result",
    description: "Submits the result of a completed mining task. Includes optional signature for verification.",
    params: [
      { name: "miner_id", type: "number", required: true, description: "The miner's unique ID" },
      { name: "task_id", type: "string", required: true, description: "The task ID" },
      { name: "result", type: "object", required: false, description: "Task computation result" },
      { name: "signature", type: "string", required: false, description: "Optional signature for verification" },
      { name: "timestamp", type: "number", required: false, description: "Submission timestamp" }
    ],
    result: {
      type: "TaskSubmission",
      description: "Task submission confirmation.",
      schema: {
        stored: "boolean",
        entry: "object"
      }
    },
    errors: [
      { code: 400, message: "Invalid parameters", description: "miner_id and task_id are required." }
    ]
  },

  // ==================== Withdrawal APIs ====================
  {
    name: "withdraw.request",
    category: "Withdrawal",
    summary: "Request a withdrawal",
    description: "Requests a withdrawal of mining rewards. Requires shared secret authentication and supports idempotency.",
    params: [
      { name: "minerId", type: "number", required: true, description: "The miner's unique ID" },
      { name: "amount", type: "number", required: true, description: "Amount to withdraw (in smallest unit)" },
      { name: "idempotency-key", type: "string", required: false, description: "Header: unique key to prevent duplicate withdrawals" },
      { name: "x-withdraw-secret", type: "string", required: false, description: "Header: shared secret for authorization" }
    ],
    result: {
      type: "WithdrawalRequest",
      description: "Withdrawal request confirmation.",
      schema: {
        withdrawalId: "number"
      }
    },
    errors: [
      { code: 400, message: "Invalid parameters", description: "minerId and amount are required." },
      { code: 401, message: "Unauthorized", description: "Invalid or missing withdrawal secret." }
    ],
    examples: [
      {
        name: "Request Withdrawal",
        params: {
          minerId: 12345,
          amount: 50000000000000000000
        },
        result: { withdrawalId: 789 }
      }
    ]
  },
  {
    name: "withdraw.list",
    category: "Withdrawal",
    summary: "List withdrawal history",
    description: "Retrieves the withdrawal history for a specific miner with pagination support.",
    params: [
      { name: "minerId", type: "number", required: true, description: "The miner's unique ID" },
      { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
      { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" }
    ],
    result: {
      type: "WithdrawalList",
      description: "List of withdrawals.",
      schema: {
        withdrawals: "array"
      }
    },
    errors: [
      { code: 400, message: "Invalid minerId", description: "minerId is required." }
    ],
    examples: [
      {
        name: "Get Recent Withdrawals",
        params: { minerId: 12345, limit: 10 },
        result: {
          withdrawals: [
            {
              id: 789,
              minerId: 12345,
              amount: 50000000000000000000,
              status: "completed",
              createdAt: "2024-01-15T10:00:00Z"
            }
          ]
        }
      }
    ]
  },

  // ==================== Ping & Hashrate APIs ====================
  {
    name: "ping.submit",
    category: "Network",
    summary: "Submit miner ping",
    description: "Records a ping from a miner to track connectivity and status. Rate limited to prevent abuse.",
    params: [
      { name: "minerId", type: "number", required: true, description: "The miner's unique ID" }
    ],
    result: {
      type: "PingResponse",
      description: "Ping acknowledgment.",
      schema: {
        ok: "boolean"
      }
    },
    errors: [
      { code: 400, message: "Invalid minerId", description: "minerId is required." },
      { code: 429, message: "Rate limit exceeded", description: "Too many pings in short time." },
      { code: 404, message: "Miner not found", description: "No miner found with this ID." }
    ],
    examples: [
      {
        name: "Send Ping",
        params: { minerId: 12345 },
        result: { ok: true }
      }
    ]
  },
  {
    name: "hashrate.submit",
    category: "Network",
    summary: "Submit hashrate data",
    description: "Submits hashrate statistics for a miner. Used for pool statistics and reward calculations.",
    params: [
      { name: "minerId", type: "number", required: true, description: "The miner's unique ID" },
      { name: "hashrate", type: "number", required: true, description: "Current hashrate (hashes per second)" },
      { name: "timestamp", type: "number", required: false, description: "Timestamp of measurement" }
    ],
    result: {
      type: "HashrateResponse",
      description: "Hashrate submission confirmation.",
      schema: {
        ok: "boolean"
      }
    }
  },

  // ==================== Stats APIs ====================
  {
    name: "stats.getMinerStats",
    category: "Statistics",
    summary: "Get miner statistics",
    description: "Retrieves comprehensive statistics for miners including active count, total hashrate, and earnings.",
    params: [],
    result: {
      type: "MinerStats",
      description: "Miner statistics.",
      schema: {
        totalMiners: "number",
        activeMiners: "number",
        totalHashrate: "number",
        totalEarnings: "string"
      }
    },
    examples: [
      {
        name: "Get Stats",
        params: {},
        result: {
          totalMiners: 1250,
          activeMiners: 987,
          totalHashrate: 1500000000000,
          totalEarnings: "50000000000000000000000"
        }
      }
    ]
  },
  {
    name: "stats.getEarningsHistory",
    category: "Statistics",
    summary: "Get earnings history",
    description: "Retrieves historical earnings data for charting and analysis. Cached for 5 minutes.",
    params: [],
    result: {
      type: "EarningsHistory",
      description: "Historical earnings data.",
      schema: {
        history: "array"
      }
    }
  },
  {
    name: "stats.getHashrateHistory",
    category: "Statistics",
    summary: "Get hashrate history",
    description: "Retrieves historical hashrate data over time. Cached for 2 minutes.",
    params: [],
    result: {
      type: "HashrateHistory",
      description: "Historical hashrate data.",
      schema: {
        history: "array"
      }
    }
  },
  {
    name: "stats.getActiveHistory",
    category: "Statistics",
    summary: "Get active miners history",
    description: "Retrieves historical data on active miner counts. Cached for 2 minutes.",
    params: [],
    result: {
      type: "ActiveHistory",
      description: "Historical active miner data.",
      schema: {
        history: "array"
      }
    }
  }
];
