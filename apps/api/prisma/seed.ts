import { PrismaClient, PayoutStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, decimals: number = 8): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return date;
}

function generateWalletAddress(): string {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

function generateTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function generateBlockHash(): string {
  return generateTxHash();
}

// Seed data
const WORKER_NAMES = [
  'rig-01', 'rig-02', 'rig-03', 'miner-alpha', 'miner-beta',
  'gpu-farm-1', 'gpu-farm-2', 'asic-main', 'asic-backup', 'home-miner',
  'datacenter-01', 'datacenter-02', 'worker-A', 'worker-B', 'worker-C'
];

const ALGORITHMS = ['ethash', 'kawpow', 'kheavyhash', 'blake3'];

async function seedUsers() {
  console.log('🌱 Seeding users...');
  
  const users = [];
  
  // Create 20 test users
  for (let i = 1; i <= 20; i++) {
    const user = await prisma.user.upsert({
      where: { walletAddress: generateWalletAddress() + i.toString().padStart(2, '0') },
      update: {},
      create: {
        walletAddress: generateWalletAddress(),
        username: i <= 10 ? `miner_${i.toString().padStart(3, '0')}` : null,
        email: i <= 5 ? `miner${i}@viddhana.io` : null,
        payoutThreshold: randomDecimal(0.05, 1.0, 2),
        payoutAddress: generateWalletAddress(),
        isActive: i <= 18, // 2 inactive users
        lastLoginAt: randomDate(30),
        createdAt: randomDate(90),
      },
    });
    users.push(user);
  }
  
  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { walletAddress: '0xADMIN000000000000000000000000000000000001' },
    update: {},
    create: {
      walletAddress: '0xADMIN000000000000000000000000000000000001',
      username: 'admin',
      email: 'admin@viddhana.io',
      payoutThreshold: 0.1,
      payoutAddress: '0xADMIN000000000000000000000000000000000001',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
  });
  users.push(adminUser);
  
  // Create demo user for testing
  const demoUser = await prisma.user.upsert({
    where: { walletAddress: '0xDEMO0000000000000000000000000000000000001' },
    update: {},
    create: {
      walletAddress: '0xDEMO0000000000000000000000000000000000001',
      username: 'demo_user',
      email: 'demo@viddhana.io',
      payoutThreshold: 0.1,
      payoutAddress: '0xDEMO0000000000000000000000000000000000001',
      isActive: true,
      createdAt: new Date('2024-06-01'),
    },
  });
  users.push(demoUser);

  console.log(`✅ Created ${users.length} users`);
  return users;
}

