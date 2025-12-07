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
 * Create error aggregation tracker
 */
export class ErrorAggregator {
  private errors = new Map<string, ErrorAggregation>();

  /**
   * Record an error for aggregation
   */
  recordError(error: Error, errorType?: string): void {
    const type = errorType ?? error.constructor.name;
    const existing = this.errors.get(type);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      if (existing.sampleErrors.length < ERROR_AGGREGATION.MAX_SAMPLE_ERRORS) {
        existing.sampleErrors.push(error);
      }
    } else {
      this.errors.set(type, {
        errorType: type,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
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
   * Log aggregated errors
   */
  logAggregatedErrors(logger: Logger): void {
    const aggregated = this.getAggregatedErrors();

    if (aggregated.length === 0) {
      return;
    }

    logger.info('Error aggregation report', {
      service: 'error-aggregator',
      operation: 'report',
      totalErrorTypes: aggregated.length,
      totalErrors: aggregated.reduce((sum, agg) => sum + agg.count, 0),
      errorBreakdown: aggregated.map(agg => ({
        type: agg.errorType,
        count: agg.count,
        firstSeen: agg.firstSeen.toISOString(),
        lastSeen: agg.lastSeen.toISOString(),
        sampleMessage: agg.sampleErrors[0]?.message,
      })),
    });
  }

  /**
   * Reset error aggregation
   */
  reset(): void {
    this.errors.clear();
  }
}
