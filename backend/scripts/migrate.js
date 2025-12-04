#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { default: migrate } = require('node-pg-migrate');

async function run() {
  const migrationsDir = path.join(__dirname, '..', '..', 'infra', 'sql', 'migrations');
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/asdminer';

  await migrate({
    databaseUrl,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    logger: console.log
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
