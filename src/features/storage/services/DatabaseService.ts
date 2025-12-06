import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type {
  DatabaseConfig,
  DatabaseStats,
  DatabaseHealth,
  QueryOptions,
  TransactionCallback,
  DatabaseError,
} from '../types/StorageTypes';
import { DatabaseErrorType } from '../types/StorageTypes';
import { ConnectionPool } from '../utils/connectionPool';
import { MigrationManager } from '../migrations/MigrationManager';

// Constants for database service
const SLOW_QUERY_THRESHOLD_MS = 100;

/**
 * Main database service for SQLite operations
 */
export class DatabaseService {
  private pool: ConnectionPool;
  private migrationManager!: MigrationManager;
  private stats: DatabaseStats;
  private isInitialized = false;
  private isClosing = false;

  constructor(private config: DatabaseConfig) {
    this.pool = new ConnectionPool(config);
    this.stats = this.initializeStats();
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure database directory exists
      await this.ensureDatabaseDirectory();

      // Get a connection to initialize the database
      const db = await this.pool.getConnection();

      try {
        // Initialize migration manager
        this.migrationManager = new MigrationManager(db);
        await this.migrationManager.initialize();

        // Run migrations
        await this.migrationManager.migrate();

        this.isInitialized = true;
      } finally {
        this.pool.releaseConnection(db);
      }
    } catch (error) {
      throw this.createDatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Query failed: ${(error as Error).message}`,
        { original: error as Error },
      );
    }
  }

  /**
   * Execute a query and return the first result
   */
  async executeOne<T = unknown>(
    query: string,
    params: unknown[] = [],
    options: QueryOptions = {},
  ): Promise<T | undefined> {
    const results = await this.executeQuery<T>(query, params, options);
    return results[0];
  }

  /**
   * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
   */
  async executeRun(
    query: string,
    params: unknown[] = [],
    options: QueryOptions = {},
  ): Promise<Database.RunResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    let db: Database.Database | null = null;

    try {
      db = await this.pool.getConnection();

      // Set timeout if specified
      if (options.timeout) {
        db.defaultSafeIntegers(true);
        // Note: busy_timeout is set via pragma in connection pool
      }

      const stmt = db.prepare(query);
      const result = stmt.run(...params);

      this.updateQueryStats(Date.now() - startTime, false);
      return result;
    } catch (error) {
      this.updateQueryStats(Date.now() - startTime, true);
      throw this.createDatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Query failed: ${(error as Error).message}`,
        { original: error as Error, query, params },
      );
    } finally {
      if (db) {
        this.pool.releaseConnection(db);
      }
    }
  }

  /**
   * Execute a query and return results
   */
  async executeQuery<T = unknown>(
    query: string,
    params: unknown[] = [],
    options: QueryOptions = {},
  ): Promise<T[]> {
    this.ensureInitialized();

    const startTime = Date.now();
    let db: Database.Database | null = null;

    try {
      db = await this.pool.getConnection();

      // Set timeout if specified
      if (options.timeout) {
        db.defaultSafeIntegers(true);
        // Note: busy_timeout is set via pragma in connection pool
      }

      const stmt = db.prepare(query);
      const results = stmt.all(...params) as T[];

      this.updateQueryStats(Date.now() - startTime, false);
      return results;
    } catch (error) {
      this.updateQueryStats(Date.now() - startTime, true);
      throw this.createDatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Query failed: ${(error as Error).message}`,
        { original: error as Error, query, params },
      );
    } finally {
      if (db) {
        this.pool.releaseConnection(db);
      }
    }
  }

  /**
   * Execute a transaction
   */
  async executeTransaction<T>(
    callback: TransactionCallback<T>,
    options: QueryOptions = {},
  ): Promise<T> {
    this.ensureInitialized();

    const startTime = Date.now();
    let db: Database.Database | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      db = await this.pool.getConnection();

      // Set timeout if specified
      if (options.timeout) {
        db.defaultSafeIntegers(true);

        // Set up transaction timeout
        timeoutHandle = setTimeout(() => {
          // This will cause the transaction to fail with a timeout error
          throw new Error(`Transaction timeout after ${options.timeout}ms`);
        }, options.timeout);
      }

      // Execute transaction with timeout handling
      const transaction = db.transaction(() => {
        if (timeoutHandle && options.timeout) {
          // Check if we've exceeded timeout during execution
          const elapsed = Date.now() - startTime;
          if (elapsed > options.timeout) {
            throw new Error(`Transaction timeout after ${options.timeout}ms`);
          }
        }
        return callback(db as Database.Database);
      });

      const result = transaction();

      // Clear timeout if transaction completed successfully
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      this.updateQueryStats(Date.now() - startTime, false);
      return result as T;
    } catch (error) {
      // Clear timeout if there was an error
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      this.updateQueryStats(Date.now() - startTime, true);

      // Check if it's a timeout error
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('timeout')) {
        throw this.createDatabaseError(
          DatabaseErrorType.TIMEOUT,
          `Transaction timeout: ${errorMessage}`,
          { original: error as Error },
        );
      }

      throw this.createDatabaseError(
        DatabaseErrorType.TRANSACTION_FAILED,
        `Transaction failed: ${(error as Error).message}`,
        { original: error as Error },
      );
    } finally {
      if (db) {
        this.pool.releaseConnection(db);
      }
    }
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<void> {
    this.ensureInitialized();
    await this.migrationManager.migrate();
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const poolStats = this.pool.getStats();

    // Update connection stats
    this.stats.connections = {
      active: poolStats.size - poolStats.available,
      idle: poolStats.available,
      waiting: poolStats.waiting,
      total: poolStats.size,
    };

    return { ...this.stats };
  }

  /**
   * Perform health check
   */
  healthCheck(): DatabaseHealth {
    const poolHealth = this.pool.healthCheck();
    const stats = this.getStats();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const performance = {
      avgResponseTime: stats.queries.total > 0 ? stats.queries.avgTime : 0,
      connectionTime: 0, // Would need to measure this
    };

    // Determine overall health
    if (poolHealth.status === 'critical' || stats.queries.failed > 0) {
      status = 'unhealthy';
    } else if (poolHealth.status === 'warning' || stats.queries.slow > 0) {
      status = 'degraded';
    }

    return {
      status,
      accessible: this.isInitialized,
      poolStatus: poolHealth.status as 'optimal' | 'warning' | 'critical',
      performance,
    };
  }

  /**
   * Get migration manager
   */
  getMigrationManager(): MigrationManager {
    this.ensureInitialized();
    return this.migrationManager;
  }

  /**
   * Ensure database directory exists
   */
  private async ensureDatabaseDirectory(): Promise<void> {
    const dbDir = path.dirname(this.config.path);
    await fs.mkdir(dbDir, { recursive: true });
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): DatabaseStats {
    return {
      connections: {
        active: 0,
        idle: 0,
        waiting: 0,
        total: 0,
      },
      queries: {
        total: 0,
        slow: 0,
        failed: 0,
        avgTime: 0,
      },
      size: {
        database: 0,
        indexes: 0,
        freePages: 0,
        pageSize: 0,
      },
    };
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(duration: number, failed: boolean): void {
    this.stats.queries.total++;

    if (failed) {
      this.stats.queries.failed++;
    } else if (duration > SLOW_QUERY_THRESHOLD_MS) {
      this.stats.queries.slow++;
    }

    // Update average time
    const totalTime =
      this.stats.queries.avgTime * (this.stats.queries.total - 1) + duration;
    this.stats.queries.avgTime = totalTime / this.stats.queries.total;
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw this.createDatabaseError(
        DatabaseErrorType.CONNECTION_FAILED,
        'Database service not initialized',
      );
    }

    if (this.isClosing) {
      throw this.createDatabaseError(
        DatabaseErrorType.CONNECTION_FAILED,
        'Database service is closing',
      );
    }
  }

  /**
   * Create a database error
   */
  private createDatabaseError(
    type: DatabaseErrorType,
    message: string,
    options: {
      original?: Error;
      query?: string;
      params?: unknown[];
    } = {},
  ): DatabaseError {
    return {
      type,
      message,
      original: options.original,
      query: options.query,
      params: options.params,
      timestamp: new Date(),
    };
  }
}
