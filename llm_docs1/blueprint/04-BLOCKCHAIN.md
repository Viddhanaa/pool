# VIDDHANA POOL - Blockchain Integration Guide (Atlas Chain L3)

> **Document ID:** 04-BLOCKCHAIN  
> **Priority:** P0 - Critical  
> **Dependencies:** 01-INFRASTRUCTURE

---

## Table of Contents
1. [Overview](#1-overview)
2. [Atlas Chain L3 Architecture](#2-atlas-chain-l3-architecture)
3. [Smart Contract Implementation](#3-smart-contract-implementation)
4. [Payout System](#4-payout-system)
5. [Wallet Integration](#5-wallet-integration)
6. [DePIN Integration](#6-depin-integration)
7. [License NFT System](#7-license-nft-system)
8. [Testing & Deployment](#8-testing--deployment)

---

## 1. Overview

VIDDHANA POOL leverages **Atlas Chain (Layer 3)** for:
- **Micro-payouts**: Near-zero fees ($0.001) with <1s settlement
- **Proof of Physical Work**: IoT oracle verification for DePIN
- **License Management**: NFT-based access tiers
- **Multi-sig Security**: Pool fund protection

---

## 2. Atlas Chain L3 Architecture

### 2.1 Network Configuration

```typescript
// packages/shared/src/config/chains.ts

export const atlasChainL3 = {
  id: 78432,  // Example chain ID
  name: 'Atlas Chain L3',
  network: 'atlas-l3',
  nativeCurrency: {
    decimals: 18,
    name: 'Atlas',
    symbol: 'ATL',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.atlas-l3.viddhana.io'],
      webSocket: ['wss://ws.atlas-l3.viddhana.io'],
    },
    public: {
      http: ['https://rpc.atlas-l3.viddhana.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Atlas Explorer',
      url: 'https://explorer.atlas-l3.viddhana.io',
    },
  },
  contracts: {
    payoutManager: {
      address: '0x...',
    },
    licenseNFT: {
      address: '0x...',
    },
    dePINOracle: {
      address: '0x...',
    },
  },
  testnet: {
    id: 78433,
    rpcUrls: {
      default: {
        http: ['https://testnet-rpc.atlas-l3.viddhana.io'],
      },
    },
  },
} as const;
```

### 2.2 Network Specifications

| Property | Value |
|----------|-------|
| Consensus | Optimistic Rollup (L3 on L2) |
| Block Time | ~500ms |
| Finality | ~1 second (soft), ~7 days (L1 finality) |
| Gas Token | ATL |
| Avg Tx Fee | $0.001 |
| TPS | 2000+ |

---

## 3. Smart Contract Implementation

### 3.1 Project Structure

```
packages/contracts/
├── contracts/
│   ├── PayoutManager.sol       # Main payout contract
│   ├── BatchPayout.sol         # Batch processing
│   ├── LicenseNFT.sol          # Tiered licenses
│   ├── DePINOracle.sol         # IoT verification
│   ├── MultiSigWallet.sol      # Fund security
│   └── interfaces/
│       ├── IPayoutManager.sol
│       ├── ILicenseNFT.sol
│       └── IDePINOracle.sol
├── scripts/
│   ├── deploy.ts
│   ├── upgrade.ts
│   └── verify.ts
├── test/
│   ├── PayoutManager.test.ts
│   ├── LicenseNFT.test.ts
│   └── integration.test.ts
├── hardhat.config.ts
└── package.json
```

### 3.2 Payout Manager Contract

**File: `contracts/PayoutManager.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PayoutManager
 * @notice Handles mining pool payouts on Atlas Chain L3
 * @dev Implements batch payouts, minimum thresholds, and circuit breaker
 */
contract PayoutManager is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant CIRCUIT_BREAKER_ROLE = keccak256("CIRCUIT_BREAKER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // State
    uint256 public minPayoutAmount;
    uint256 public maxPayoutPerBatch;
    uint256 public dailyPayoutLimit;
    uint256 public dailyPayoutTotal;
    uint256 public lastResetTimestamp;
    
    // Circuit breaker
    bool public circuitBreakerActive;
    uint256 public circuitBreakerCooldown;
    
    // Payout tracking
    mapping(address => uint256) public pendingPayouts;
    mapping(address => uint256) public totalPaidOut;
    mapping(bytes32 => bool) public processedPayoutIds;
    
    // Events
    event PayoutQueued(address indexed miner, uint256 amount, bytes32 payoutId);
    event PayoutProcessed(address indexed miner, uint256 amount, bytes32 payoutId);
    event BatchPayoutProcessed(uint256 count, uint256 totalAmount);
    event CircuitBreakerTriggered(address indexed triggeredBy, string reason);
    event CircuitBreakerReset(address indexed resetBy);
    event MinPayoutUpdated(uint256 oldAmount, uint256 newAmount);
    
    // Errors
    error PayoutBelowMinimum(uint256 amount, uint256 minimum);
    error DailyLimitExceeded(uint256 requested, uint256 remaining);
    error CircuitBreakerActive();
    error PayoutAlreadyProcessed(bytes32 payoutId);
    error InvalidPayoutData();
    error InsufficientPoolBalance();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        uint256 _minPayoutAmount,
        uint256 _dailyPayoutLimit
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(CIRCUIT_BREAKER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        minPayoutAmount = _minPayoutAmount;
        dailyPayoutLimit = _dailyPayoutLimit;
        maxPayoutPerBatch = 100;
        circuitBreakerCooldown = 1 hours;
        lastResetTimestamp = block.timestamp;
    }

    /**
     * @notice Queue a payout for a miner
     * @param miner Address of the miner
     * @param amount Amount to pay out
     * @param payoutId Unique identifier for this payout
     */
    function queuePayout(
        address miner,
        uint256 amount,
        bytes32 payoutId
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (circuitBreakerActive) revert CircuitBreakerActive();
        if (amount < minPayoutAmount) revert PayoutBelowMinimum(amount, minPayoutAmount);
        if (processedPayoutIds[payoutId]) revert PayoutAlreadyProcessed(payoutId);
        
        pendingPayouts[miner] += amount;
        
        emit PayoutQueued(miner, amount, payoutId);
    }

    /**
     * @notice Process a single payout
     * @param miner Address of the miner
     * @param amount Amount to pay
     * @param payoutId Unique payout identifier
     */
    function processPayout(
        address miner,
        uint256 amount,
        bytes32 payoutId
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        _processSinglePayout(miner, amount, payoutId);
    }

    /**
     * @notice Process multiple payouts in a single transaction
     * @param miners Array of miner addresses
     * @param amounts Array of payout amounts
     * @param payoutIds Array of payout identifiers
     */
    function processBatchPayout(
        address[] calldata miners,
        uint256[] calldata amounts,
        bytes32[] calldata payoutIds
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        if (circuitBreakerActive) revert CircuitBreakerActive();
        if (miners.length != amounts.length || miners.length != payoutIds.length) {
            revert InvalidPayoutData();
        }
        if (miners.length > maxPayoutPerBatch) {
            revert InvalidPayoutData();
        }

        _resetDailyLimitIfNeeded();

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        if (dailyPayoutTotal + totalAmount > dailyPayoutLimit) {
            revert DailyLimitExceeded(totalAmount, dailyPayoutLimit - dailyPayoutTotal);
        }

        if (address(this).balance < totalAmount) {
            revert InsufficientPoolBalance();
        }

        for (uint256 i = 0; i < miners.length; i++) {
            _processSinglePayout(miners[i], amounts[i], payoutIds[i]);
        }

        emit BatchPayoutProcessed(miners.length, totalAmount);
    }

    /**
     * @notice Trigger circuit breaker to halt payouts
     * @param reason Reason for triggering
     */
    function triggerCircuitBreaker(string calldata reason) 
        external 
        onlyRole(CIRCUIT_BREAKER_ROLE) 
    {
        circuitBreakerActive = true;
        emit CircuitBreakerTriggered(msg.sender, reason);
    }

    /**
     * @notice Reset circuit breaker after cooldown
     */
    function resetCircuitBreaker() 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        circuitBreakerActive = false;
        emit CircuitBreakerReset(msg.sender);
    }

    /**
     * @notice Update minimum payout amount
     * @param newMinAmount New minimum amount
     */
    function setMinPayoutAmount(uint256 newMinAmount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint256 oldAmount = minPayoutAmount;
        minPayoutAmount = newMinAmount;
        emit MinPayoutUpdated(oldAmount, newMinAmount);
    }

    /**
     * @notice Deposit funds into the pool
     */
    function deposit() external payable {
        // Funds received
    }

    /**
     * @notice Get pending payout for a miner
     */
    function getPendingPayout(address miner) external view returns (uint256) {
        return pendingPayouts[miner];
    }

    /**
     * @notice Get total paid out to a miner
     */
    function getTotalPaidOut(address miner) external view returns (uint256) {
        return totalPaidOut[miner];
    }

    /**
     * @notice Get remaining daily payout capacity
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp >= lastResetTimestamp + 1 days) {
            return dailyPayoutLimit;
        }
        return dailyPayoutLimit - dailyPayoutTotal;
    }

    // Internal functions

    function _processSinglePayout(
        address miner,
        uint256 amount,
        bytes32 payoutId
    ) internal {
        if (processedPayoutIds[payoutId]) revert PayoutAlreadyProcessed(payoutId);
        if (amount < minPayoutAmount) revert PayoutBelowMinimum(amount, minPayoutAmount);

        processedPayoutIds[payoutId] = true;
        
        if (pendingPayouts[miner] >= amount) {
            pendingPayouts[miner] -= amount;
        }
        
        totalPaidOut[miner] += amount;
        dailyPayoutTotal += amount;

        (bool success, ) = payable(miner).call{value: amount}("");
        require(success, "Transfer failed");

        emit PayoutProcessed(miner, amount, payoutId);
    }

    function _resetDailyLimitIfNeeded() internal {
        if (block.timestamp >= lastResetTimestamp + 1 days) {
            dailyPayoutTotal = 0;
            lastResetTimestamp = block.timestamp;
        }
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {}

    // Allow contract to receive ETH
    receive() external payable {}
}
```

### 3.3 Batch Payout Processor

**File: `contracts/BatchPayout.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPayoutManager.sol";

/**
 * @title BatchPayout
 * @notice Optimized batch payout processor for gas efficiency
 */
contract BatchPayout {
    IPayoutManager public immutable payoutManager;
    
    // Merkle tree for payout verification
    bytes32 public payoutMerkleRoot;
    mapping(bytes32 => bool) public claimedPayouts;
    
    event PayoutClaimed(address indexed miner, uint256 amount, bytes32 leaf);
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    
    constructor(address _payoutManager) {
        payoutManager = IPayoutManager(_payoutManager);
    }
    
    /**
     * @notice Update merkle root for new payout batch
     * @param newRoot New merkle root
     */
    function updateMerkleRoot(bytes32 newRoot) external {
        // Only callable by PayoutManager
        require(msg.sender == address(payoutManager), "Unauthorized");
        
        bytes32 oldRoot = payoutMerkleRoot;
        payoutMerkleRoot = newRoot;
        
        emit MerkleRootUpdated(oldRoot, newRoot);
    }
    
    /**
     * @notice Claim payout using merkle proof
     * @param amount Payout amount
     * @param merkleProof Merkle proof for verification
     */
    function claimPayout(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        
        require(!claimedPayouts[leaf], "Already claimed");
        require(_verifyProof(merkleProof, payoutMerkleRoot, leaf), "Invalid proof");
        
        claimedPayouts[leaf] = true;
        
        // Transfer from PayoutManager
        // Note: PayoutManager must have approved this contract
        
        emit PayoutClaimed(msg.sender, amount, leaf);
    }
    
    /**
     * @notice Verify merkle proof
     */
    function _verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == root;
    }
}
```

---

## 4. Payout System

### 4.1 Payout Queue Processor

**File: `apps/api/src/services/payout.service.ts`**

```typescript
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { PayoutManager__factory } from '@viddhana/contracts';

interface PayoutQueueItem {
  id: string;
  minerId: string;
  walletAddress: string;
  amount: bigint;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export class PayoutService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private payoutContract: ethers.Contract;
  private prisma: PrismaClient;
  private redis: Redis;
  
  // Configuration
  private readonly BATCH_SIZE = 50;
  private readonly MIN_PAYOUT = ethers.parseEther('0.001');
  private readonly GAS_BUFFER = 1.2; // 20% buffer
  
  constructor(
    rpcUrl: string,
    privateKey: string,
    contractAddress: string,
    prisma: PrismaClient,
    redis: Redis,
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.payoutContract = PayoutManager__factory.connect(
      contractAddress,
      this.wallet
    );
    this.prisma = prisma;
    this.redis = redis;
  }
  
  /**
   * Process pending payouts
   */
  async processPayoutQueue(): Promise<{
    processed: number;
    failed: number;
    totalAmount: bigint;
  }> {
    // Acquire lock to prevent concurrent processing
    const lockKey = 'payout:processing:lock';
    const acquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
    
    if (!acquired) {
      console.log('Payout processing already in progress');
      return { processed: 0, failed: 0, totalAmount: 0n };
    }
    
    try {
      // Get pending payouts
      const pendingPayouts = await this.prisma.payout.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: this.BATCH_SIZE,
        include: { user: true },
      });
      
      if (pendingPayouts.length === 0) {
        return { processed: 0, failed: 0, totalAmount: 0n };
      }
      
      // Filter payouts above minimum
      const validPayouts = pendingPayouts.filter(
        p => BigInt(p.amount) >= this.MIN_PAYOUT
      );
      
      if (validPayouts.length === 0) {
        return { processed: 0, failed: 0, totalAmount: 0n };
      }
      
      // Check contract balance
      const contractBalance = await this.provider.getBalance(
        await this.payoutContract.getAddress()
      );
      
      const totalAmount = validPayouts.reduce(
        (sum, p) => sum + BigInt(p.amount),
        0n
      );
      
      if (contractBalance < totalAmount) {
        console.error('Insufficient contract balance for payouts');
        return { processed: 0, failed: 0, totalAmount: 0n };
      }
      
      // Process batch
      const result = await this.processBatch(validPayouts);
      
      return result;
      
    } finally {
      await this.redis.del(lockKey);
    }
  }
  
  /**
   * Process a batch of payouts
   */
  private async processBatch(payouts: PayoutQueueItem[]): Promise<{
    processed: number;
    failed: number;
    totalAmount: bigint;
  }> {
    const miners: string[] = [];
    const amounts: bigint[] = [];
    const payoutIds: string[] = [];
    
    for (const payout of payouts) {
      miners.push(payout.walletAddress);
      amounts.push(BigInt(payout.amount));
      payoutIds.push(ethers.id(payout.id)); // Convert to bytes32
      
      // Mark as processing
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'processing' },
      });
    }
    
    try {
      // Estimate gas
      const gasEstimate = await this.payoutContract.processBatchPayout.estimateGas(
        miners,
        amounts,
        payoutIds
      );
      
      // Execute transaction
      const tx = await this.payoutContract.processBatchPayout(
        miners,
        amounts,
        payoutIds,
        {
          gasLimit: BigInt(Math.ceil(Number(gasEstimate) * this.GAS_BUFFER)),
        }
      );
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        // Update all payouts as completed
        await this.prisma.payout.updateMany({
          where: { id: { in: payouts.map(p => p.id) } },
          data: {
            status: 'completed',
            txHash: receipt.hash,
            processedAt: new Date(),
          },
        });
        
        const totalAmount = amounts.reduce((sum, a) => sum + a, 0n);
        
        return {
          processed: payouts.length,
          failed: 0,
          totalAmount,
        };
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('Batch payout failed:', error);
      
      // Mark payouts as failed
      await this.prisma.payout.updateMany({
        where: { id: { in: payouts.map(p => p.id) } },
        data: {
          status: 'failed',
          errorMessage: String(error),
        },
      });
      
      return {
        processed: 0,
        failed: payouts.length,
        totalAmount: 0n,
      };
    }
  }
  
  /**
   * Create a payout request for a user
   */
  async createPayoutRequest(
    userId: string,
    amount?: bigint,
  ): Promise<{ id: string; amount: bigint }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get unpaid balance
    const unpaidBalance = await this.getUnpaidBalance(userId);
    const payoutAmount = amount || unpaidBalance;
    
    if (payoutAmount < this.MIN_PAYOUT) {
      throw new Error(`Minimum payout is ${ethers.formatEther(this.MIN_PAYOUT)} ATL`);
    }
    
    if (payoutAmount > unpaidBalance) {
      throw new Error('Insufficient balance');
    }
    
    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        userId,
        amount: payoutAmount.toString(),
        status: 'pending',
      },
    });
    
    return {
      id: payout.id,
      amount: payoutAmount,
    };
  }
  
  /**
   * Get user's unpaid balance
   */
  async getUnpaidBalance(userId: string): Promise<bigint> {
    // Calculate from shares
    const shares = await this.prisma.share.aggregate({
      where: {
        worker: { userId },
        isValid: true,
        paidOut: false,
      },
      _sum: { reward: true },
    });
    
    return BigInt(shares._sum.reward || 0);
  }
  
  /**
   * Get payout history for a user
   */
  async getPayoutHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PayoutQueueItem[]> {
    return this.prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
```

---

## 5. Wallet Integration

### 5.1 Web3 Wallet Connection

**File: `apps/web/lib/wallet.ts`**

```typescript
import { createConfig, configureChains, mainnet } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { atlasChainL3 } from '@viddhana/shared/config/chains';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [atlasChainL3, mainnet],
  [publicProvider()]
);

export const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
  connectors: [
    new MetaMaskConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        metadata: {
          name: 'VIDDHANA Pool',
          description: 'Advanced Mining Pool',
          url: 'https://pool.viddhana.io',
          icons: ['https://pool.viddhana.io/logo.png'],
        },
      },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'VIDDHANA Pool',
      },
    }),
    new InjectedConnector({
      chains,
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
});
```

### 5.2 Wallet Connect Component

**File: `apps/web/components/shared/wallet-connect.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';

export function WalletConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { setAuth, logout } = useAuthStore();
  
  const handleConnect = async (connector: typeof connectors[0]) => {
    try {
      await connect({ connector });
      
      // After connection, prompt for signature
      const message = `Sign in to VIDDHANA Pool\n\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      
      // Authenticate with backend
      const { user, token } = await api.auth.login({
        wallet: address!,
        signature,
      });
      
      setAuth(user, token);
      setIsOpen(false);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };
  
  const handleDisconnect = () => {
    disconnect();
    logout();
  };
  
  const copyAddress = () => {
    navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={copyAddress}
          className="font-mono"
        >
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-success" />
          ) : (
            <Wallet className="h-4 w-4 mr-2" />
          )}
          {formatAddress(address)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDisconnect}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Wallet className="h-4 w-4 mr-2" />
        Connect Wallet
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {connectors.map((connector) => (
              <Button
                key={connector.id}
                variant="outline"
                onClick={() => handleConnect(connector)}
                disabled={isPending}
                className="w-full justify-start"
              >
                <img
                  src={`/wallets/${connector.id}.svg`}
                  alt={connector.name}
                  className="h-6 w-6 mr-3"
                />
                {connector.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## 6. DePIN Integration

### 6.1 DePIN Oracle Contract

**File: `contracts/DePINOracle.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";

/**
 * @title DePINOracle
 * @notice Verifies physical presence and energy consumption of mining rigs
 * @dev Implements Proof of Physical Work verification
 */
contract DePINOracle is AccessControl, ChainlinkClient {
    using Chainlink for Chainlink.Request;
    
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    struct RigRegistration {
        address owner;
        bytes32 deviceId;        // Hardware fingerprint
        bytes32 locationHash;    // Hashed location data
        uint256 registeredAt;
        uint256 lastVerification;
        bool isActive;
        uint256 energyConsumption; // Wh reported
        uint256 verificationScore; // 0-100
    }
    
    struct VerificationRequest {
        bytes32 rigId;
        address requester;
        uint256 timestamp;
        bool fulfilled;
        bool verified;
    }
    
    // State
    mapping(bytes32 => RigRegistration) public rigs;
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(address => bytes32[]) public ownerRigs;
    
    // Chainlink configuration
    bytes32 private jobId;
    uint256 private fee;
    
    // Events
    event RigRegistered(bytes32 indexed rigId, address indexed owner);
    event VerificationRequested(bytes32 indexed requestId, bytes32 indexed rigId);
    event VerificationCompleted(bytes32 indexed rigId, bool verified, uint256 score);
    event EnergyReported(bytes32 indexed rigId, uint256 consumption);
    
    constructor(
        address _link,
        address _oracle,
        bytes32 _jobId,
        uint256 _fee
    ) {
        setChainlinkToken(_link);
        setChainlinkOracle(_oracle);
        jobId = _jobId;
        fee = _fee;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Register a new mining rig
     * @param deviceId Hardware fingerprint
     * @param locationHash Hashed location (for privacy)
     */
    function registerRig(
        bytes32 deviceId,
        bytes32 locationHash
    ) external returns (bytes32 rigId) {
        rigId = keccak256(abi.encodePacked(msg.sender, deviceId, block.timestamp));
        
        require(rigs[rigId].owner == address(0), "Rig already registered");
        
        rigs[rigId] = RigRegistration({
            owner: msg.sender,
            deviceId: deviceId,
            locationHash: locationHash,
            registeredAt: block.timestamp,
            lastVerification: 0,
            isActive: true,
            energyConsumption: 0,
            verificationScore: 0
        });
        
        ownerRigs[msg.sender].push(rigId);
        
        emit RigRegistered(rigId, msg.sender);
    }
    
    /**
     * @notice Request verification of a rig's physical presence
     * @param rigId Rig identifier
     */
    function requestVerification(bytes32 rigId) 
        external 
        returns (bytes32 requestId) 
    {
        require(rigs[rigId].isActive, "Rig not active");
        require(
            rigs[rigId].owner == msg.sender || hasRole(VERIFIER_ROLE, msg.sender),
            "Not authorized"
        );
        
        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillVerification.selector
        );
        
        // Add rig data to request
        req.add("rigId", bytes32ToString(rigId));
        req.add("deviceId", bytes32ToString(rigs[rigId].deviceId));
        
        requestId = sendChainlinkRequest(req, fee);
        
        verificationRequests[requestId] = VerificationRequest({
            rigId: rigId,
            requester: msg.sender,
            timestamp: block.timestamp,
            fulfilled: false,
            verified: false
        });
        
        emit VerificationRequested(requestId, rigId);
    }
    
    /**
     * @notice Fulfill verification request (called by Chainlink oracle)
     * @param requestId Request identifier
     * @param verified Whether rig is verified
     * @param score Verification score (0-100)
     */
    function fulfillVerification(
        bytes32 requestId,
        bool verified,
        uint256 score
    ) external recordChainlinkFulfillment(requestId) {
        VerificationRequest storage request = verificationRequests[requestId];
        request.fulfilled = true;
        request.verified = verified;
        
        bytes32 rigId = request.rigId;
        rigs[rigId].lastVerification = block.timestamp;
        rigs[rigId].verificationScore = score;
        
        emit VerificationCompleted(rigId, verified, score);
    }
    
    /**
     * @notice Report energy consumption from IoT device
     * @param rigId Rig identifier
     * @param consumption Energy consumption in Wh
     * @param signature IoT device signature
     */
    function reportEnergy(
        bytes32 rigId,
        uint256 consumption,
        bytes calldata signature
    ) external onlyRole(ORACLE_ROLE) {
        require(rigs[rigId].isActive, "Rig not active");
        
        // Verify signature from IoT device (simplified)
        // In production, verify ECDSA signature from trusted device
        
        rigs[rigId].energyConsumption += consumption;
        
        emit EnergyReported(rigId, consumption);
    }
    
    /**
     * @notice Check if a rig is verified
     */
    function isRigVerified(bytes32 rigId) external view returns (bool) {
        RigRegistration storage rig = rigs[rigId];
        
        // Rig is verified if:
        // 1. Active
        // 2. Verified within last 24 hours
        // 3. Score >= 80
        return rig.isActive &&
               block.timestamp - rig.lastVerification < 24 hours &&
               rig.verificationScore >= 80;
    }
    
    /**
     * @notice Get verification status
     */
    function getVerificationStatus(bytes32 rigId) 
        external 
        view 
        returns (
            bool isActive,
            uint256 lastVerification,
            uint256 score,
            uint256 energyConsumption
        )
    {
        RigRegistration storage rig = rigs[rigId];
        return (
            rig.isActive,
            rig.lastVerification,
            rig.verificationScore,
            rig.energyConsumption
        );
    }
    
    // Helper function
    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(64);
        for (uint256 i; i < 32; i++) {
            bytesArray[i*2] = _toHexChar(uint8(_bytes32[i]) / 16);
            bytesArray[1+i*2] = _toHexChar(uint8(_bytes32[i]) % 16);
        }
        return string(bytesArray);
    }
    
    function _toHexChar(uint8 _i) internal pure returns (bytes1) {
        return _i < 10 ? bytes1(_i + 48) : bytes1(_i + 87);
    }
}
```

---

## 7. License NFT System

### 7.1 License NFT Contract

**File: `contracts/LicenseNFT.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LicenseNFT
 * @notice NFT-based license system for pool access tiers
 */
contract LicenseNFT is ERC721, ERC721Enumerable, AccessControl {
    using Counters for Counters.Counter;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    enum LicenseTier {
        Basic,      // 1% fee
        Pro,        // 0.5% fee, AI analytics
        Enterprise  // 0.25% fee, AI Pro, priority support
    }
    
    struct License {
        LicenseTier tier;
        uint256 expiresAt;
        uint256 mintedAt;
        bool isActive;
    }
    
    Counters.Counter private _tokenIdCounter;
    
    // Token ID => License data
    mapping(uint256 => License) public licenses;
    
    // Tier pricing (in wei)
    mapping(LicenseTier => uint256) public tierPrices;
    
    // Tier durations (in seconds)
    mapping(LicenseTier => uint256) public tierDurations;
    
    // Events
    event LicenseMinted(uint256 indexed tokenId, address indexed owner, LicenseTier tier);
    event LicenseRenewed(uint256 indexed tokenId, uint256 newExpiry);
    event LicenseUpgraded(uint256 indexed tokenId, LicenseTier oldTier, LicenseTier newTier);
    
    constructor() ERC721("VIDDHANA Pool License", "VPL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Set default prices (in ATL)
        tierPrices[LicenseTier.Basic] = 0.1 ether;
        tierPrices[LicenseTier.Pro] = 0.5 ether;
        tierPrices[LicenseTier.Enterprise] = 2 ether;
        
        // Set durations (30 days default)
        tierDurations[LicenseTier.Basic] = 30 days;
        tierDurations[LicenseTier.Pro] = 30 days;
        tierDurations[LicenseTier.Enterprise] = 30 days;
    }
    
    /**
     * @notice Purchase a license
     * @param tier License tier
     */
    function purchaseLicense(LicenseTier tier) external payable returns (uint256) {
        require(msg.value >= tierPrices[tier], "Insufficient payment");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(msg.sender, tokenId);
        
        licenses[tokenId] = License({
            tier: tier,
            expiresAt: block.timestamp + tierDurations[tier],
            mintedAt: block.timestamp,
            isActive: true
        });
        
        emit LicenseMinted(tokenId, msg.sender, tier);
        
        // Refund excess payment
        if (msg.value > tierPrices[tier]) {
            payable(msg.sender).transfer(msg.value - tierPrices[tier]);
        }
        
        return tokenId;
    }
    
    /**
     * @notice Renew an existing license
     * @param tokenId Token ID to renew
     */
    function renewLicense(uint256 tokenId) external payable {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        
        License storage license = licenses[tokenId];
        require(msg.value >= tierPrices[license.tier], "Insufficient payment");
        
        // Extend from current expiry or now if expired
        uint256 startFrom = license.expiresAt > block.timestamp 
            ? license.expiresAt 
            : block.timestamp;
        
        license.expiresAt = startFrom + tierDurations[license.tier];
        license.isActive = true;
        
        emit LicenseRenewed(tokenId, license.expiresAt);
    }
    
    /**
     * @notice Upgrade license to higher tier
     * @param tokenId Token ID to upgrade
     * @param newTier New tier
     */
    function upgradeLicense(uint256 tokenId, LicenseTier newTier) external payable {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        
        License storage license = licenses[tokenId];
        require(uint256(newTier) > uint256(license.tier), "Must upgrade to higher tier");
        
        uint256 priceDiff = tierPrices[newTier] - tierPrices[license.tier];
        require(msg.value >= priceDiff, "Insufficient payment");
        
        LicenseTier oldTier = license.tier;
        license.tier = newTier;
        
        emit LicenseUpgraded(tokenId, oldTier, newTier);
    }
    
    /**
     * @notice Check if an address has an active license of minimum tier
     * @param owner Address to check
     * @param minTier Minimum required tier
     */
    function hasActiveLicense(address owner, LicenseTier minTier) 
        external 
        view 
        returns (bool) 
    {
        uint256 balance = balanceOf(owner);
        
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            License storage license = licenses[tokenId];
            
            if (license.isActive && 
                license.expiresAt > block.timestamp &&
                uint256(license.tier) >= uint256(minTier)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @notice Get pool fee for a user based on their best license
     */
    function getPoolFee(address user) external view returns (uint256) {
        uint256 balance = balanceOf(user);
        LicenseTier bestTier = LicenseTier.Basic;
        bool hasLicense = false;
        
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(user, i);
            License storage license = licenses[tokenId];
            
            if (license.isActive && license.expiresAt > block.timestamp) {
                hasLicense = true;
                if (uint256(license.tier) > uint256(bestTier)) {
                    bestTier = license.tier;
                }
            }
        }
        
        if (!hasLicense) {
            return 100; // 1% default fee (basis points)
        }
        
        if (bestTier == LicenseTier.Enterprise) return 25;  // 0.25%
        if (bestTier == LicenseTier.Pro) return 50;         // 0.5%
        return 100; // 1%
    }
    
    // Admin functions
    function setTierPrice(LicenseTier tier, uint256 price) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        tierPrices[tier] = price;
    }
    
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // Required overrides
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

---

## 8. Testing & Deployment

### 8.1 Hardhat Configuration

**File: `packages/contracts/hardhat.config.ts`**

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-deploy';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    atlasTestnet: {
      url: process.env.ATLAS_TESTNET_RPC || '',
      chainId: 78433,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY] 
        : [],
    },
    atlasMainnet: {
      url: process.env.ATLAS_MAINNET_RPC || '',
      chainId: 78432,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY] 
        : [],
    },
  },
  etherscan: {
    apiKey: {
      atlasTestnet: process.env.ATLAS_EXPLORER_API_KEY || '',
      atlasMainnet: process.env.ATLAS_EXPLORER_API_KEY || '',
    },
    customChains: [
      {
        network: 'atlasTestnet',
        chainId: 78433,
        urls: {
          apiURL: 'https://testnet-explorer.atlas-l3.viddhana.io/api',
          browserURL: 'https://testnet-explorer.atlas-l3.viddhana.io',
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};

export default config;
```

### 8.2 Deployment Script

**File: `packages/contracts/scripts/deploy.ts`**

```typescript
import { ethers, upgrades } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with:', deployer.address);
  
  // Deploy PayoutManager (upgradeable)
  const PayoutManager = await ethers.getContractFactory('PayoutManager');
  const payoutManager = await upgrades.deployProxy(
    PayoutManager,
    [
      deployer.address,                    // admin
      ethers.parseEther('0.001'),         // minPayoutAmount
      ethers.parseEther('1000'),          // dailyPayoutLimit
    ],
    { initializer: 'initialize' }
  );
  await payoutManager.waitForDeployment();
  console.log('PayoutManager deployed to:', await payoutManager.getAddress());
  
  // Deploy LicenseNFT
  const LicenseNFT = await ethers.getContractFactory('LicenseNFT');
  const licenseNFT = await LicenseNFT.deploy();
  await licenseNFT.waitForDeployment();
  console.log('LicenseNFT deployed to:', await licenseNFT.getAddress());
  
  // Deploy DePINOracle
  const DePINOracle = await ethers.getContractFactory('DePINOracle');
  const dePINOracle = await DePINOracle.deploy(
    process.env.LINK_TOKEN_ADDRESS!,
    process.env.CHAINLINK_ORACLE_ADDRESS!,
    process.env.CHAINLINK_JOB_ID!,
    ethers.parseEther('0.1')  // fee
  );
  await dePINOracle.waitForDeployment();
  console.log('DePINOracle deployed to:', await dePINOracle.getAddress());
  
  // Verify contracts
  console.log('Verifying contracts...');
  // Add verification logic
  
  console.log('Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## Implementation Checklist

### Phase 1: Testnet
- [ ] Deploy PayoutManager to Atlas L3 Testnet
- [ ] Deploy LicenseNFT contract
- [ ] Implement payout queue processor
- [ ] Test batch payouts with test miners
- [ ] Integrate wallet connection (MetaMask)

### Phase 2: Production Prep
- [ ] Security audit of smart contracts
- [ ] Deploy multi-sig wallet for pool funds
- [ ] Setup circuit breaker with Sentinel AI
- [ ] Implement DePIN Oracle integration
- [ ] Load test payout system

### Phase 3: Mainnet
- [ ] Deploy to Atlas L3 Mainnet
- [ ] Configure production monitoring
- [ ] Enable auto-swap functionality
- [ ] Launch license NFT system
- [ ] Full DePIN verification

---

## References

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Wagmi Documentation](https://wagmi.sh/)
- [Chainlink Documentation](https://docs.chain.link/)
