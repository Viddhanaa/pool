#!/usr/bin/env node

/**
 * Test script to generate historical data for charts
 * Creates mining sessions spanning multiple days for better chart visualization
 */

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'asdminer',
});

async function generateHistoricalData() {
  await client.connect();
  console.log('Connected to database');

  try {
    // Get existing miners
    const minersResult = await client.query('SELECT miner_id FROM miners WHERE status = $1 LIMIT 5', ['online']);
    const minerIds = minersResult.rows.map(r => r.miner_id);
    
    if (minerIds.length === 0) {
      console.log('No online miners found');
      return;
    }

    console.log(`Found ${minerIds.length} online miners: ${minerIds.join(', ')}`);

    // Generate data for last 7 days
    const daysBack = 7;
    let totalInserted = 0;

    for (let dayOffset = daysBack; dayOffset >= 0; dayOffset--) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      date.setHours(0, 0, 0, 0);

      console.log(`\nGenerating data for ${date.toISOString().split('T')[0]}...`);

      // For each day, create sessions throughout the day
      const sessionsPerDay = dayOffset === 0 ? 12 : 20 + Math.floor(Math.random() * 20); // Fewer sessions for today

      for (const minerId of minerIds) {
        const rewardPerSession = 0.5 + Math.random() * 1.5; // Random reward 0.5-2 VIDDHANA
        const hashrate = 800000 + Math.random() * 400000; // Random hashrate 800k-1200k

        for (let session = 0; session < sessionsPerDay; session++) {
          // Spread sessions throughout the day
          const minuteOfDay = Math.floor((session / sessionsPerDay) * 1440); // 1440 minutes in a day
          const sessionTime = new Date(date);
          sessionTime.setMinutes(sessionTime.getMinutes() + minuteOfDay);

          // Determine partition table
          const year = sessionTime.getFullYear();
          const month = String(sessionTime.getMonth() + 1).padStart(2, '0');
          const partitionTable = `mining_sessions_${year}${month}`;

          try {
            await client.query(
              `INSERT INTO ${partitionTable} (miner_id, start_minute, hashrate_snapshot, reward_amount, created_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (miner_id, start_minute) DO NOTHING`,
              [minerId, sessionTime.toISOString(), hashrate, rewardPerSession]
            );
            totalInserted++;
          } catch (err) {
            if (err.code !== '23505') { // Ignore duplicate key errors
              console.error(`Error inserting session: ${err.message}`);
            }
          }
        }
      }

      console.log(`  ✓ Created ${sessionsPerDay} sessions per miner`);
    }

    console.log(`\n✅ Successfully inserted ${totalInserted} historical sessions`);

    // Verify data
    console.log('\n📊 Verifying chart data...\n');

    for (const minerId of minerIds.slice(0, 2)) { // Check first 2 miners
      console.log(`\nMiner ${minerId}:`);
      
      // Earnings history
      const earnings = await client.query(
        `SELECT date_trunc('day', start_minute)::date AS date,
                SUM(reward_amount)::numeric(10,2) AS earned_amount,
                COUNT(*)::int as sessions
         FROM mining_sessions
         WHERE miner_id = $1 AND start_minute >= NOW() - INTERVAL '7 days'
         GROUP BY date_trunc('day', start_minute)
         ORDER BY date ASC`,
        [minerId]
      );
      
      console.log('  Earnings (7d):');
      earnings.rows.forEach(row => {
        console.log(`    ${row.date}: ${row.earned_amount} VIDDHANA (${row.sessions} sessions)`);
      });

      // Hashrate history (last 24h)
      const hashrate = await client.query(
        `SELECT COUNT(*)::int as snapshots,
                MIN(hashrate_snapshot)::numeric(12,0) as min_hashrate,
                MAX(hashrate_snapshot)::numeric(12,0) as max_hashrate,
                AVG(hashrate_snapshot)::numeric(12,0) as avg_hashrate
         FROM mining_sessions
         WHERE miner_id = $1 AND start_minute >= NOW() - INTERVAL '24 hours'`,
        [minerId]
      );
      
      if (hashrate.rows[0].snapshots > 0) {
        console.log(`  Hashrate (24h):`);
        console.log(`    Snapshots: ${hashrate.rows[0].snapshots}`);
        console.log(`    Min: ${hashrate.rows[0].min_hashrate} H/s`);
        console.log(`    Max: ${hashrate.rows[0].max_hashrate} H/s`);
        console.log(`    Avg: ${hashrate.rows[0].avg_hashrate} H/s`);
      }

      // Active time history
      const active = await client.query(
        `SELECT date_trunc('day', start_minute)::date AS date,
                COUNT(*)::int as minutes
         FROM mining_sessions
         WHERE miner_id = $1 AND start_minute >= NOW() - INTERVAL '7 days'
         GROUP BY date_trunc('day', start_minute)
         ORDER BY date ASC`,
        [minerId]
      );
      
      console.log('  Active time (7d):');
      active.rows.forEach(row => {
        const hours = (row.minutes / 60).toFixed(1);
        console.log(`    ${row.date}: ${row.minutes} minutes (${hours}h)`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('\n✨ Done!');
  }
}

generateHistoricalData().catch(console.error);
