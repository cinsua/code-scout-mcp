import type { Logger, LogContext } from './Logger';
import { sanitizeQueryForLogging } from './QuerySanitizer';
import { PERFORMANCE_THRESHOLDS } from './LoggingConstants';

/**
 * Performance logging utilities for structured performance monitoring
 */

export interface PerformanceTimer {
  startTime: number;
  endTime?: number;
  memoryStart: NodeJS.MemoryUsage;
  memoryEnd?: NodeJS.MemoryUsage;
}

export interface PerformanceMetrics {
  duration: number;
  memoryDelta: number;
  memoryPeak: number;
  cpuUsage?: number;
}

/**
 * Start a performance timer
 */
export function startTimer(): PerformanceTimer {
  return {
    startTime: Date.now(),
    memoryStart: process.memoryUsage(),
  };
}

/**
 * End a performance timer and calculate metrics
 */
export function endTimer(timer: PerformanceTimer): PerformanceMetrics {
  const endTime = Date.now();
  const memoryEnd = process.memoryUsage();

  const duration = endTime - timer.startTime;
  const memoryDelta = memoryEnd.heapUsed - timer.memoryStart.heapUsed;
  const memoryPeak = Math.max(memoryEnd.heapUsed, timer.memoryStart.heapUsed);

  timer.endTime = endTime;
  timer.memoryEnd = memoryEnd;

  return {
    duration,
    memoryDelta,
    memoryPeak,
  };
}

/**
 * Create performance context for logging
 */
export function createPerformanceContext(
  metrics: PerformanceMetrics,
): LogContext['performance'] {
  return {
    duration: metrics.duration,
    memoryUsage: metrics.memoryPeak,
  };
}

/**
 * Log performance metrics with structured context
 */
export function logPerformance(
  logger: Logger,
  operation: string,
  metrics: PerformanceMetrics,
  additionalContext?: Record<string, any>,
): void {
  const context: LogContext = {
    service: 'performance-monitor',
    operation,
    performance: createPerformanceContext(metrics),
    ...additionalContext,
  };

  if (metrics.duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_THRESHOLD_MS) {
    // Log as warning for slow operations
    logger.warn(
      `Performance: ${operation} took ${metrics.duration}ms`,
      context,
    );
  } else if (
    metrics.duration > PERFORMANCE_THRESHOLDS.ANALYSIS_SLOW_QUERY_THRESHOLD_MS
  ) {
    // Log as info for moderately slow operations
    logger.info(`Performance: ${operation} completed`, context);
  } else {
    // Log as debug for fast operations
    logger.debug(`Performance: ${operation} completed`, context);
  }
}

/**
 * Execute a function with performance monitoring
 */
export async function withPerformanceLogging<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  additionalContext?: Record<string, any>,
): Promise<T> {
  const timer = startTimer();

  try {
    const result = await fn();
    const metrics = endTimer(timer);
    logPerformance(logger, operation, metrics, {
      success: true,
      ...additionalContext,
    });
    return result;
  } catch (error) {
    const metrics = endTimer(timer);
    const errorContext = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ...additionalContext,
    };
    logPerformance(logger, operation, metrics, errorContext);
    throw error;
  }
}

/**
 * Execute a synchronous function with performance monitoring
 */
export function withSyncPerformanceLogging<T>(
  logger: Logger,
  operation: string,
  fn: () => T,
  additionalContext?: Record<string, any>,
): T {
  const timer = startTimer();

  try {
    const result = fn();
    const metrics = endTimer(timer);
    logPerformance(logger, operation, metrics, {
      success: true,
      ...additionalContext,
    });
    return result;
  } catch (error) {
    const metrics = endTimer(timer);
    const errorContext = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ...additionalContext,
    };
    logPerformance(logger, operation, metrics, errorContext);
    throw error;
  }
}

/**
 * Create database query performance context
 */
export function createQueryPerformanceContext(
  query: string,
  duration: number,
  rowCount?: number,
): LogContext {
  const memoryUsage = process.memoryUsage().heapUsed;

  return {
    service: 'database-service',
    operation: 'query',
    performance: {
      duration,
      memoryUsage,
      queryCount: 1,
    },
    query: sanitizeQueryForLogging(query),
    rowCount,
  };
}
