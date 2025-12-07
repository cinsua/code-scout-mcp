/**
 * Performance-related types for database operations and monitoring
 */

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Connection pool settings */
  connectionPool: {
    /** Minimum connections */
    minConnections: number;
    /** Maximum connections */
    maxConnections: number;
    /** Connection idle timeout in ms */
    idleTimeoutMs: number;
    /** Connection validation interval in ms */
    validationIntervalMs: number;
    /** Connection retry attempts */
    retryAttempts: number;
    /** Retry base delay in ms */
    retryBaseDelayMs: number;
    /** Retry max delay in ms */
    retryMaxDelayMs: number;
  };
  /** Query caching settings */
  queryCache: {
    /** Enable query result caching */
    enabled: boolean;
    /** Maximum cache size */
    maxSize: number;
    /** Cache TTL in ms */
    ttlMs: number;
  };
  /** Prepared statement caching */
  preparedStatementCache: {
    /** Enable prepared statement caching */
    enabled: boolean;
    /** Maximum cache size */
    maxSize: number;
  };
  /** Performance monitoring */
  monitoring: {
    /** Enable performance monitoring */
    enabled: boolean;
    /** Metrics retention period in ms */
    retentionMs: number;
    /** Slow query threshold in ms */
    slowQueryThresholdMs: number;
  };
  /** Memory management */
  memory: {
    /** Maximum memory usage in bytes */
    maxUsageBytes: number;
    /** Memory check interval in ms */
    checkIntervalMs: number;
    /** Enable memory optimization */
    optimizationEnabled: boolean;
  };
}

/**
 * Performance report
 */
export interface PerformanceReport {
  /** Total queries executed */
  totalQueries: number;
  /** Average execution time in ms */
  averageExecutionTime: number;
  /** Number of slow queries */
  slowQueries: number;
  /** Top slow queries */
  topSlowQueries: SlowQueryLog[];
  /** Connection pool statistics */
  connectionPoolStats: EnhancedConnectionPoolStats;
  /** Memory usage information */
  memoryUsage: {
    /** Current memory usage */
    current: number;
    /** Peak memory usage */
    peak: number;
    /** Average memory usage */
    average: number;
  };
  /** Error statistics */
  errorStats: {
    /** Total errors */
    total: number;
    /** Error rate */
    rate: number;
    /** Most common errors */
    commonErrors: Array<{
      error: string;
      count: number;
    }>;
  };
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  /** Query hash for identification */
  queryHash: string;
  /** Total execution count */
  executionCount: number;
  /** Total execution time in ms */
  totalExecutionTime: number;
  /** Average execution time in ms */
  avgExecutionTime: number;
  /** Minimum execution time in ms */
  minExecutionTime: number;
  /** Maximum execution time in ms */
  maxExecutionTime: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Average rows returned */
  avgRowsReturned: number;
  /** Last execution timestamp */
  lastExecution: number;
}

/**
 * Slow query log entry
 */
export interface SlowQueryLog {
  /** Query hash */
  queryHash: string;
  /** Query SQL */
  query: string;
  /** Execution time in ms */
  executionTime: number;
  /** Timestamp */
  timestamp: number;
  /** Parameters used */
  params?: unknown[];
  /** Rows returned */
  rowCount?: number;
  /** Error if any */
  error?: string;
}

/**
 * Performance thresholds for alerting
 */
export interface PerformanceThresholds {
  /** Slow query threshold in ms */
  slowQueryMs: number;
  /** Connection acquisition threshold in ms */
  connectionAcquisitionMs: number;
  /** Memory usage threshold in bytes */
  memoryUsageBytes: number;
  /** Connection pool utilization threshold (0-1) */
  poolUtilizationThreshold: number;
  /** Error rate threshold (0-1) */
  errorRateThreshold: number;
}

/**
 * Query execution plan
 */
export interface QueryPlan {
  /** Query SQL */
  query: string;
  /** EXPLAIN QUERY PLAN result */
  explainResult: unknown[];
  /** Recommended indexes */
  recommendedIndexes: string[];
  /** Estimated cost */
  estimatedCost: number;
  /** Optimization hints */
  optimizationHints: string[];
  /** Plan creation timestamp */
  createdAt: number;
  /** Whether plan is stale */
  isStale: boolean;
}

/**
 * Optimized query with plan
 */
export interface OptimizedQuery {
  /** Original query */
  originalQuery: string;
  /** Optimized query SQL */
  optimizedQuery: string;
  /** Query parameters */
  params: unknown[];
  /** Execution plan */
  plan: QueryPlan;
  /** Estimated performance improvement */
  estimatedImprovement: number;
}

/**
 * Enhanced connection pool statistics
 */
export interface EnhancedConnectionPoolStats {
  /** Total connections created */
  created: number;
  /** Connections acquired from pool */
  acquired: number;
  /** Connections released to pool */
  released: number;
  /** Connections destroyed */
  destroyed: number;
  /** Current pool size */
  size: number;
  /** Available connections */
  available: number;
  /** Requests waiting for connection */
  waiting: number;
  /** Connection health metrics */
  health: {
    /** Healthy connections */
    healthy: number;
    /** Unhealthy connections */
    unhealthy: number;
    /** Connections being validated */
    validating: number;
  };
  /** Performance metrics */
  performance: {
    /** Average acquisition time in ms */
    avgAcquisitionTime: number;
    /** Peak acquisition time in ms */
    peakAcquisitionTime: number;
    /** Total wait time in ms */
    totalWaitTime: number;
    /** Connection reuse rate */
    reuseRate: number;
  };
  /** Resource metrics */
  resources: {
    /** Memory usage in bytes */
    memoryUsage: number;
    /** File descriptor count */
    fileDescriptors: number;
    /** Idle timeout count */
    idleTimeouts: number;
  };
}

/**
 * Connection health information
 */
export interface ConnectionHealth {
  /** Connection identifier */
  id: string;
  /** Whether connection is healthy */
  isHealthy: boolean;
  /** Last health check timestamp */
  lastCheck: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
  /** Last error if any */
  lastError?: string;
  /** Connection age in milliseconds */
  age: number;
  /** Idle time in milliseconds */
  idleTime: number;
}

/**
 * Memory snapshot interface
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

/**
 * Memory statistics interface
 */
export interface MemoryStats {
  current: number;
  peak: number;
  average: number;
  growth: number;
  snapshots: MemorySnapshot[];
  trend: 'increasing' | 'decreasing' | 'stable';
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Memory optimization result
 */
export interface MemoryOptimizationResult {
  freedMemory: number;
  optimizations: string[];
  success: boolean;
}

/**
 * Memory pressure configuration
 */
export interface MemoryPressureConfig {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  criticalThreshold: number;
}

/**
 * Memory monitoring interface
 */
export interface MemoryMonitoringInterface {
  getCurrentMemoryUsage(): number;
  getMemoryStats(): MemoryStats;
  isMemoryUsageHigh(thresholdBytes: number): boolean;
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable';
  getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical';
  optimizeMemory(): MemoryOptimizationResult;
  takeSnapshot(): MemorySnapshot;
  clearSnapshots(): void;
}
