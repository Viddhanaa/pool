import { query } from '../db/postgres';

export function getPartitionName(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `mining_sessions_${year}${month}`;
}

export function getPartitionBounds(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function ensureMiningPartitions(baseDate = new Date()) {
  const currentMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
  await query(`SELECT ensure_mining_session_partition($1::timestamptz)`, [currentMonth.toISOString()]);
  await query(`SELECT ensure_mining_session_partition($1::timestamptz)`, [nextMonth.toISOString()]);
}
