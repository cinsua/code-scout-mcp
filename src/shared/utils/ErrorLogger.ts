import type { Logger, LogContext } from './Logger';
import { sanitizeQueryForLogging } from './QuerySanitizer';
import { ERROR_AGGREGATION } from './LoggingConstants';

/**
 * Error handling and logging utilities for structured error reporting
 */

export interface ErrorContext {
  code?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  stack?: string;
  cause?: string;
  duration?: number;
  params?: number;
  metadata?: Record<string, any>;
}

export interface ErrorAggregation {
  errorType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  sampleErrors: Error[];
}

/**
 * Log an error with structured context
 */
export function logError(
  logger: Logger,
  error: Error | string,
  context?: ErrorContext,
  level: 'error' | 'warn' | 'fatal' = 'error',
): void {
  const errorObj = error instanceof Error ? error : new Error(error);
  const errorContext: LogContext = {
    service: context?.operation ? 'error-handler' : 'application',
    operation: context?.operation ?? 'error',
    error: {
      code: context?.code,
      stack: errorObj.stack,
      cause: context?.cause,
    },
    ...context?.metadata,
  };

  // Add request context if available
  if (context?.requestId || context?.userId || context?.sessionId) {
    errorContext.request = {
      id: context.requestId,
      userAgent: context.metadata?.userAgent,
    };
  }

  const message = errorObj.message || 'An error occurred';

  switch (level) {
    case 'fatal':
      logger.fatal(message, errorObj, errorContext);
      break;
    case 'warn':
      logger.warn(message, errorContext);
      break;
    case 'error':
    default:
      logger.error(message, errorObj, errorContext);
      break;
  }
}

/**
 * Log application startup errors
 */
export function logStartupError(
  logger: Logger,
  error: Error,
  context?: ErrorContext,
): void {
  logError(
    logger,
    error,
    {
      operation: 'startup',
      code: 'STARTUP_ERROR',
      ...context,
    },
    'fatal',
  );
}

/**
 * Log database errors with query context
 */
export function logDatabaseError(
  logger: Logger,
  error: Error,
  query?: string,
  context?: ErrorContext,
): void {
  logError(logger, error, {
    operation: 'database-operation',
    code: 'DATABASE_ERROR',
    metadata: {
      query: query ? sanitizeQueryForLogging(query) : undefined,
      ...context?.metadata,
    },
    ...context,
  });
}

/**
 * Log validation errors
 */
export function logValidationError(
  logger: Logger,
  errors: Array<{ path: string; message: string; code?: string }>,
  context?: ErrorContext,
): void {
  const errorContext: LogContext = {
    service: 'validation',
    operation: 'validate',
    error: {
      code: 'VALIDATION_ERROR',
      cause: `Multiple validation errors: ${errors.length}`,
    },
    validationErrors: errors,
    ...context?.metadata,
  };

  logger.error(
    `Validation failed with ${errors.length} errors`,
    undefined,
    errorContext,
  );
}

/**
 * Log configuration errors
 */
export function logConfigurationError(
  logger: Logger,
  error: Error,
  configPath?: string,
  context?: ErrorContext,
): void {
  logError(logger, error, {
    operation: 'configuration',
    code: 'CONFIG_ERROR',
    metadata: {
      configPath,
      ...context?.metadata,
    },
    ...context,
  });
}

/**
 * Log network/request errors
 */
export function logNetworkError(
  logger: Logger,
  error: Error,
  url?: string,
  method?: string,
  statusCode?: number,
  context?: ErrorContext,
): void {
  logError(logger, error, {
    operation: 'network-request',
    code: 'NETWORK_ERROR',
    metadata: {
      url,
      method,
      statusCode,
      ...context?.metadata,
    },
    ...context,
  });
}

/**
 * Enhanced error aggregation tracker with statistics and trend analysis
 */
export class ErrorAggregator {
  private errors = new Map<string, ErrorAggregation>();
  private errorHistory: Array<{
    type: string;
    timestamp: number;
    count: number;
  }> = [];
  private lastCleanup = Date.now();

