import type {
  QueryMetrics,
  SlowQueryLog,
  PerformanceThresholds,
  PerformanceReport,
  PerformanceConfig,
} from '../types/StorageTypes';
import { PERFORMANCE_THRESHOLDS } from '../config/PerformanceConstants';

import { hashQuery } from './PerformanceUtils';
import { memoryUtils } from './MemoryUtils';
import type { EnhancedConnectionPool } from './EnhancedConnectionPool';

/**
 * Performance monitoring and metrics collection for database operations
 */
export class PerformanceMonitor {
  private queryMetrics: Map<string, QueryMetrics> = new Map();
  private slowQueries: SlowQueryLog[] = [];
  private alertThresholds: PerformanceThresholds;
  private config: PerformanceConfig['monitoring'];
  private connectionPool?: EnhancedConnectionPool;
  private startTime = Date.now();
  private totalQueries = 0;
  private totalErrors = 0;
  private totalExecutionTime = 0;

  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    config: PerformanceConfig['monitoring'],
    connectionPool?: EnhancedConnectionPool,
  ) {
    this.config = config;
    this.connectionPool = connectionPool;
    this.alertThresholds = {
      slowQueryMs: config.slowQueryThresholdMs,
      connectionAcquisitionMs:
        PERFORMANCE_THRESHOLDS.CONNECTION_ACQUISITION_THRESHOLD_MS,
      memoryUsageBytes: PERFORMANCE_THRESHOLDS.MEMORY_USAGE_THRESHOLD_BYTES,
      poolUtilizationThreshold:
        PERFORMANCE_THRESHOLDS.CONNECTION_POOL_UTILIZATION_THRESHOLD,
      errorRateThreshold: PERFORMANCE_THRESHOLDS.ERROR_RATE_THRESHOLD,
    };

    // Start cleanup interval for old metrics
    this.startCleanupInterval();
  }

  /**
   * Record query execution metrics
   */
  recordQueryExecution(
    query: string,
    duration: number,
    success: boolean,
    rowCount?: number,
    error?: string,
  ): void {
    const queryHash = hashQuery(query);
    const metrics =
      this.queryMetrics.get(queryHash) ??
      this.createQueryMetrics(queryHash, query);

    // Update metrics
    metrics.executionCount++;
    metrics.totalExecutionTime += duration;
    metrics.avgExecutionTime =
      metrics.totalExecutionTime / metrics.executionCount;
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime, duration);
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, duration);
    metrics.lastExecution = Date.now();

    if (success) {
      metrics.successCount++;
      if (rowCount !== undefined) {
        // Update average rows returned
        const totalRows =
          metrics.avgRowsReturned * (metrics.successCount - 1) + rowCount;
        metrics.avgRowsReturned = totalRows / metrics.successCount;
      }
    } else {
      metrics.failureCount++;
      this.totalErrors++;
    }

    this.queryMetrics.set(queryHash, metrics);
    this.totalQueries++;
    this.totalExecutionTime += duration;

    // Check for slow query
    if (duration > this.alertThresholds.slowQueryMs) {
      this.logSlowQuery(query, duration, rowCount, error);
    }

    // Update memory usage tracking
    this.updateMemoryUsage();
  }

  /**
   * Record connection acquisition time
   */
  recordConnectionAcquisition(acquisitionTime: number): void {
    if (acquisitionTime > this.alertThresholds.connectionAcquisitionMs) {
      // Remove console statement - use proper logging
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    const avgExecutionTime =
      this.totalQueries > 0 ? this.totalExecutionTime / this.totalQueries : 0;
    const errorRate =
      this.totalQueries > 0 ? this.totalErrors / this.totalQueries : 0;

    return {
      totalQueries: this.totalQueries,
      averageExecutionTime: avgExecutionTime,
      slowQueries: this.slowQueries.length,
      topSlowQueries: this.getTopSlowQueries(
        PERFORMANCE_THRESHOLDS.TOP_SLOW_QUERIES_LIMIT,
      ),
      connectionPoolStats: this.connectionPool
        ? this.connectionPool.getEnhancedStats()
        : {
            created: 0,
            acquired: 0,
            released: 0,
            destroyed: 0,
            size: 0,
            available: 0,
            waiting: 0,
            health: { healthy: 0, unhealthy: 0, validating: 0 },
            performance: {
              avgAcquisitionTime: 0,
              peakAcquisitionTime: 0,
              totalWaitTime: 0,
              reuseRate: 0,
            },
            resources: {
              memoryUsage: 0,
              fileDescriptors: 0,
              idleTimeouts: 0,
            },
          },
      memoryUsage: {
        current: memoryUtils.getCurrentMemoryUsage(),
        peak: memoryUtils.getMemoryStats().peak,
        average: memoryUtils.getAverageMemoryUsage(),
      },
      errorStats: {
        total: this.totalErrors,
        rate: errorRate,
        commonErrors: this.getCommonErrors(),
      },
    };
  }

  /**
   * Get metrics for a specific query
   */
  getQueryMetrics(query: string): QueryMetrics | undefined {
    const queryHash = hashQuery(query);
    return this.queryMetrics.get(queryHash);
  }

  /**
   * Get all slow queries
   */
  getSlowQueries(): SlowQueryLog[] {
    return [...this.slowQueries];
  }

  /**
   * Clear old metrics based on retention policy
   */
  clearOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionMs;

    // Clear old query metrics
    for (const [hash, metrics] of this.queryMetrics.entries()) {
      if (metrics.lastExecution < cutoffTime) {
        this.queryMetrics.delete(hash);
      }
    }

    // Clear old slow queries
    this.slowQueries = this.slowQueries.filter(
      query => query.timestamp > cutoffTime,
    );
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.queryMetrics.clear();
    this.slowQueries = [];
    this.totalQueries = 0;
    this.totalErrors = 0;
    this.totalExecutionTime = 0;
    this.startTime = Date.now();

    // Clear cleanup interval if it exists
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      // Restart cleanup interval
      this.startCleanupInterval();
    }
  }

  /**
   * Check if performance thresholds are exceeded
   */
  checkThresholds(): {
    alerts: string[];
    warnings: string[];
  } {
    const alerts: string[] = [];
    const warnings: string[] = [];

    const avgExecutionTime =
      this.totalQueries > 0 ? this.totalExecutionTime / this.totalQueries : 0;
    const errorRate =
      this.totalQueries > 0 ? this.totalErrors / this.totalQueries : 0;
    const currentMemoryUsage = memoryUtils.getCurrentMemoryUsage();

    // Check average execution time
    if (avgExecutionTime > this.alertThresholds.slowQueryMs * 2) {
      alerts.push(
        `Average execution time (${avgExecutionTime.toFixed(2)}ms) exceeds critical threshold`,
      );
    } else if (avgExecutionTime > this.alertThresholds.slowQueryMs) {
      warnings.push(
        `Average execution time (${avgExecutionTime.toFixed(2)}ms) exceeds warning threshold`,
      );
    }

    // Check error rate
    if (errorRate > this.alertThresholds.errorRateThreshold * 2) {
      alerts.push(
        `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds critical threshold`,
      );
    } else if (errorRate > this.alertThresholds.errorRateThreshold) {
      warnings.push(
        `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds warning threshold`,
      );
    }

    // Check memory usage
    if (currentMemoryUsage > this.alertThresholds.memoryUsageBytes) {
      alerts.push(
        `Memory usage (${memoryUtils.formatBytes(currentMemoryUsage)}) exceeds threshold`,
      );
    }

    // Check slow query rate
    const slowQueryRate =
      this.totalQueries > 0 ? this.slowQueries.length / this.totalQueries : 0;
    if (slowQueryRate > PERFORMANCE_THRESHOLDS.SLOW_QUERY_RATE_THRESHOLD) {
      warnings.push(
        `Slow query rate (${(slowQueryRate * 100).toFixed(2)}%) is high`,
      );
    }

    return { alerts, warnings };
  }

  /**
   * Create query metrics object
   */
  private createQueryMetrics(_queryHash: string, _query: string): QueryMetrics {
    return {
      queryHash: _queryHash,
      executionCount: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      minExecutionTime: Number.MAX_VALUE,
      maxExecutionTime: 0,
      successCount: 0,
      failureCount: 0,
      avgRowsReturned: 0,
      lastExecution: Date.now(),
    };
  }

  /**
   * Log slow query
   */
  private logSlowQuery(
    query: string,
    duration: number,
    rowCount?: number,
    error?: string,
  ): void {
    const queryHash = hashQuery(query);
    const slowQuery: SlowQueryLog = {
      queryHash,
      query,
      executionTime: duration,
      timestamp: Date.now(),
      rowCount,
      error,
    };

    this.slowQueries.push(slowQuery);

    // Keep only recent slow queries
    if (
      this.slowQueries.length > PERFORMANCE_THRESHOLDS.MAX_SLOW_QUERIES_STORED
    ) {
      this.slowQueries = this.slowQueries.slice(
        -PERFORMANCE_THRESHOLDS.MAX_SLOW_QUERIES_STORED,
      );
    }

    // Remove console statement - use proper logging
  }

  /**
   * Get top slow queries
   */
  private getTopSlowQueries(
    limit: number = PERFORMANCE_THRESHOLDS.TOP_SLOW_QUERIES_LIMIT,
  ): SlowQueryLog[] {
    return this.slowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get common errors
   */
  private getCommonErrors(): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>();

    for (const query of this.slowQueries) {
      if (query.error) {
        const count = errorCounts.get(query.error) ?? 0;
        errorCounts.set(query.error, count + 1);
      }
    }

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, PERFORMANCE_THRESHOLDS.COMMON_ERRORS_LIMIT);
  }

  /**
   * Update memory usage tracking
   */
  private updateMemoryUsage(): void {
    memoryUtils.takeSnapshot();
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up old metrics based on configured retention period
    this.cleanupInterval = setInterval(() => {
      this.clearOldMetrics();
    }, this.config.retentionMs);
  }

  /**
   * Update performance monitor configuration
   */
  updateConfig(newConfig: PerformanceThresholds): void {
    this.alertThresholds = { ...this.alertThresholds, ...newConfig };
  }

  /**
   * Close performance monitor and cleanup resources
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Clear all metrics
    this.resetMetrics();
  }
}
