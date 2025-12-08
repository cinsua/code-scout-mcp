import { promises as fs } from 'node:fs';
import path from 'node:path';

import type Database from 'better-sqlite3';

import type {
  DatabaseConfig,
  DatabaseStats,
  DatabaseHealth,
  QueryOptions,
  TransactionCallback,
  MigrationResult,
  BackupOptions,
} from '@/features/storage/types/StorageTypes';
import type { PerformanceReport } from '@/features/storage/types/PerformanceTypes';
import type { DatabaseError } from '@/shared/errors/DatabaseError';
import { DatabaseErrorType } from '@/shared/errors/DatabaseError';
import { EnhancedConnectionPool } from '@/features/storage/utils/EnhancedConnectionPool';
import { MigrationManager } from '@/features/storage/migrations/MigrationManager';
import { DatabaseMaintenance } from '@/features/storage/utils/databaseMaintenance';
import { PerformanceConfigManager } from '@/features/storage/config/PerformanceConfig';
import { MONITORING_DEFAULTS } from '@/features/storage/config/PerformanceConstants';
import { LogManager } from '@/shared/utils/LogManager';
import { createQueryPerformanceContext } from '@/shared/utils/PerformanceLogger';
import { logDatabaseError } from '@/shared/utils/ErrorLogger';
import { ErrorAggregator } from '@/shared/services/ErrorAggregator';
import type { OperationContext } from '@/shared/services/BaseService';
import { BaseService } from '@/shared/services/BaseService';
import { ErrorFactory } from '@/shared/errors/ErrorFactory';
import { ErrorMigration } from '@/shared/errors/ErrorMigration';
import { TimeoutError } from '@/shared/errors/TimeoutError';
import { ServiceError } from '@/shared/errors/ServiceError';
import {
  getRetryDelay,
  getCircuitBreakerConstant,
} from '@/shared/errors/ErrorConstants';
import { PerformanceService } from '@/features/storage/services/PerformanceService';

// Constants for database service
const SLOW_QUERY_THRESHOLD_MS = MONITORING_DEFAULTS.SLOW_QUERY_THRESHOLD_MS;

/**
 * Database Service
 *
 * Provides high-level database operations with connection pooling,
 * performance monitoring, and error handling.
 */
export class DatabaseService extends BaseService {
  private pool: EnhancedConnectionPool;
  private migrationManager?: MigrationManager;
  private maintenance?: DatabaseMaintenance;
  private performanceService?: PerformanceService;
  private stats: DatabaseStats;
  private config: DatabaseConfig;
  private logger = LogManager.getLogger('DatabaseService');
  private dbErrorAggregator: ErrorAggregator;
  private isInitialized = false;
  private isClosing = false;
  private lastErrorReportTime?: number;

  constructor(config: DatabaseConfig) {
    super({
      name: 'DatabaseService',
      timeout: config.connectionTimeout,
      enableRetry: true,
      enableTimeout: true,
      enableCircuitBreaker: true,
      circuitBreakerOptions: {
        failureThreshold: getCircuitBreakerConstant('FAILURE_THRESHOLD'),
        recoveryTimeout: getCircuitBreakerConstant('RECOVERY_TIMEOUT'),
        monitoringPeriod: getCircuitBreakerConstant('MONITORING_PERIOD'),
        successThreshold: getCircuitBreakerConstant('SUCCESS_THRESHOLD'),
        timeout: config.connectionTimeout,
      },
    });

    this.config = config;
    this.pool = new EnhancedConnectionPool(config);
    this.stats = this.initializeStats();
    this.dbErrorAggregator = new ErrorAggregator();
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug('Database service already initialized');
      return;
    }

    const startTime = Date.now();
    this.logger.info('Initializing database service', {
      operation: 'initialize',
      databasePath: this.config.path,
    });

