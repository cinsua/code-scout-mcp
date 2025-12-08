/// <reference types="node" />
/// <reference lib="dom" />
/* global AbortSignal */
import { TimeoutError } from '../errors/TimeoutError';
import { getTimeout } from '../errors/ErrorConstants';
import { ErrorFactory } from '../errors/ErrorFactory';
import { ErrorMigration } from '../errors/ErrorMigration';
import type { IErrorAggregator } from '../services/types';
import { ErrorSeverity } from '../errors/ErrorTypes';

import { Logger } from './Logger';

// Create a logger instance for timeout operations
const logger = new Logger().child({
  service: 'TimeoutManager',
});

export interface TimeoutOptions {
  timeoutMs?: number;
  operationType?: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS;
  onTimeout?: (timeoutMs: number) => void;
  signal?: AbortSignal;
}

export interface TimeoutResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  timedOut: boolean;
  duration: number;
}

/**
 * Timeout manager for operations with configurable timeouts and cancellation.
 * Provides centralized timeout management with different presets for various operation types.
 */
export class TimeoutManager {
  private static customTimeouts: Map<
    keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
    number
  > = new Map();

  // Optional error aggregator for timeout monitoring (injected externally)
  private static errorAggregator?: IErrorAggregator;

  /**
   * Set the error aggregator for timeout monitoring
   */
  static setErrorAggregator(aggregator: IErrorAggregator): void {
    TimeoutManager.errorAggregator = aggregator;
  }

  public static readonly DEFAULT_TIMEOUTS = {
    database: getTimeout('DATABASE'),
    parsing: getTimeout('PARSING'),
    network: getTimeout('NETWORK'),
    filesystem: getTimeout('FILESYSTEM'),
    indexing: getTimeout('INDEXING'),
    query: getTimeout('QUERY'),
    connection: getTimeout('CONNECTION'),
    read: getTimeout('DATABASE'),
    write: getTimeout('DATABASE'),
    lock: getTimeout('DEFAULT'),
    default: getTimeout('DEFAULT'),
  } as const;

  private static readonly VALID_OPERATION_TYPES = Object.keys(
    TimeoutManager.DEFAULT_TIMEOUTS,
  ) as Array<keyof typeof TimeoutManager.DEFAULT_TIMEOUTS>;

  /**
   * Get default timeout value for operation type safely
   */
  private static getDefaultTimeoutForType(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): number {
    switch (operationType) {
      case 'database':
        return getTimeout('DATABASE');
      case 'parsing':
        return getTimeout('PARSING');
      case 'network':
        return getTimeout('NETWORK');
      case 'filesystem':
        return getTimeout('FILESYSTEM');
      case 'indexing':
        return getTimeout('INDEXING');
      case 'query':
        return getTimeout('QUERY');
      case 'connection':
        return getTimeout('CONNECTION');
      case 'read':
        return getTimeout('DATABASE');
      case 'write':
        return getTimeout('DATABASE');
      case 'lock':
        return getTimeout('DEFAULT');
      case 'default':
        return getTimeout('DEFAULT');
      default:
        throw ErrorFactory.validation(
          `Invalid input for field 'operationType'. Expected valid operation type`,
          'operationType',
          operationType,
        );
    }
  }

