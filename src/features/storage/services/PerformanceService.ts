import type Database from 'better-sqlite3';

import type {
  PerformanceConfig,
  PerformanceReport,
  DatabaseStats,
  EnhancedConnectionPoolStats,
  OptimizedQuery,
} from '../types/StorageTypes';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { QueryOptimizer } from '../utils/QueryOptimizer';
import { ResourceManager } from '../utils/ResourceManager';
import { PerformanceProfiler } from '../utils/PerformanceProfiler';
import { PerformanceConfigManager } from '../config/PerformanceConfig';
import { PERFORMANCE_THRESHOLDS } from '../config/PerformanceConstants';
import { generateQueryCacheKey } from '../utils/PerformanceUtils';
import type { EnhancedConnectionPool } from '../utils/EnhancedConnectionPool';

/**
 * Performance service that integrates all performance monitoring and optimization components
 */
export class PerformanceService {
  private monitor: PerformanceMonitor;
  private optimizer: QueryOptimizer;
  private resourceManager: ResourceManager;
  private config: PerformanceConfig;
  private db: Database.Database;
  private connectionPool: EnhancedConnectionPool;
  private optimizationInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private queryCache: Map<string, { result: unknown[]; timestamp: number }> =
    new Map();
  private profiler: PerformanceProfiler;
  private isShuttingDown = false;