async function seedWorkers(users: any[]) {
  console.log('🌱 Seeding workers...');
  
  const workers = [];
  
  for (const user of users) {
    // Each user has 1-5 workers
    const numWorkers = randomInt(1, 5);
    const usedNames = new Set<string>();
    
    for (let i = 0; i < numWorkers; i++) {
      let workerName: string;
      do {
        workerName = WORKER_NAMES[randomInt(0, WORKER_NAMES.length - 1)] + `-${randomInt(1, 99)}`;
      } while (usedNames.has(workerName));
      usedNames.add(workerName);
      
      const isOnline = Math.random() > 0.3; // 70% chance online
      const hashrate = isOnline ? randomDecimal(100, 200, 2) * 1e9 : 0; // 100-200 GH/s in H/s

      const worker = await prisma.worker.create({
        data: {
          userId: user.id,
          name: workerName,
          hashrate: hashrate,
          sharesAccepted: BigInt(randomInt(1000, 100000)),
          sharesRejected: BigInt(randomInt(10, 1000)),
          lastShareAt: isOnline ? new Date() : randomDate(7),
          isOnline: isOnline,
          difficulty: randomDecimal(1, 16, 4),
          algorithm: ALGORITHMS[randomInt(0, ALGORITHMS.length - 1)],
          version: `viddhana-miner/1.${randomInt(0, 9)}.${randomInt(0, 9)}`,
          ipAddress: `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
          createdAt: randomDate(60),
        },
      });
      workers.push(worker);
    }
  }

  console.log(`✅ Created ${workers.length} workers`);
  return workers;
}

async function seedBlocks(users: any[]) {
  console.log('🌱 Seeding blocks...');
  
  const blocks = [];
  const startHeight = 19000000;
  
  // Create 50 blocks
  for (let i = 0; i < 50; i++) {
    const height = startHeight + i;
    const isConfirmed = i < 45; // Last 5 blocks are pending
    const isOrphan = !isConfirmed && Math.random() > 0.9; // 10% orphan rate for unconfirmed
    const finder = users[randomInt(0, users.length - 1)];
    
    const block = await prisma.block.create({
      data: {
        height: BigInt(height),
        hash: generateBlockHash(),
        difficulty: randomInt(1000000000000, 9999999999999),
        reward: randomDecimal(2.0, 3.0, 8),
        fees: randomDecimal(0.01, 0.5, 8),
        finder: finder.walletAddress,
        finderUserId: finder.id,
        confirmations: isConfirmed ? randomInt(12, 1000) : randomInt(0, 11),
        isOrphan: isOrphan,
        isConfirmed: isConfirmed,
        foundAt: randomDate(30),
        createdAt: randomDate(30),
      },
    });
    blocks.push(block);
  }

  console.log(`✅ Created ${blocks.length} blocks`);
  return blocks;
}

async function seedShares(users: any[], workers: any[], blocks: any[]) {
  console.log('🌱 Seeding shares...');
  
  const shares = [];
  
  // Create shares for each worker (limit to first 10 workers for speed)
  const workersToSeed = workers.slice(0, 10);
  for (const worker of workersToSeed) {
    const numShares = randomInt(10, 30);
    
    for (let i = 0; i < numShares; i++) {
      const isValid = Math.random() > 0.02; // 98% valid rate
      const hasBlock = Math.random() > 0.99; // 1% chance of finding block
      
      const share = await prisma.share.create({
        data: {
          userId: worker.userId,
          workerId: worker.id,
          blockId: hasBlock && blocks.length > 0 ? blocks[randomInt(0, blocks.length - 1)].id : null,
          difficulty: randomDecimal(1, 32, 8),
          isValid: isValid,
          nonce: `0x${randomInt(0, 0xFFFFFFFF).toString(16).padStart(8, '0')}`,
          hash: isValid ? generateBlockHash() : null,
          createdAt: randomDate(7),
        },
      });
      shares.push(share);
    }
  }

  console.log(`✅ Created ${shares.length} shares`);
  return shares;
}

async function seedPayouts(users: any[]) {
  console.log('🌱 Seeding payouts...');
  
  const payouts = [];
  const statuses: PayoutStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  
  for (const user of users) {
    // Each user has 0-10 payouts
    const numPayouts = randomInt(0, 10);
    
    for (let i = 0; i < numPayouts; i++) {
      const status = statuses[randomInt(0, statuses.length - 1)];
      const amount = randomDecimal(0.1, 5.0, 8);
      const fee = amount * 0.01; // 1% fee
      const createdAt = randomDate(60);
      
      const payout = await prisma.payout.create({
        data: {
          userId: user.id,
          amount: amount,
          fee: fee,
          txHash: status === 'COMPLETED' ? generateTxHash() : null,
          toAddress: user.payoutAddress || user.walletAddress,
          status: status,
          errorMessage: status === 'FAILED' ? 'Transaction failed: insufficient gas' : null,
          processedAt: ['COMPLETED', 'FAILED'].includes(status) ? new Date(createdAt.getTime() + 3600000) : null,
          confirmedAt: status === 'COMPLETED' ? new Date(createdAt.getTime() + 7200000) : null,
          createdAt: createdAt,
        },
      });
      payouts.push(payout);
    }
  }

  console.log(`✅ Created ${payouts.length} payouts`);
  return payouts;
}

async function seedPoolStats() {
  console.log('🌱 Seeding pool stats...');
  
  const stats = [];
  
  // Create hourly stats for the last 7 days
  for (let hoursAgo = 0; hoursAgo < 168; hoursAgo++) { // 7 days * 24 hours
    const date = new Date();
    date.setHours(date.getHours() - hoursAgo);
    
    const baseHashrate = 50000000000; // 50 GH/s base
    const variance = randomDecimal(-0.2, 0.2, 4);
    
    const stat = await prisma.poolStats.create({
      data: {
        hashrate: baseHashrate * (1 + variance),
        activeWorkers: randomInt(80, 150),
        activeMiners: randomInt(15, 25),
        blocksFound: BigInt(randomInt(0, 3)),
        totalPaid: randomDecimal(100, 500, 8),
        difficulty: randomDecimal(1000000000000, 5000000000000, 2), // Changed from BigInt to Decimal
        networkHashrate: randomDecimal(800000000000, 1200000000000, 2),
        createdAt: date,
      },
    });
    stats.push(stat);
  }

  console.log(`✅ Created ${stats.length} pool stats records`);
  return stats;
}

async function seedSessions(users: any[]) {
  console.log('🌱 Seeding sessions...');
  
  const sessions = [];
  
  // Create active sessions for some users
  for (let i = 0; i < Math.min(10, users.length); i++) {
    const user = users[i];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: `refresh_${generateTxHash()}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
        expiresAt: expiresAt,
        createdAt: randomDate(7),
      },
    });
    sessions.push(session);
  }

  console.log(`✅ Created ${sessions.length} sessions`);
  return sessions;
}

async function main() {
  console.log('🚀 Starting seed...\n');
  
  try {
    // Clear existing data (in reverse order of dependencies)
    console.log('🗑️  Clearing existing data...');
    await prisma.session.deleteMany();
    await prisma.share.deleteMany();
    await prisma.payout.deleteMany();
    await prisma.block.deleteMany();
    await prisma.worker.deleteMany();
    await prisma.poolStats.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Cleared existing data\n');

    // Seed data
    const users = await seedUsers();
    const workers = await seedWorkers(users);
    const blocks = await seedBlocks(users);
    await seedShares(users, workers, blocks);
    await seedPayouts(users);
    await seedPoolStats();
    await seedSessions(users);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Workers: ${workers.length}`);
    console.log(`   - Blocks: ${blocks.length}`);
    console.log(`   - Pool Stats: 168 records (7 days hourly)`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