  /**
   * Execute an operation with timeout
   */
  static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions = {},
  ): Promise<T> {
    const result = await this.executeWithMetrics(operation, options);

    if (!result.success) {
      logger.error('Operation failed with timeout or error', result.error, {
        operationType: options.operationType,
        timeoutMs: result.duration,
        timedOut: result.timedOut,
      });
      throw (
        result.error ??
        ErrorFactory.service('Operation failed', 'OPERATION_FAILED', false)
      );
    }

    logger.debug('Operation completed successfully', {
      operationType: options.operationType,
      duration: result.duration,
    });

    return result.result as T;
  }

  /**
   * Execute operation with detailed timeout metrics
   */
  static async executeWithMetrics<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions,
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now();
    const timeoutMs = this.getTimeout(options);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = TimeoutError.operationTimeout(
          options.operationType ?? 'unknown',
          timeoutMs,
          Date.now() - startTime,
        );

        if (options.onTimeout) {
          options.onTimeout(timeoutMs);
        }

        reject(timeoutError);
      }, timeoutMs);

      // Handle abort signal if provided
      if (options.signal) {
        const handleAbort = () => {
          clearTimeout(timeoutId);
          logger.info('Operation aborted via signal', {
            operationType: options.operationType,
          });
          reject(
            ErrorFactory.service(
              'Operation aborted',
              'OPERATION_ABORTED',
              false,
            ),
          );
        };

        if (options.signal.aborted) {
          handleAbort();
        } else {
          options.signal.addEventListener('abort', handleAbort, { once: true });
        }
      }
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      const duration = Date.now() - startTime;

      // Record successful operation
      if (TimeoutManager.errorAggregator) {
        await TimeoutManager.errorAggregator.recordSuccess(
          'timeout-manager',
          options.operationType ?? 'unknown',
        );
      }

      return {
        success: true,
        result,
        timedOut: false,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof TimeoutError;

      // Migrate legacy errors to ServiceError format
      const migratedError = ErrorMigration.migrateError(
        error as Error,
        options.operationType ?? 'unknown',
      );

      // Record error with aggregator
      if (TimeoutManager.errorAggregator) {
        await TimeoutManager.errorAggregator.recordError(
          migratedError.migrated,
          {
            service: 'timeout-manager',
            operation: options.operationType ?? 'unknown',
            metadata: {
              timeoutMs,
              actualDuration: duration,
              isTimeout,
            },
          },
        );
      }

      if (isTimeout) {
        logger.warn('Operation timed out', {
          operationType: options.operationType,
          timeoutMs,
          actualDuration: duration,
        });
      } else {
        logger.error('Operation failed with error', migratedError.migrated, {
          operationType: options.operationType,
          duration,
          wasLegacy: migratedError.wasLegacy,
          originalType: migratedError.originalType,
        });
      }

      return {
        success: false,
        error: migratedError.migrated,
        timedOut: isTimeout,
        duration,
      };
    }
  }

  /**
   * Execute with database timeout
   */
  static executeWithDatabaseTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'database',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with parsing timeout
   */
  static executeWithParsingTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'parsing',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with network timeout
   */
  static executeWithNetworkTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'network',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with filesystem timeout
   */
  static executeWithFilesystemTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'filesystem',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with indexing timeout
   */
  static executeWithIndexingTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'indexing',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with query timeout
   */
  static executeWithQueryTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'query',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute with connection timeout
   */
  static executeWithConnectionTimeout<T>(
    operation: () => Promise<T>,
    customTimeout?: number,
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      operationType: 'connection',
      timeoutMs: customTimeout,
    });
  }

  /**
   * Execute multiple operations with timeout
   */
  static executeAllWithTimeout<T>(
    operations: Array<() => Promise<T>>,
    options: TimeoutOptions = {},
  ): Promise<Array<TimeoutResult<T>>> {
    logger.debug('Executing multiple operations with timeout', {
      operationCount: operations.length,
      operationType: options.operationType,
      timeoutMs: options.timeoutMs,
    });

    return Promise.all(
      operations.map(op => this.executeWithMetrics(op, options)),
    );
  }

  /**
   * Execute operations in sequence with timeout
   */
  static async executeSequenceWithTimeout<T>(
    operations: Array<() => Promise<T>>,
    options: TimeoutOptions = {},
  ): Promise<Array<TimeoutResult<T>>> {
    logger.debug('Executing operations in sequence with timeout', {
      operationCount: operations.length,
      operationType: options.operationType,
      timeoutMs: options.timeoutMs,
    });

    const results: Array<TimeoutResult<T>> = [];
    let operationIndex = 0;

    for (const operation of operations) {
      const result = await this.executeWithMetrics(operation, options);
      results.push(result);

      // Stop sequence if operation timed out
      if (result.timedOut) {
        logger.warn('Sequence stopped due to timeout', {
          operationIndex,
          totalOperations: operations.length,
          operationType: options.operationType,
        });
        break;
      }
      operationIndex++;
    }

    return results;
  }

  /**
   * Create a timeout wrapper for an operation
   */
  static createTimeoutWrapper<T>(
    operation: () => Promise<T>,
    options: TimeoutOptions = {},
  ): () => Promise<T> {
    return () => this.executeWithTimeout(operation, options);
  }

  /**
   * Execute with progressive timeout (increases on retries)
   */
  static async executeWithProgressiveTimeout<T>(
    operation: () => Promise<T>,
    baseTimeout: number,
    maxTimeout: number,
    multiplier: number = 2,
    maxAttempts: number = 3,
  ): Promise<T> {
    let lastError: Error = ErrorFactory.service(
      'Max attempts reached',
      'MAX_ATTEMPTS_EXCEEDED',
      false,
    );
    let currentTimeout = baseTimeout;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(operation, {
          timeoutMs: Math.min(currentTimeout, maxTimeout),
        });

        if (attempt > 1) {
          logger.info('Progressive timeout succeeded after retry', {
            attempt,
            finalTimeout: Math.min(currentTimeout, maxTimeout),
          });
        }

        return result;
      } catch (error) {
        const migratedError = ErrorMigration.migrateError(
          error as Error,
          'progressive_timeout',
        );
        lastError = migratedError.migrated;

        // Don't increase timeout for non-timeout errors
        if (!(error instanceof TimeoutError)) {
          logger.error(
            'Operation failed with non-timeout error during progressive timeout',
            migratedError.migrated,
            {
              attempt,
              maxAttempts,
              currentTimeout,
              wasLegacy: migratedError.wasLegacy,
              originalType: migratedError.originalType,
            },
          );
          throw migratedError.migrated;
        }

        currentTimeout *= multiplier;
        logger.warn('Progressive timeout retry', {
          attempt,
          maxAttempts,
          currentTimeout,
          operationType: 'progressive',
        });
      }
    }

    throw lastError;
  }

  /**
   * Get timeout value from options
   */
  private static getTimeout(options: TimeoutOptions): number {
    if (options.timeoutMs) {
      return options.timeoutMs;
    }

    if (options.operationType) {
      // Validate that the operation type exists to prevent object injection
      if (!this.VALID_OPERATION_TYPES.includes(options.operationType)) {
        logger.warn('Invalid operation type provided', {
          operationType: options.operationType,
          validTypes: this.VALID_OPERATION_TYPES,
          context: 'timeout_options_validation',
        });
        throw ErrorFactory.validationConstraint(
          'operationType',
          `Must be one of: ${this.VALID_OPERATION_TYPES.join(', ')}`,
          options.operationType,
        );
      }
      return (
        this.customTimeouts.get(options.operationType) ??
        this.getDefaultTimeoutForType(options.operationType)
      );
    }

    return this.customTimeouts.get('default') ?? this.DEFAULT_TIMEOUTS.default;
  }

  /**
   * Get default timeout for operation type
   */
  static getDefaultTimeout(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
  ): number {
    // Validate that the operation type exists to prevent object injection
    if (!this.VALID_OPERATION_TYPES.includes(operationType)) {
      logger.warn('Invalid operation type provided for default timeout', {
        operationType,
        validTypes: this.VALID_OPERATION_TYPES,
        context: 'default_timeout_validation',
      });
      throw ErrorFactory.validationConstraint(
        'operationType',
        `Must be one of: ${this.VALID_OPERATION_TYPES.join(', ')}`,
        operationType,
      );
    }

    return (
      this.customTimeouts.get(operationType) ??
      this.getDefaultTimeoutForType(operationType)
    );
  }

  /**
   * Set custom default timeout for operation type
   */
  static setDefaultTimeout(
    operationType: keyof typeof TimeoutManager.DEFAULT_TIMEOUTS,
    timeoutMs: number,
  ): void {
    // Validate that the operation type exists in DEFAULT_TIMEOUTS
    if (!this.VALID_OPERATION_TYPES.includes(operationType)) {
      logger.warn(
        'Invalid operation type provided for setting default timeout',
        {
          operationType,
          validTypes: this.VALID_OPERATION_TYPES,
          context: 'set_default_timeout_validation',
        },
      );
      throw ErrorFactory.validationConstraint(
        'operationType',
        `Must be one of: ${this.VALID_OPERATION_TYPES.join(', ')}`,
        operationType,
      );
    }

    // Validate timeout is a positive number
    if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
      logger.warn('Invalid timeout value provided', {
        timeoutMs,
        operationType,
      });
      throw ErrorFactory.validation(
        `Field 'timeoutMs' value ${timeoutMs} is out of range. Expected greater than or equal to 1`,
        'timeoutMs',
        timeoutMs,
      );
    }

    // Safe property assignment using customTimeouts
    this.customTimeouts.set(operationType, timeoutMs);

    logger.info('Custom timeout set for operation type', {
      operationType,
      timeoutMs,
    });
  }

  /**
   * Get all default timeouts
   */
  static getAllDefaultTimeouts(): Readonly<
    typeof TimeoutManager.DEFAULT_TIMEOUTS
  > {
    return { ...this.DEFAULT_TIMEOUTS };
  }

  /**
   * Create a cancellable timeout
   */
  static createCancellableTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): {
    promise: Promise<T>;
    cancel: () => void;
  } {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const promise = new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          reject(TimeoutError.operationTimeout('unknown', timeoutMs));
        }
      }, timeoutMs);

      operation()
        .then(result => {
          if (!isCancelled) {
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch(error => {
          if (!isCancelled) {
            clearTimeout(timeoutId);
            const migratedError = ErrorMigration.migrateError(
              error as Error,
              'cancellable_timeout',
            );
            reject(migratedError.migrated);
          }
        });
    });

    const cancel = () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };

    return { promise, cancel };
  }

  /**
   * Execute with adaptive timeout based on historical performance
   */
  static executeWithAdaptiveTimeout<T>(
    operation: () => Promise<T>,
    baseTimeout: number,
    history: Array<number> = [],
    multiplier: number = 1.5,
  ): Promise<T> {
    let timeoutMs = baseTimeout;

    if (history.length > 0) {
      const avgDuration =
        history.reduce((sum, d) => sum + d, 0) / history.length;
      const maxDuration = Math.max(...history);

      // Use average duration plus a safety margin
      timeoutMs = Math.max(baseTimeout, avgDuration * multiplier);

      // Cap at reasonable maximum
      timeoutMs = Math.min(timeoutMs, maxDuration * 2, baseTimeout * 5);

      logger.debug('Adaptive timeout calculated', {
        baseTimeout,
        calculatedTimeout: timeoutMs,
        avgDuration,
        maxDuration,
        historyLength: history.length,
      });
    }

    return this.executeWithTimeout(operation, { timeoutMs });
  }

  /**
   * Get timeout statistics from results
   */
  static getTimeoutStatistics<T>(results: Array<TimeoutResult<T>>): {
    totalOperations: number;
    successfulOperations: number;
    timedOutOperations: number;
    successRate: number;
    timeoutRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  } {
    const successful = results.filter(r => r.success);
    const timedOut = results.filter(r => r.timedOut);
    const durations = results.map(r => r.duration).filter(d => d > 0);

    return {
      totalOperations: results.length,
      successfulOperations: successful.length,
      timedOutOperations: timedOut.length,
      successRate: (successful.length / results.length) * 100,
      timeoutRate: (timedOut.length / results.length) * 100,
      averageDuration:
        durations.length > 0
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length
          : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    };
  }

  /**
   * Get timeout error rate statistics from error aggregator
   */
  static getTimeoutErrorRate(
    operationType?: string,
    minutes: number = 5,
  ): {
    timeoutRate: number;
    totalTimeouts: number;
    totalOperations: number;
    timeoutPercentage: number;
  } {
    if (!TimeoutManager.errorAggregator) {
      return {
        timeoutRate: 0,
        totalTimeouts: 0,
        totalOperations: 0,
        timeoutPercentage: 0,
      };
    }

    const rateData = TimeoutManager.errorAggregator.getErrorRate(
      'timeout-manager',
      operationType,
      minutes,
    );

    return {
      timeoutRate: rateData.errorRate,
      totalTimeouts: rateData.totalErrors,
      totalOperations: rateData.totalRequests,
      timeoutPercentage: rateData.errorPercentage,
    };
  }

  /**
   * Check for critical timeout scenarios and trigger alerts
   */
  static checkCriticalTimeoutScenarios(): void {
    if (!TimeoutManager.errorAggregator) {
      return;
    }

    const stats = TimeoutManager.errorAggregator.getErrorStatistics();
    const timeoutPatterns = TimeoutManager.errorAggregator
      .getErrorPatterns()
      .filter(pattern => pattern.pattern.includes('timeout'));

    // Check for high timeout rate across all operations
    const overallTimeoutRate = this.getTimeoutErrorRate();

    if (overallTimeoutRate.timeoutRate > 10) {
      // More than 10 timeouts per minute
      logger.warn('Critical timeout rate detected', {
        timeoutRate: overallTimeoutRate.timeoutRate,
        totalTimeouts: overallTimeoutRate.totalTimeouts,
        timeoutPercentage: overallTimeoutRate.timeoutPercentage,
        context: 'critical_timeout_monitoring',
      });
    }

    // Check for timeout patterns indicating systemic issues
    if (timeoutPatterns.length > 0) {
      const criticalPatterns = timeoutPatterns.filter(
        pattern =>
          pattern.severity === ErrorSeverity.CRITICAL || pattern.frequency > 20,
      );

      if (criticalPatterns.length > 0) {
        logger.error('Critical timeout patterns detected', undefined, {
          patternCount: criticalPatterns.length,
          context: 'critical_timeout_pattern_alert',
        });
      }
    }

    // Check for service-specific timeout issues
    const serviceBreakdown = stats.serviceBreakdown;
    const timeoutServices = Object.entries(serviceBreakdown)
      .filter(
        ([service, count]) =>
          service === 'timeout-manager' &&
          typeof count === 'number' &&
          count > 50,
      )
      .map(([service, count]) => ({ service, count: count as number }));

    if (timeoutServices.length > 0) {
      logger.warn('High timeout volume in timeout-manager service', {
        services: timeoutServices,
        context: 'service_timeout_volume_alert',
      });
    }
  }

  /**
   * Get active timeout-related alerts
   */
  static getActiveTimeoutAlerts() {
    if (!TimeoutManager.errorAggregator) {
      return [];
    }

    return TimeoutManager.errorAggregator
      .getActiveAlerts()
      .filter(
        alert =>
          alert.message.toLowerCase().includes('timeout') ||
          alert.details.services?.includes('timeout-manager'),
      );
  }
}