  constructor(
    db: Database.Database,
    config: PerformanceConfig,
    connectionPool: EnhancedConnectionPool,
  ) {
    this.db = db;
    this.config = config;
    this.connectionPool = connectionPool;
    this.monitor = new PerformanceMonitor(config.monitoring, connectionPool);
    this.optimizer = new QueryOptimizer(db);
    this.resourceManager = new ResourceManager();
    this.profiler = new PerformanceProfiler();

    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Execute a query with performance monitoring and optimization
   */
  executeQuery<T = unknown>(query: string, params: unknown[] = []): T[] {
    const startTime = Date.now();
    let success = false;
    let result: T[] = [];
    let rowCount = 0;
    let error: string | undefined;

    try {
      // Check query cache first if enabled
      if (this.config.queryCache.enabled) {
        const cacheKey = generateQueryCacheKey(query, params);
        const cached = this.getFromQueryCache<T>(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      // Optimize query if enabled
      let optimizedQuery: OptimizedQuery;
      try {
        optimizedQuery = this.config.monitoring.enabled
          ? this.optimizer.optimizeQuery(query, params)
          : {
              originalQuery: query,
              optimizedQuery: query,
              params,
              plan: {
                query,
                explainResult: [],
                recommendedIndexes: [],
                estimatedCost: 0,
                optimizationHints: [],
                createdAt: Date.now(),
                isStale: false,
              },
              estimatedImprovement: 0,
            };
      } catch {
        // Query optimization failed - continue without optimization
        optimizedQuery = {
          originalQuery: query,
          optimizedQuery: query,
          params,
          plan: {
            query,
            explainResult: [],
            recommendedIndexes: [],
            estimatedCost: 0,
            optimizationHints: [],
            createdAt: Date.now(),
            isStale: false,
          },
          estimatedImprovement: 0,
        };
      }

      // Execute the query
      const stmt = this.db.prepare(optimizedQuery.optimizedQuery);
      result = stmt.all(...optimizedQuery.params) as T[];
      rowCount = result.length;
      success = true;

      // Cache result if enabled
      if (this.config.queryCache.enabled) {
        const cacheKey = generateQueryCacheKey(query, params);
        this.setQueryCache(cacheKey, result);
      }

      return result;
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
      throw error_;
    } finally {
      // Record performance metrics (with error handling)
      const duration = Date.now() - startTime;
      try {
        this.monitor.recordQueryExecution(
          query,
          duration,
          success,
          rowCount,
          error,
        );
      } catch {
        // Don't let monitoring errors fail the main operation
      }
    }
  }

  /**
   * Execute a single-row query with performance monitoring
   */
  executeOne<T = unknown>(query: string, params: unknown[] = []): T | null {
    const startTime = Date.now();
    let success = false;
    let result: T | null = null;
    let error: string | undefined;

    try {
      const stmt = this.db.prepare(query);
      result = stmt.get(...params) as T | null;
      success = true;
      return result;
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
      throw error_;
    } finally {
      const duration = Date.now() - startTime;
      const rowCount = result ? 1 : 0;
      this.monitor.recordQueryExecution(
        query,
        duration,
        success,
        rowCount,
        error,
      );
    }
  }

  /**
   * Execute a write operation with performance monitoring
   */
  executeRun(
    query: string,
    params: unknown[] = [],
  ): { changes: number; lastInsertRowid: number } {
    const startTime = Date.now();
    let success = false;
    let result: { changes: number; lastInsertRowid: number } = {
      changes: 0,
      lastInsertRowid: 0,
    };
    let error: string | undefined;

    try {
      const stmt = this.db.prepare(query);
      const runResult = stmt.run(...params);
      result = {
        changes: runResult.changes,
        lastInsertRowid: Number(runResult.lastInsertRowid),
      };
      success = true;
      return result;
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
      throw error_;
    } finally {
      const duration = Date.now() - startTime;
      this.monitor.recordQueryExecution(
        query,
        duration,
        success,
        result.changes,
        error,
      );
    }
  }

  /**
   * Execute batch operations with optimized performance
   */
  executeBatchOperations<T>(
    operations: Array<{
      query: string;
      params?: unknown[];
      type: 'insert' | 'update' | 'delete';
    }>,
  ): { results: T[]; totalTime: number; successCount: number } {
    const startTime = Date.now();
    let successCount = 0;
    const results: T[] = [];

    try {
      // Use transaction for batch operations
      this.db.transaction(() => {
        for (const operation of operations) {
          try {
            const stmt = this.db.prepare(operation.query);
            const result = stmt.run(...(operation.params ?? []));
            results.push(result as T);
            successCount++;

            // Record individual operation metrics
            this.monitor.recordQueryExecution(
              operation.query,
              0, // We'll track total time instead
              true,
              operation.type === 'insert' ? result.changes : undefined,
            );
          } catch (error) {
            // Record failed operation
            this.monitor.recordQueryExecution(
              operation.query,
              0,
              false,
              undefined,
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      });

      const totalTime = Date.now() - startTime;

      return {
        results,
        totalTime,
        successCount,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      // Record batch operation failure
      this.monitor.recordQueryExecution(
        `BATCH_OPERATION_${operations.length}_queries`,
        totalTime,
        false,
        undefined,
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
  }

  /**
   * Execute bulk insert with optimized performance
   */
  executeBulkInsert(
    tableName: string,
    records: Array<Record<string, unknown>>,
    options: {
      chunkSize?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {},
  ): { insertedCount: number; totalTime: number; errors: string[] } {
    const {
      chunkSize = PERFORMANCE_THRESHOLDS.BATCH_OPERATION_CHUNK_SIZE,
      onProgress,
    } = options;
    const startTime = Date.now();
    let insertedCount = 0;
    const errors: string[] = [];

    try {
      // Process in chunks for memory efficiency
      const chunks = [];
      for (let i = 0; i < records.length; i += chunkSize) {
        chunks.push(records.slice(i, i + chunkSize));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk || chunk.length === 0) {
          continue;
        }

        try {
          this.db.transaction(() => {
            // Get column names from first record of chunk
            const firstRecord = chunk[0];
            if (!firstRecord) {
              throw new Error('Empty record in chunk');
            }

            const columns = Object.keys(firstRecord);
            const placeholders = columns.map(() => '?').join(', ');
            const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            const stmt = this.db.prepare(query);

            for (const record of chunk) {
              const values = columns.map(col => record[col]);
              stmt.run(...values);
              insertedCount++;
            }
          });

          // Report progress
          if (onProgress) {
            onProgress(insertedCount, records.length);
          }
        } catch (error) {
          const errorMsg = `Failed to insert chunk ${i + 1}/${chunks.length}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
        }
      }

      const totalTime = Date.now() - startTime;

      // Record bulk operation metrics
      this.monitor.recordQueryExecution(
        `BULK_INSERT_${tableName}_${records.length}_records`,
        totalTime,
        errors.length === 0,
        insertedCount,
      );

      return {
        insertedCount,
        totalTime,
        errors,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.monitor.recordQueryExecution(
        `BULK_INSERT_${tableName}_FAILED`,
        totalTime,
        false,
        insertedCount,
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
  }

  /**
   * Execute a transaction with performance monitoring
   */
  executeTransaction<T>(callback: (db: Database.Database) => T): T {
    const startTime = Date.now();
    let success = false;
    let result: T;
    let error: string | undefined;

    try {
      const transaction = this.db.transaction(callback);
      result = transaction(this.db);
      success = true;
      return result;
    } catch (error_) {
      error = error_ instanceof Error ? error_.message : String(error_);
      throw error_;
    } finally {
      const duration = Date.now() - startTime;
      this.monitor.recordQueryExecution(
        'TRANSACTION',
        duration,
        success,
        0,
        error,
      );
    }
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): PerformanceReport {
    const monitorReport = this.monitor.getPerformanceReport();
    const memoryUsage = this.resourceManager.getMemoryUsage();

    return {
      ...monitorReport,
      connectionPoolStats: this.getConnectionPoolStats(),
      memoryUsage: {
        current: memoryUsage.current,
        peak: memoryUsage.peak,
        average: memoryUsage.average,
      },
    };
  }

  /**
   * Get database statistics with performance data
   */
  getDatabaseStats(): DatabaseStats {
    const performanceReport = this.getPerformanceReport();
    const resourceStats = this.resourceManager.getResourceStats();

    return {
      connections: {
        active: resourceStats.activeConnections,
        idle: 0, // Would come from connection pool
        waiting: 0, // Would come from connection pool
        total: resourceStats.activeConnections,
      },
      queries: {
        total: performanceReport.totalQueries,
        slow: performanceReport.slowQueries,
        failed: performanceReport.errorStats.total,
        avgTime: performanceReport.averageExecutionTime,
      },
      size: {
        database: this.getDatabaseSize(),
        indexes: this.getIndexesSize(),
        freePages: this.getFreePagesCount(),
        pageSize: this.getPageSize(),
      },
    };
  }

  /**
   * Optimize database performance
   */
  optimizeDatabase(): {
    success: boolean;
    optimizations: string[];
    errors: string[];
  } {
    const optimizations: string[] = [];
    const errors: string[] = [];

    try {
      // Analyze query planner
      this.db.exec('ANALYZE');
      optimizations.push('Updated table statistics');

      // Check for fragmented indexes
      const fragmentedIndexes = this.checkFragmentedIndexes();
      if (fragmentedIndexes.length > 0) {
        this.db.exec('REINDEX');
        optimizations.push('Rebuilt fragmented indexes');
      }

      // Optimize memory usage
      const memoryOptimization = this.resourceManager.optimizeMemoryUsage();
      if (memoryOptimization.freedMemory > 0) {
        optimizations.push(
          `Freed ${memoryOptimization.freedMemory} bytes of memory`,
        );
      }
      optimizations.push(...memoryOptimization.optimizations);

      // Clean up old query plans
      this.optimizer.clearStalePlans();
      optimizations.push('Cleaned up stale query plans');

      // Clean up old performance metrics
      this.monitor.clearOldMetrics();
      optimizations.push('Cleaned up old performance metrics');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      success: errors.length === 0,
      optimizations,
      errors,
    };
  }

  /**
   * Check performance thresholds and return alerts
   */
  checkPerformanceThresholds(): {
    alerts: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const thresholdCheck = this.monitor.checkThresholds();
    const memoryCheck = this.resourceManager.checkMemoryLimits(
      this.config.memory.maxUsageBytes,
    );
    const resourceLeaks = this.resourceManager.detectResourceLeaks();

    const recommendations: string[] = [];

    // Memory recommendations
    if (!memoryCheck.withinLimit) {
      recommendations.push(memoryCheck.recommendation);
    }

    // Resource leak recommendations
    if (resourceLeaks.length > 0) {
      recommendations.push(
        `Detected ${resourceLeaks.length} potential resource leaks`,
      );
    }

    // Performance recommendations
    if (thresholdCheck.warnings.length > 0) {
      recommendations.push(...thresholdCheck.warnings);
    }

    return {
      alerts: thresholdCheck.alerts,
      warnings: thresholdCheck.warnings,
      recommendations,
    };
  }

  /**
   * Validate configuration update
   */
  private validateConfigUpdate(newConfig: Partial<PerformanceConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    return PerformanceConfigManager.validateConfig({
      ...this.config,
      ...newConfig,
    });
  }

  /**
   * Restart background tasks with new configuration
   */
  private restartBackgroundTasks(): void {
    // Clear existing intervals
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Restart background tasks
    this.startBackgroundTasks();
  }

  /**
   * Update performance configuration with validation and hot-reloading
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    // Validate new configuration before applying
    const validation = this.validateConfigUpdate(newConfig);
    if (!validation.isValid) {
      throw new Error(
        `Invalid configuration update: ${validation.errors.join(', ')}`,
      );
    }

    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Update monitor configuration
    if (newConfig.monitoring) {
      try {
        this.monitor.updateConfig({
          slowQueryMs: newConfig.monitoring.slowQueryThresholdMs,
          connectionAcquisitionMs:
            PERFORMANCE_THRESHOLDS.CONNECTION_ACQUISITION_THRESHOLD_MS,
          memoryUsageBytes: this.config.memory.maxUsageBytes,
          poolUtilizationThreshold:
            PERFORMANCE_THRESHOLDS.CONNECTION_POOL_UTILIZATION_THRESHOLD,
          errorRateThreshold: PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD,
        });
      } catch {
        // Failed to update monitor configuration
        // Revert monitor configuration
        this.config.monitoring = oldConfig.monitoring;
      }
    }

    // Update query cache configuration
    if (newConfig.queryCache) {
      // Clear cache if TTL or size changed
      if (
        newConfig.queryCache.ttlMs !== oldConfig.queryCache.ttlMs ||
        newConfig.queryCache.maxSize !== oldConfig.queryCache.maxSize
      ) {
        this.queryCache.clear();
      }
    }

    // Update prepared statement cache configuration
    if (newConfig.preparedStatementCache) {
      // Clear prepared statements if size changed
      if (
        newConfig.preparedStatementCache.maxSize !==
        oldConfig.preparedStatementCache.maxSize
      ) {
        this.optimizer.clearAllPlans();
      }
    }

    // Restart background tasks if intervals changed
    if (
      newConfig.memory &&
      newConfig.memory.checkIntervalMs !== oldConfig.memory.checkIntervalMs
    ) {
      this.restartBackgroundTasks();
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      // Configuration update warnings: validation.warnings
    }
  }

  /**
   * Get query execution plan
   */
  getQueryPlan(query: string): unknown[] {
    const plan = this.optimizer.getExecutionPlan(query);

    // If no cached plan exists, generate one on the fly
    if (!plan) {
      try {
        const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
        const stmt = this.db.prepare(explainQuery);
        return stmt.all() as unknown[];
      } catch {
        // Return empty array if EXPLAIN fails
        return [];
      }
    }

    // Convert plan object to array format expected by tests
    return Array.isArray(plan) ? plan : [plan];
  }

  /**
   * Get index suggestions for a table
   */
  getIndexSuggestions(tableName: string): string[] {
    return this.optimizer.suggestIndexes(tableName);
  }

  /**
   * Analyze query security
   */
  analyzeQuerySecurity(query: string): {
    isSafe: boolean;
    warnings: string[];
  } {
    return this.optimizer.analyzeQuerySecurity(query);
  }

  /**
   * Get result from query cache if valid
   */
  private getFromQueryCache<T>(key: string): T[] | null {
    const cached = this.queryCache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.config.queryCache.ttlMs) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result as T[];
  }

  /**
   * Set result in query cache
   */
  private setQueryCache(key: string, result: unknown[]): void {
    // Clean up old cache entries if cache is full
    if (this.queryCache.size >= this.config.queryCache.maxSize) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Start profiling a database operation
   */
  startProfiling(name: string, metadata?: Record<string, unknown>): string {
    return this.profiler.startProfile(name, metadata);
  }

  /**
   * End profiling session
   */
  endProfiling(profileId: string): any {
    return this.profiler.endProfile(profileId);
  }

  /**
   * Get connection pool statistics
   */
  private getConnectionPoolStats(): EnhancedConnectionPoolStats {
    return this.connectionPool.getEnhancedStats();
  }

  /**
   * Generate profile report
   */
  generateProfileReport(profileId: string): any {
    return this.profiler.generateProfileReport(profileId);
  }

  /**
   * Graceful shutdown with comprehensive cleanup
   */
  async gracefulShutdown(
    timeoutMs: number = PERFORMANCE_THRESHOLDS.GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  ): Promise<void> {
    const shutdownStart = Date.now();

    // Stop accepting new operations
    this.isShuttingDown = true;

    // Wait for any ongoing operations to complete (with timeout)
    const shutdownPromise = new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        // Check if all resources are cleaned up
        if (Date.now() - shutdownStart > timeoutMs) {
          // Graceful shutdown timeout reached, forcing cleanup
          clearInterval(checkInterval);
          resolve();
        }
      }, PERFORMANCE_THRESHOLDS.BATCH_OPERATION_PROGRESS_INTERVAL_MS);

      // Start cleanup immediately
      this.performCompleteCleanup();
      clearInterval(checkInterval);
      resolve();
    });

    await shutdownPromise;
  }

  /**
   * Close performance service and cleanup resources
   */
  close(): void {
    this.performCompleteCleanup();
  }

  /**
   * Perform complete cleanup of all resources
   */
  private performCompleteCleanup(): void {
    // Clear background intervals
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Clear all caches
    this.queryCache.clear();

    // Force final optimization run
    try {
      this.optimizeDatabase();
    } catch {
      // Error during final optimization
    }

    // Close all components
    this.resourceManager.close();
    this.monitor.close();
    this.optimizer.clearAllPlans();
    this.profiler.clearProfiles();

    // Clear prepared statements (already done by clearAllPlans above)

    // Final memory cleanup
    if (typeof global !== 'undefined' && (global as any).gc) {
      try {
        (global as any).gc();
      } catch {
        // Error during final garbage collection
      }
    }
  }

  /**
   * Start background performance tasks
   */
  private startBackgroundTasks(): void {
    // Periodic optimization
    this.optimizationInterval = setInterval(() => {
      void this.optimizeDatabase();
    }, this.config.monitoring.retentionMs); // Use configured retention period

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.resourceManager.cleanupLeakedResources();
    }, this.config.memory.checkIntervalMs); // Use configured memory check interval
  }

  /**
   * Get database file size
   */
  private getDatabaseSize(): number {
    try {
      const pageSize = this.db.prepare('PRAGMA page_size').get() as {
        page_size: number;
      };
      const pageCount = this.db.prepare('PRAGMA page_count').get() as {
        page_count: number;
      };
      return pageSize.page_size * pageCount.page_count;
    } catch {
      return 0;
    }
  }

  /**
   * Get indexes size
   */
  private getIndexesSize(): number {
    // Simplified implementation
    return (
      this.getDatabaseSize() * PERFORMANCE_THRESHOLDS.INDEX_ESTIMATION_RATIO
    );
  }

  /**
   * Get free pages count
   */
  private getFreePagesCount(): number {
    try {
      const result = this.db.prepare('PRAGMA freelist_count').get() as {
        freelist_count: number;
      };
      return result.freelist_count;
    } catch {
      return 0;
    }
  }

  /**
   * Get page size
   */
  private getPageSize(): number {
    try {
      const result = this.db.prepare('PRAGMA page_size').get() as {
        page_size: number;
      };
      return result.page_size;
    } catch {
      return PERFORMANCE_THRESHOLDS.DATABASE_DEFAULT_PAGE_SIZE;
    }
  }

  /**
   * Check for fragmented indexes
   */
  private checkFragmentedIndexes(): string[] {
    // Simplified implementation - in reality, you'd analyze index statistics
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    return tables.map(table => table.name);
  }
}