  /**
   * Record an error for aggregation
   */
  recordError(error: Error, errorType?: string): void {
    const type = errorType ?? error.constructor.name;
    const existing = this.errors.get(type);
    const now = new Date();

    // Add to history for trend analysis
    this.errorHistory.push({
      type,
      timestamp: now.getTime(),
      count: 1,
    });

    // Cleanup old history entries (keep last 24 hours)
    this.cleanupHistory();

    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      if (existing.sampleErrors.length < ERROR_AGGREGATION.MAX_SAMPLE_ERRORS) {
        existing.sampleErrors.push(error);
      }
    } else {
      this.errors.set(type, {
        errorType: type,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        sampleErrors: [error],
      });
    }
  }

  /**
   * Get aggregated error statistics
   */
  getAggregatedErrors(): ErrorAggregation[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get error statistics with additional metrics
   */
  getErrorStatistics(): {
    totalErrors: number;
    uniqueErrorTypes: number;
    mostFrequentError?: { type: string; count: number };
    errorRate: number; // errors per minute
    trends: Array<{
      type: string;
      trend: 'increasing' | 'decreasing' | 'stable';
    }>;
    criticalErrors: string[];
  } {
    const aggregated = this.getAggregatedErrors();
    const totalErrors = aggregated.reduce((sum, agg) => sum + agg.count, 0);
    const uniqueErrorTypes = aggregated.length;

    // Find most frequent error
    const mostFrequentError = aggregated.reduce(
      (max: any, current) =>
        current.count > (max?.count ?? 0) ? current : max,
      undefined,
    );

    // Calculate error rate (errors per minute over last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = this.errorHistory.filter(
      entry => entry.timestamp > oneHourAgo,
    );
    const errorRate = recentErrors.length / 60; // per minute

    // Analyze trends
    const trends = this.analyzeTrends();

    // Identify critical errors (high frequency or recent spikes)
    const criticalErrors = aggregated
      .filter(agg => agg.count > ERROR_AGGREGATION.CRITICAL_THRESHOLD)
      .map(agg => agg.errorType);

    return {
      totalErrors,
      uniqueErrorTypes,
      mostFrequentError: mostFrequentError
        ? {
            type: mostFrequentError.errorType,
            count: mostFrequentError.count,
          }
        : undefined,
      errorRate,
      trends,
      criticalErrors,
    };
  }

  /**
   * Get error correlation patterns
   */
  getErrorCorrelations(): Array<{
    pattern: string;
    errors: string[];
    frequency: number;
    description: string;
  }> {
    const correlations: Array<{
      pattern: string;
      errors: string[];
      frequency: number;
      description: string;
    }> = [];

    const aggregated = this.getAggregatedErrors();

    // Look for common error patterns
    const timeoutErrors = aggregated.filter(
      agg =>
        agg.errorType.toLowerCase().includes('timeout') ||
        agg.sampleErrors.some(e => e.message.toLowerCase().includes('timeout')),
    );

    const connectionErrors = aggregated.filter(
      agg =>
        agg.errorType.toLowerCase().includes('connection') ||
        agg.sampleErrors.some(e =>
          e.message.toLowerCase().includes('connection'),
        ),
    );

    const validationErrors = aggregated.filter(
      agg =>
        agg.errorType.toLowerCase().includes('validation') ||
        agg.sampleErrors.some(e =>
          e.message.toLowerCase().includes('validation'),
        ),
    );

    if (timeoutErrors.length > 0) {
      correlations.push({
        pattern: 'timeout_errors',
        errors: timeoutErrors.map(e => e.errorType),
        frequency: timeoutErrors.reduce((sum, e) => sum + e.count, 0),
        description: 'Multiple timeout-related errors detected',
      });
    }

    if (connectionErrors.length > 0) {
      correlations.push({
        pattern: 'connection_errors',
        errors: connectionErrors.map(e => e.errorType),
        frequency: connectionErrors.reduce((sum, e) => sum + e.count, 0),
        description: 'Multiple connection-related errors detected',
      });
    }

    if (validationErrors.length > 0) {
      correlations.push({
        pattern: 'validation_errors',
        errors: validationErrors.map(e => e.errorType),
        frequency: validationErrors.reduce((sum, e) => sum + e.count, 0),
        description: 'Multiple validation-related errors detected',
      });
    }

    return correlations;
  }

  /**
   * Get performance impact analysis
   */
  getPerformanceImpact(): {
    highImpactErrors: string[];
    mediumImpactErrors: string[];
    lowImpactErrors: string[];
    overallImpact: 'low' | 'medium' | 'high' | 'critical';
  } {
    const aggregated = this.getAggregatedErrors();
    const highImpactErrors: string[] = [];
    const mediumImpactErrors: string[] = [];
    const lowImpactErrors: string[] = [];

    for (const agg of aggregated) {
      const impact = this.calculateErrorImpact(agg);

      if (impact.severity === 'high') {
        highImpactErrors.push(agg.errorType);
      } else if (impact.severity === 'medium') {
        mediumImpactErrors.push(agg.errorType);
      } else {
        lowImpactErrors.push(agg.errorType);
      }
    }

    // Determine overall impact
    let overallImpact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (highImpactErrors.length > 0) {
      overallImpact = highImpactErrors.length > 3 ? 'critical' : 'high';
    } else if (mediumImpactErrors.length > 2) {
      overallImpact = 'medium';
    }

    return {
      highImpactErrors,
      mediumImpactErrors,
      lowImpactErrors,
      overallImpact,
    };
  }

  /**
   * Log aggregated errors with enhanced reporting
   */
  logAggregatedErrors(logger: Logger): void {
    const aggregated = this.getAggregatedErrors();
    const statistics = this.getErrorStatistics();
    const correlations = this.getErrorCorrelations();
    const performanceImpact = this.getPerformanceImpact();

    if (aggregated.length === 0) {
      return;
    }

    logger.info('Enhanced error aggregation report', {
      service: 'error-aggregator',
      operation: 'enhanced-report',
      timestamp: new Date().toISOString(),
      summary: {
        totalErrorTypes: aggregated.length,
        totalErrors: statistics.totalErrors,
        uniqueErrorTypes: statistics.uniqueErrorTypes,
        errorRate: statistics.errorRate,
        overallImpact: performanceImpact.overallImpact,
      },
      mostFrequentError: statistics.mostFrequentError,
      criticalErrors: statistics.criticalErrors,
      trends: statistics.trends,
      correlations,
      performanceImpact,
      errorBreakdown: aggregated.map(agg => ({
        type: agg.errorType,
        count: agg.count,
        firstSeen: agg.firstSeen.toISOString(),
        lastSeen: agg.lastSeen.toISOString(),
        frequency:
          agg.count / ((Date.now() - agg.firstSeen.getTime()) / (1000 * 60)), // per minute
        sampleMessage: agg.sampleErrors[0]?.message,
        impact: this.calculateErrorImpact(agg),
      })),
    });
  }

  /**
   * Clean up old history entries
   */
  private cleanupHistory(): void {
    const now = Date.now();
    if (now - this.lastCleanup < ERROR_AGGREGATION.CLEANUP_INTERVAL_MS) {
      return;
    }

    const cutoff = now - ERROR_AGGREGATION.AGGREGATION_WINDOW_MS;
    this.errorHistory = this.errorHistory.filter(
      entry => entry.timestamp > cutoff,
    );
    this.lastCleanup = now;
  }

  /**
   * Analyze error trends
   */
  private analyzeTrends(): Array<{
    type: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const trends: Array<{
      type: string;
      trend: 'increasing' | 'decreasing' | 'stable';
    }> = [];
    const aggregated = this.getAggregatedErrors();

    for (const agg of aggregated) {
      const recentEntries = this.errorHistory.filter(
        entry =>
          entry.type === agg.errorType &&
          entry.timestamp > Date.now() - 2 * 60 * 60 * 1000, // Last 2 hours
      );

      if (recentEntries.length < 4) {
        trends.push({ type: agg.errorType, trend: 'stable' });
        continue;
      }

      // Simple trend analysis: compare first half to second half
      const midpoint = Math.floor(recentEntries.length / 2);
      const firstHalf = recentEntries.slice(0, midpoint);
      const secondHalf = recentEntries.slice(midpoint);

      const firstHalfCount = firstHalf.reduce(
        (sum, entry) => sum + entry.count,
        0,
      );
      const secondHalfCount = secondHalf.reduce(
        (sum, entry) => sum + entry.count,
        0,
      );

      const ratio = secondHalfCount / firstHalfCount;

      if (ratio > 1.2) {
        trends.push({ type: agg.errorType, trend: 'increasing' });
      } else if (ratio < 0.8) {
        trends.push({ type: agg.errorType, trend: 'decreasing' });
      } else {
        trends.push({ type: agg.errorType, trend: 'stable' });
      }
    }

    return trends;
  }

  /**
   * Calculate error impact based on frequency and recency
   */
  private calculateErrorImpact(agg: ErrorAggregation): {
    severity: 'low' | 'medium' | 'high';
    score: number;
    factors: string[];
  } {
    const now = Date.now();
    const ageInHours = (now - agg.firstSeen.getTime()) / (1000 * 60 * 60);
    const frequency = agg.count / Math.max(ageInHours, 1); // per hour
    const recencyScore = Math.max(
      0,
      1 - (now - agg.lastSeen.getTime()) / (24 * 60 * 60 * 1000),
    ); // Decay over 24 hours

    let severity: 'low' | 'medium' | 'high' = 'low';
    let score = frequency * recencyScore * 10;
    const factors: string[] = [];

    if (frequency > 10) {
      severity = 'high';
      factors.push('high_frequency');
    } else if (frequency > 5) {
      severity = 'medium';
      factors.push('moderate_frequency');
    } else {
      factors.push('low_frequency');
    }

    if (recencyScore > 0.8) {
      factors.push('very_recent');
    } else if (recencyScore > 0.5) {
      factors.push('recent');
    } else {
      factors.push('older');
    }

    // Boost score for critical error types
    if (
      agg.errorType.toLowerCase().includes('critical') ||
      agg.errorType.toLowerCase().includes('fatal') ||
      agg.errorType.toLowerCase().includes('emergency')
    ) {
      score *= 2;
      factors.push('critical_type');
      severity = 'high';
    }

    return { severity, score, factors };
  }

  /**
   * Reset error aggregation
   */
  reset(): void {
    this.errors.clear();
  }
}
