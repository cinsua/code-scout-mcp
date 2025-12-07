import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type {
  DatabaseConfig,
  DatabaseStats,
  DatabaseHealth,
  PerformanceReport,
  QueryOptions,
  TransactionCallback,
  MigrationResult,
  BackupOptions,
} from '../types/StorageTypes';
import { DatabaseError } from '../types/StorageTypes';
import { DatabaseErrorType } from '../types/StorageTypes';
import { EnhancedConnectionPool } from '../utils/EnhancedConnectionPool';
import { MigrationManager } from '../migrations/MigrationManager';
import { DatabaseMaintenance } from '../utils/databaseMaintenance';
import { PerformanceConfigManager } from '../config/PerformanceConfig';
import { MONITORING_DEFAULTS } from '../config/PerformanceConstants';

import { PerformanceService } from './PerformanceService';

// Constants for database service
const SLOW_QUERY_THRESHOLD_MS = MONITORING_DEFAULTS.SLOW_QUERY_THRESHOLD_MS;

/**
 * Main database service for SQLite operations
 */
export class DatabaseService {
  private pool: EnhancedConnectionPool;
  private migrationManager!: MigrationManager;
  private maintenance!: DatabaseMaintenance;
  private performanceService?: PerformanceService;
  private stats: DatabaseStats;
  private isInitialized = false;
  private isClosing = false;

  constructor(private config: DatabaseConfig) {
    this.pool = new EnhancedConnectionPool(config);
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

        // Initialize maintenance utilities
        this.maintenance = new DatabaseMaintenance(db, this.config);

        // Initialize performance service with centralized configuration
        const performanceConfig =
          PerformanceConfigManager.getProfile('development');
        this.performanceService = new PerformanceService(
          db,
          performanceConfig,
          this.pool,
        );

        // Run migrations
        const migrationResults = await this.migrationManager.migrate();

        // Log any migration failures
        const failedMigrations = migrationResults.filter(r => !r.success);
        if (failedMigrations.length > 0) {
          throw this.createDatabaseError(
            DatabaseErrorType.MIGRATION_FAILED,
            `Migration failed: ${failedMigrations.map(r => `${r.name}: ${r.error}`).join(', ')}`,
            { context: { migrationResults: failedMigrations } },
          );
        }

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

      let result: Database.RunResult;

      // Use performance service if available for monitoring and optimization
      if (this.performanceService) {
        const performanceResult = this.performanceService.executeRun(
          query,
          params,
        );
        // Convert performance service result to match better-sqlite3 RunResult format
        result = {
          changes: performanceResult.changes,
          lastInsertRowid: performanceResult.lastInsertRowid,
        } as Database.RunResult;
      } else {
        // Fallback to direct execution if no performance service
        const stmt = db.prepare(query);
        result = stmt.run(...params);
      }

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

      let results: T[];

      // Use performance service if available for monitoring and optimization
      if (this.performanceService) {
        results = this.performanceService.executeQuery<T>(query, params);
      } else {
        // Fallback to direct execution if no performance service
        const stmt = db.prepare(query);
        results = stmt.all(...params) as T[];
      }

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
  async migrate(): Promise<MigrationResult[]> {
    this.ensureInitialized();

    // Create backup before major migrations (more than 1 pending migration)
    const pendingCount = this.getPendingMigrationsCount();
    if (pendingCount > 1) {
      const backupPath = `${this.config.path}.backup.${Date.now()}`;
      try {
        await this.backup({ destination: backupPath });
      } catch {
        // Log backup failure but don't fail migration
        // console.warn(
        //   `Failed to create backup before migration: ${(error as Error).message}`,
        // );
      }
    }

    return this.migrationManager.migrate();
  }

  /**
   * Create database backup
   */
  async backup(options: BackupOptions): Promise<{
    success: boolean;
    size: number;
    duration: number;
    error?: string;
  }> {
    this.ensureInitialized();

    const db = await this.pool.getConnection();
    try {
      const maintenance = new DatabaseMaintenance(db, this.config);
      return await maintenance.backup(options);
    } finally {
      this.pool.releaseConnection(db);
    }
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
   * Get pending migrations count
   */
  getPendingMigrationsCount(): number {
    this.ensureInitialized();
    return this.migrationManager.getPendingMigrations().length;
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
      context?: Record<string, unknown>;
    } = {},
  ): DatabaseError {
    return new DatabaseError(type, message, options);
  }

  /**
   * Get performance report from performance service
   */
  getPerformanceReport(): PerformanceReport | undefined {
    this.ensureInitialized();
    return this.performanceService?.getPerformanceReport();
  }

  /**
   * Get performance service instance
   */
  getPerformanceService(): PerformanceService | undefined {
    return this.performanceService;
  }

  /**
   * Graceful shutdown of the database service
   */
  async gracefulShutdown(timeoutMs: number = 10000): Promise<void> {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;

    try {
      // First, close performance service gracefully
      if (this.performanceService) {
        await this.performanceService.gracefulShutdown(timeoutMs / 2);
      }

      // Close connection pool
      this.pool.closeAll();
    } catch {
      // Fallback to immediate close
      this.close();
    }
  }

  /**
   * Close the database service and cleanup resources
   */
  close(): void {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;

    try {
      // Close performance service
      if (this.performanceService) {
        this.performanceService.close();
      }

      // Close connection pool
      this.pool.closeAll();
    } catch {
      // Error during cleanup - ignore
    }
  }
}