    try {
      // Ensure database directory exists
      await this.ensureDatabaseDirectory();

      // Get a connection to initialize the database
      const db = await this.executeOperation(() => this.pool.getConnection(), {
        operation: 'database_initialize',
      });

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
          this.logger.error('Database migrations failed', undefined, {
            operation: 'initialize',
            failedMigrations: failedMigrations.length,
            migrationErrors: failedMigrations.map(r => ({
              name: r.name,
              error: r.error,
            })),
          });
          throw this.createDatabaseError(
            DatabaseErrorType.MIGRATION_FAILED,
            `Migration failed: ${failedMigrations.map(r => `${r.name}: ${r.error}`).join(', ')}`,
            { context: { migrationResults: failedMigrations } },
          );
        }

        this.isInitialized = true;
        const duration = Date.now() - startTime;
        this.logger.info('Database service initialized successfully', {
          operation: 'initialize',
          duration,
          migrationsRun: migrationResults.length,
        });
      } finally {
        this.pool.releaseConnection(db);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = error as Error;
      await this.dbErrorAggregator!.recordError(dbError, {
        service: 'database',
        operation: 'database_initialization',
      });
      logDatabaseError(this.logger, dbError, undefined, {
        operation: 'initialize',
        duration,
      });
      throw this.createDatabaseError(
        DatabaseErrorType.QUERY_FAILED,
        `Query failed: ${dbError.message}`,
        { original: dbError },
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

      const duration = Date.now() - startTime;
      this.updateQueryStats(duration, false);

      // Log mutation performance
      const context = createQueryPerformanceContext(
        query,
        duration,
        result.changes,
      );
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn('Slow mutation executed', context);
      } else {
        this.logger.debug('Mutation executed successfully', {
          ...context,
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateQueryStats(duration, true);

      const dbError = error as Error;
      await this.dbErrorAggregator!.recordError(dbError, {
        service: 'database',
        operation: 'database_execute_run',
      });
      logDatabaseError(this.logger, dbError, query, {
        operation: 'execute-run',
        duration,
        params: params.length,
      });

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
  executeQuery<T = unknown>(
    query: string,
    params: unknown[] = [],
    options: QueryOptions = {},
  ): Promise<T[]> {
    this.ensureInitialized();

    return this.executeOperation(
      async () => {
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

          const duration = Date.now() - startTime;
          this.updateQueryStats(duration, false);

          // Log query performance
          const context = createQueryPerformanceContext(
            query,
            duration,
            results.length,
          );
          if (duration > SLOW_QUERY_THRESHOLD_MS) {
            this.logger.warn('Slow query executed', context);
          } else {
            this.logger.debug('Query executed successfully', context);
          }

          return results;
        } catch (error) {
          const duration = Date.now() - startTime;
          this.updateQueryStats(duration, true);

          const dbError = error as Error;
          await this.dbErrorAggregator!.recordError(dbError, {
            service: 'database',
            operation: 'database_execute_query',
          });
          logDatabaseError(this.logger, dbError, query, {
            operation: 'execute-query',
            duration,
            params: params.length,
          });

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
      },
      {
        operation: 'database_execute_query',
        timeout: options.timeout,
      },
    );
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
          throw TimeoutError.operationTimeout('transaction', options.timeout!);
        }, options.timeout);
      }

      // Execute transaction with timeout handling
      const transaction = db.transaction(() => {
        if (timeoutHandle && options.timeout) {
          // Check if we've exceeded timeout during execution
          const elapsed = Date.now() - startTime;
          if (elapsed > options.timeout) {
            throw TimeoutError.operationTimeout(
              'transaction',
              options.timeout,
              elapsed,
            );
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

      // Record error in aggregator
      const dbError = error as Error;
      await this.dbErrorAggregator!.recordError(dbError, {
        service: 'database',
        operation: 'database_transaction',
      });

      // Check if it's a timeout error
      if (error instanceof TimeoutError) {
        // Add structured logging for timeout scenarios
        this.logger.warn('Transaction timeout occurred', {
          operation: 'execute_transaction',
          timeoutMs: error.getTimeoutMs(),
          actualDuration: error.getActualDuration(),
          operationType: error.getOperation(),
          duration: Date.now() - startTime,
        });

        throw this.createDatabaseError(
          DatabaseErrorType.TIMEOUT,
          `Transaction timeout: ${error.message}`,
          {
            original: error,
            context: {
              operation: 'transaction',
              timeoutMs: error.getTimeoutMs(),
              actualDuration: error.getActualDuration(),
            },
          },
        );
      }

      throw this.createDatabaseError(
        DatabaseErrorType.TRANSACTION_FAILED,
        (error as Error).message,
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

    if (!this.migrationManager) {
      throw ErrorFactory.service(
        'Migration manager not initialized',
        'MIGRATION_MANAGER_NOT_INITIALIZED',
        false,
      );
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
  override getStats(): DatabaseStats {
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
    const errorAlerts = this.checkCriticalAlerts();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const performance = {
      avgResponseTime: stats.queries.total > 0 ? stats.queries.avgTime : 0,
      connectionTime: 0, // Would need to measure this
    };

    // Determine overall health
    if (
      poolHealth.status === 'critical' ||
      stats.queries.failed > 0 ||
      errorAlerts.alerts.length > 0
    ) {
      status = 'unhealthy';
    } else if (
      poolHealth.status === 'warning' ||
      stats.queries.slow > 0 ||
      errorAlerts.warnings.length > 0
    ) {
      status = 'degraded';
    }

    // Log critical alerts
    if (errorAlerts.alerts.length > 0) {
      this.logger.error('Critical database alerts detected', undefined, {
        operation: 'health_check',
        alerts: errorAlerts.alerts,
        criticalErrors: errorAlerts.criticalErrors,
      });
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
    if (!this.migrationManager) {
      throw ErrorFactory.service(
        'Migration manager not initialized',
        'MIGRATION_MANAGER_NOT_INITIALIZED',
        false,
      );
    }
    return this.migrationManager;
  }

  /**
   * Get pending migrations count
   */
  getPendingMigrationsCount(): number {
    this.ensureInitialized();
    return this.migrationManager?.getPendingMigrations().length ?? 0;
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
   * Create a database error using ErrorFactory
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
    return ErrorFactory.database(type, message, {
      ...options,
      retryable: this.isRetryableError(type),
      retryAfter: this.getDefaultRetryDelay(type),
    }) as DatabaseError;
  }

  /**
   * Determine if a database error type is retryable
   */
  private isRetryableError(type: DatabaseErrorType): boolean {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
      case DatabaseErrorType.TIMEOUT:
      case DatabaseErrorType.QUERY_FAILED:
        return true;
      case DatabaseErrorType.CONSTRAINT_VIOLATION:
      case DatabaseErrorType.CORRUPTION:
      case DatabaseErrorType.PERMISSION_DENIED:
      case DatabaseErrorType.TRANSACTION_FAILED:
      case DatabaseErrorType.MIGRATION_FAILED:
        return false;
      default:
        return false;
    }
  }

  /**
   * Get default retry delay for a database error type
   */
  private getDefaultRetryDelay(type: DatabaseErrorType): number {
    switch (type) {
      case DatabaseErrorType.CONNECTION_FAILED:
        return getRetryDelay('EXTENDED'); // 10 seconds
      case DatabaseErrorType.TIMEOUT:
        return getRetryDelay('LONG'); // 5 seconds
      case DatabaseErrorType.QUERY_FAILED:
        return getRetryDelay('MEDIUM'); // 2 seconds
      case DatabaseErrorType.TRANSACTION_FAILED:
        return getRetryDelay('SHORT'); // 1 second
      default:
        return getRetryDelay('SHORT'); // 1 second
    }
  }

  /**
   * Log operation events for BaseService
   */
  protected async logOperation(
    event: 'success' | 'error' | 'retry',
    context: OperationContext,
    data: any,
  ): Promise<void> {
    const logger = LogManager.getLogger('DatabaseService');

    switch (event) {
      case 'success':
        logger.debug(`Operation completed: ${context.operation}`, {
          operation: context.operation,
          duration: data.duration,
        });
        break;
      case 'error':
        // Record error in aggregator for monitoring
        if (data.error) {
          await this.dbErrorAggregator!.recordError(data.error, {
            service: 'database',
            operation: `operation_${context.operation}`,
          });
        }
        logger.error(`Operation failed: ${context.operation}`, data.error, {
          operation: context.operation,
          duration: data.duration,
          attempt: context.attempt,
        });
        break;
      case 'retry':
        logger.warn(`Retrying operation: ${context.operation}`, {
          operation: context.operation,
          attempt: context.attempt,
          delay: data.delay,
          error: data.error?.message,
        });
        break;
      default:
        logger.error(`Unknown operation event: ${event}`);
        break;
    }

    return Promise.resolve();
  }

  /**
   * Handle service shutdown
   */
  protected async onShutdown(): Promise<void> {
    const logger = LogManager.getLogger('DatabaseService');
    logger.info('Shutting down database service');

    await this.gracefulShutdown();
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
   * Get error rate monitoring data
   */
  getErrorRateMonitoring(minutes: number = 5): {
    errorsPerMinute: number;
    totalErrors: number;
    errorTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const errorRate = this.dbErrorAggregator!.getErrorRate(
      'database',
      undefined,
      minutes,
    );
    const stats = this.dbErrorAggregator!.getErrorStatistics();

    // Transform to expected format
    return {
      errorsPerMinute: errorRate.errorRate,
      totalErrors: errorRate.totalErrors,
      errorTypes: stats.mostFrequentError
        ? [
            {
              type: stats.mostFrequentError.type,
              count: stats.mostFrequentError.count,
              percentage:
                stats.totalErrors > 0
                  ? (stats.mostFrequentError.count / stats.totalErrors) * 100
                  : 0,
            },
          ]
        : [],
      trend: 'stable', // Simplified - could be enhanced with trend analysis
    };
  }

  /**
   * Check for critical database failures and generate alerts
   */
  checkCriticalAlerts(): {
    alerts: string[];
    warnings: string[];
    criticalErrors: string[];
  } {
    const alerts: string[] = [];
    const warnings: string[] = [];
    const criticalErrors: string[] = [];

    // Get error statistics
    const errorStats = this.dbErrorAggregator!.getErrorStatistics();

    // Check error rate thresholds
    const errorRate = errorStats.errorRate;
    if (errorRate > 10) {
      // More than 10 errors per minute
      alerts.push(
        `Critical: Database error rate (${errorRate.toFixed(2)}/min) exceeds threshold`,
      );
      criticalErrors.push('high_error_rate');
    } else if (errorRate > 5) {
      // More than 5 errors per minute
      warnings.push(
        `Warning: Database error rate (${errorRate.toFixed(2)}/min) is elevated`,
      );
    }

    // Check for critical error count threshold
    if (errorStats.criticalErrors > 5) {
      alerts.push(
        `Critical: High number of critical database errors (${errorStats.criticalErrors})`,
      );
      criticalErrors.push('high_critical_error_count');
    } else if (errorStats.criticalErrors > 2) {
      warnings.push(
        `Warning: Elevated critical database errors (${errorStats.criticalErrors})`,
      );
    }

    // Check performance impact
    const stats = this.dbErrorAggregator!.getErrorStatistics();
    const performanceImpact = {
      highImpactErrors: stats.criticalErrors > 5 ? ['critical_errors'] : [],
      mediumImpactErrors: stats.errorRate > 2 ? ['high_error_rate'] : [],
      lowImpactErrors: stats.errorRate > 0.5 ? ['moderate_error_rate'] : [],
      overallImpact:
        stats.criticalErrors > 5
          ? ('critical' as const)
          : stats.errorRate > 2
            ? ('high' as const)
            : stats.errorRate > 0.5
              ? ('medium' as const)
              : ('low' as const),
    };
    if (performanceImpact.overallImpact === 'critical') {
      alerts.push('Critical: Database errors severely impacting performance');
      criticalErrors.push('performance_impact_critical');
    } else if (performanceImpact.overallImpact === 'high') {
      warnings.push(
        'Warning: Database errors significantly impacting performance',
      );
    }

    return { alerts, warnings, criticalErrors };
  }

  /**
   * Log aggregated error report
   */
  async logErrorReport(): Promise<void> {
    await this.dbErrorAggregator!.logStatistics(this.logger);
  }

  /**
   * Perform periodic error monitoring and alerting
   * This method should be called periodically (e.g., every 5 minutes) by monitoring systems
   */
  performErrorMonitoring(): {
    errorRate: number;
    alertsTriggered: number;
    warningsTriggered: number;
    criticalErrors: string[];
  } {
    const errorRateData = this.getErrorRateMonitoring(5); // Last 5 minutes
    const alerts = this.checkCriticalAlerts();

    // Log alerts if any
    if (alerts.alerts.length > 0 || alerts.warnings.length > 0) {
      this.logger.warn('Database error monitoring check', {
        operation: 'error_monitoring',
        errorRate: errorRateData.errorsPerMinute,
        alertsCount: alerts.alerts.length,
        warningsCount: alerts.warnings.length,
        criticalErrors: alerts.criticalErrors,
        trend: errorRateData.trend,
      });
    }

    // Log periodic error report every hour (when called)
    const now = Date.now();
    if (
      !this.lastErrorReportTime ||
      now - this.lastErrorReportTime > 60 * 60 * 1000
    ) {
      this.logErrorReport().catch(error => {
        this.logger.error('Failed to log error report', error, {
          operation: 'error_monitoring',
        });
      });
      this.lastErrorReportTime = now;
    }

    return {
      errorRate: errorRateData.errorsPerMinute,
      alertsTriggered: alerts.alerts.length,
      warningsTriggered: alerts.warnings.length,
      criticalErrors: alerts.criticalErrors,
    };
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

  /**
   * Migrate legacy errors to ServiceError format
   * Useful for handling errors from external dependencies that may not use ServiceError
   */
  private migrateLegacyError(error: Error, operation?: string): ServiceError {
    const migrationResult = ErrorMigration.migrateError(error, operation);

    if (migrationResult.wasLegacy) {
      this.logger.debug('Migrated legacy error to ServiceError', {
        operation: operation ?? 'unknown',
        originalType: migrationResult.originalType,
        migrationPath: migrationResult.migrationPath,
      });
    }

    return migrationResult.migrated;
  }

  /**
   * Enhanced error handling wrapper for operations that might throw legacy errors
   * Automatically migrates any non-ServiceError exceptions to ServiceError format
   */
  protected async executeOperationWithMigration<T>(
    operation: () => Promise<T>,
    context: {
      operation: string;
      timeout?: number;
      description?: string;
    },
  ): Promise<T> {
    try {
      return await this.executeOperation(operation, context);
    } catch (error) {
      // If it's already a ServiceError, re-throw as-is
      if (error instanceof ServiceError) {
        throw error;
      }

      // Migrate legacy error and re-throw
      const migratedError = this.migrateLegacyError(
        error as Error,
        context.operation,
      );
      throw migratedError;
    }
  }

  /**
   * Batch migrate multiple errors from external operations
   * Useful for processing multiple errors from batch operations
   */
  private migrateBatchErrors(
    errors: Error[],
    operation: string,
  ): ServiceError[] {
    if (errors.length === 0) {
      return [];
    }

    const migrationResults = ErrorMigration.migrateErrors(errors, operation);

    if (migrationResults.statistics.migratedErrors > 0) {
      this.logger.info('Batch migrated legacy errors', {
        operation,
        totalErrors: migrationResults.statistics.totalErrors,
        migratedErrors: migrationResults.statistics.migratedErrors,
        migrationRate: migrationResults.statistics.migrationRate,
      });
    }

    return migrationResults.results.map(result => result.migrated);
  }
}
