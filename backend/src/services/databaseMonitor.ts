import { Pool } from 'pg';
import { log } from '../lib/logger';

export interface QueryStats {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  min_time: number;
  max_time: number;
}

export class DatabaseMonitor {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get slow queries from pg_stat_statements
   */
  async getSlowQueries(limit: number = 10): Promise<QueryStats[]> {
    try {
      const result = await this.pool.query<QueryStats>(`
        SELECT 
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          min_exec_time as min_time,
          max_exec_time as max_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY total_exec_time DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      log.error('Failed to get slow queries', error);
      return [];
    }
  }

  /**
   * Reset pg_stat_statements statistics
   */
  async resetStats(): Promise<void> {
    try {
      await this.pool.query('SELECT pg_stat_statements_reset()');
      log.info('Database statistics reset successfully');
    } catch (error) {
      log.error('Failed to reset database statistics', error);
    }
  }

  /**
   * Get connection pool stats
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Get database size
   */
  async getDatabaseSize(): Promise<string> {
    try {
      const result = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      return result.rows[0].size;
    } catch (error) {
      log.error('Failed to get database size', error);
      return 'unknown';
    }
  }

  /**
   * Get table sizes
   */
  async getTableSizes(): Promise<Array<{ table: string; size: string }>> {
    try {
      const result = await this.pool.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);
      return result.rows;
    } catch (error) {
      log.error('Failed to get table sizes', error);
      return [];
    }
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsage(): Promise<Array<{ table: string; index: string; scans: number }>> {
    try {
      const result = await this.pool.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          indexname as index,
          idx_scan as scans
        FROM pg_stat_user_indexes
        ORDER BY idx_scan ASC
        LIMIT 10
      `);
      return result.rows;
    } catch (error) {
      log.error('Failed to get index usage', error);
      return [];
    }
  }
}
